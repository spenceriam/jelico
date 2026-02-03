/**
 * Clarification Store
 *
 * Manages state for AI clarification questions.
 * When AI needs user input before proceeding, it sends a clarification request
 * which appears inline in the chat.
 */

import { create } from 'zustand'

export interface ClarificationOption {
  label: string
  description?: string
}

export interface ClarificationQuestion {
  id: string
  question: string
  header?: string // Short label for chip/tag display (max 12 chars)
  options: ClarificationOption[]
  multiSelect: boolean
  selectedOptions: string[] // Labels of selected options
  otherText: string // Text for "Other" option
}

export interface ClarificationRequest {
  id: string
  subject: string
  questions: ClarificationQuestion[]
  conversationId: string
  createdAt: number
}

interface ClarificationState {
  // Active clarification request (only one at a time)
  activeRequest: ClarificationRequest | null

  // Additional details text (shared across all questions)
  additionalDetails: string

  // Resolved requests (for history, keyed by request ID)
  resolvedRequests: Map<string, {
    request: ClarificationRequest
    answers: Record<string, string[]>
    additionalDetails?: string
    resolvedAt: number
  }>

  // Actions
  setActiveRequest: (request: ClarificationRequest | null) => void
  selectOption: (questionId: string, optionLabel: string) => void
  toggleOption: (questionId: string, optionLabel: string) => void
  setOtherText: (questionId: string, text: string) => void
  setAdditionalDetails: (text: string) => void
  submitAnswers: () => Promise<Record<string, string[]>>
  clearForConversation: (conversationId: string) => void

  // Computed
  canSubmit: () => boolean
  getAnswers: () => Record<string, string[]>
}

export const useClarificationStore = create<ClarificationState>((set, get) => ({
  activeRequest: null,
  additionalDetails: '',
  resolvedRequests: new Map(),

  setActiveRequest: (request) => {
    // Reset additional details when a new request comes in
    set({ activeRequest: request, additionalDetails: '' })
  },

  setAdditionalDetails: (text) => {
    set({ additionalDetails: text })
  },

  selectOption: (questionId, optionLabel) => {
    const { activeRequest } = get()
    if (!activeRequest) return

    set({
      activeRequest: {
        ...activeRequest,
        questions: activeRequest.questions.map(q => {
          if (q.id !== questionId) return q

          // For single-select, replace selection
          if (!q.multiSelect) {
            return {
              ...q,
              selectedOptions: [optionLabel],
              // Clear other text if not selecting "Other"
              otherText: optionLabel === 'Other' ? q.otherText : '',
            }
          }

          // For multi-select, toggle
          const isSelected = q.selectedOptions.includes(optionLabel)
          return {
            ...q,
            selectedOptions: isSelected
              ? q.selectedOptions.filter(o => o !== optionLabel)
              : [...q.selectedOptions, optionLabel],
          }
        }),
      },
    })
  },

  toggleOption: (questionId, optionLabel) => {
    const { activeRequest } = get()
    if (!activeRequest) return

    set({
      activeRequest: {
        ...activeRequest,
        questions: activeRequest.questions.map(q => {
          if (q.id !== questionId) return q

          const isSelected = q.selectedOptions.includes(optionLabel)
          return {
            ...q,
            selectedOptions: isSelected
              ? q.selectedOptions.filter(o => o !== optionLabel)
              : [...q.selectedOptions, optionLabel],
          }
        }),
      },
    })
  },

  setOtherText: (questionId, text) => {
    const { activeRequest } = get()
    if (!activeRequest) return

    set({
      activeRequest: {
        ...activeRequest,
        questions: activeRequest.questions.map(q => {
          if (q.id !== questionId) return q
          return { ...q, otherText: text }
        }),
      },
    })
  },

  canSubmit: () => {
    const { activeRequest } = get()
    if (!activeRequest) return false

    // All questions must have at least one selection
    return activeRequest.questions.every(q => {
      if (q.selectedOptions.length === 0) return false

      // If "Other" is selected, must have text
      if (q.selectedOptions.includes('Other') && !q.otherText.trim()) {
        return false
      }

      return true
    })
  },

  getAnswers: () => {
    const { activeRequest, additionalDetails } = get()
    if (!activeRequest) return {}

    const answers: Record<string, string[]> = {}

    for (const q of activeRequest.questions) {
      answers[q.id] = q.selectedOptions.map(opt => {
        if (opt === 'Other') {
          return `Other: ${q.otherText}`
        }
        return opt
      })
    }

    // Add additional details as a special key if provided
    if (additionalDetails.trim()) {
      answers['_additionalDetails'] = [additionalDetails.trim()]
    }

    return answers
  },

  submitAnswers: async () => {
    const { activeRequest, additionalDetails, resolvedRequests } = get()
    if (!activeRequest) return {}

    const answers = get().getAnswers()

    // Move to resolved
    const newResolved = new Map(resolvedRequests)
    newResolved.set(activeRequest.id, {
      request: activeRequest,
      answers,
      additionalDetails: additionalDetails.trim() || undefined,
      resolvedAt: Date.now(),
    })

    set({
      activeRequest: null,
      additionalDetails: '',
      resolvedRequests: newResolved,
    })

    // Send response back to main process
    if (window.jelico?.clarification?.respond) {
      await window.jelico.clarification.respond(activeRequest.id, answers)
    }

    return answers
  },

  clearForConversation: (conversationId) => {
    const { activeRequest, resolvedRequests } = get()

    // Clear active if it matches
    if (activeRequest?.conversationId === conversationId) {
      set({ activeRequest: null })
    }

    // Clear resolved for this conversation
    const newResolved = new Map(resolvedRequests)
    for (const [id, resolved] of newResolved) {
      if (resolved.request.conversationId === conversationId) {
        newResolved.delete(id)
      }
    }

    set({ resolvedRequests: newResolved })
  },
}))
