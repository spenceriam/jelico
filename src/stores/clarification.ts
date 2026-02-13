/**
 * Clarification Store
 *
 * Conversation-scoped clarification state.
 * Requests and in-progress answers are isolated per conversation.
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
  // Active conversation context
  activeConversationId: string | null
  activeRequest: ClarificationRequest | null
  additionalDetails: string

  // Per-conversation pending state
  requestsByConversation: Record<string, ClarificationRequest>
  additionalDetailsByConversation: Record<string, string>

  // Resolved requests (for history, keyed by request ID)
  resolvedRequests: Map<string, {
    request: ClarificationRequest
    answers: Record<string, string[]>
    additionalDetails?: string
    resolvedAt: number
  }>

  // Actions
  setConversationId: (conversationId: string | null) => void
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
  activeConversationId: null,
  activeRequest: null,
  additionalDetails: '',
  requestsByConversation: {},
  additionalDetailsByConversation: {},
  resolvedRequests: new Map(),

  setConversationId: (conversationId) => {
    const nextRequest = conversationId ? get().requestsByConversation[conversationId] || null : null
    const nextAdditionalDetails = conversationId
      ? get().additionalDetailsByConversation[conversationId] || ''
      : ''

    set({
      activeConversationId: conversationId,
      activeRequest: nextRequest,
      additionalDetails: nextAdditionalDetails,
    })
  },

  setActiveRequest: (request) => {
    const { activeConversationId, requestsByConversation, additionalDetailsByConversation } = get()

    // Clear the active request for the current conversation.
    if (!request) {
      if (!activeConversationId) {
        set({ activeRequest: null, additionalDetails: '' })
        return
      }

      const nextRequests = { ...requestsByConversation }
      const nextAdditionalDetails = { ...additionalDetailsByConversation }
      delete nextRequests[activeConversationId]
      delete nextAdditionalDetails[activeConversationId]

      set({
        requestsByConversation: nextRequests,
        additionalDetailsByConversation: nextAdditionalDetails,
        activeRequest: null,
        additionalDetails: '',
      })
      return
    }

    const conversationId = request.conversationId
    const existingDetails = additionalDetailsByConversation[conversationId] || ''
    const nextRequests = {
      ...requestsByConversation,
      [conversationId]: request,
    }
    const nextAdditionalDetails = {
      ...additionalDetailsByConversation,
      [conversationId]: existingDetails,
    }

    if (conversationId !== activeConversationId) {
      set({
        requestsByConversation: nextRequests,
        additionalDetailsByConversation: nextAdditionalDetails,
      })
      return
    }

    set({
      requestsByConversation: nextRequests,
      additionalDetailsByConversation: nextAdditionalDetails,
      activeRequest: request,
      additionalDetails: existingDetails,
    })
  },

  setAdditionalDetails: (text) => {
    const { activeConversationId, additionalDetailsByConversation } = get()
    if (!activeConversationId) {
      set({ additionalDetails: text })
      return
    }

    set({
      additionalDetails: text,
      additionalDetailsByConversation: {
        ...additionalDetailsByConversation,
        [activeConversationId]: text,
      },
    })
  },

  selectOption: (questionId, optionLabel) => {
    const { activeRequest, requestsByConversation } = get()
    if (!activeRequest) return

    const updatedRequest: ClarificationRequest = {
      ...activeRequest,
      questions: activeRequest.questions.map((q) => {
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
            ? q.selectedOptions.filter((o) => o !== optionLabel)
            : [...q.selectedOptions, optionLabel],
        }
      }),
    }

    set({
      activeRequest: updatedRequest,
      requestsByConversation: {
        ...requestsByConversation,
        [updatedRequest.conversationId]: updatedRequest,
      },
    })
  },

  toggleOption: (questionId, optionLabel) => {
    const { activeRequest, requestsByConversation } = get()
    if (!activeRequest) return

    const updatedRequest: ClarificationRequest = {
      ...activeRequest,
      questions: activeRequest.questions.map((q) => {
        if (q.id !== questionId) return q

        const isSelected = q.selectedOptions.includes(optionLabel)
        return {
          ...q,
          selectedOptions: isSelected
            ? q.selectedOptions.filter((o) => o !== optionLabel)
            : [...q.selectedOptions, optionLabel],
        }
      }),
    }

    set({
      activeRequest: updatedRequest,
      requestsByConversation: {
        ...requestsByConversation,
        [updatedRequest.conversationId]: updatedRequest,
      },
    })
  },

  setOtherText: (questionId, text) => {
    const { activeRequest, requestsByConversation } = get()
    if (!activeRequest) return

    const updatedRequest: ClarificationRequest = {
      ...activeRequest,
      questions: activeRequest.questions.map((q) => {
        if (q.id !== questionId) return q
        return { ...q, otherText: text }
      }),
    }

    set({
      activeRequest: updatedRequest,
      requestsByConversation: {
        ...requestsByConversation,
        [updatedRequest.conversationId]: updatedRequest,
      },
    })
  },

  canSubmit: () => {
    const { activeRequest } = get()
    if (!activeRequest) return false

    // All questions must have at least one selection.
    return activeRequest.questions.every((q) => {
      if (q.selectedOptions.length === 0) return false

      // If "Other" is selected, text is required.
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
      answers[q.id] = q.selectedOptions.map((opt) => {
        if (opt === 'Other') {
          return `Other: ${q.otherText}`
        }
        return opt
      })
    }

    // Add additional details as a special key if provided.
    if (additionalDetails.trim()) {
      answers._additionalDetails = [additionalDetails.trim()]
    }

    return answers
  },

  submitAnswers: async () => {
    const {
      activeRequest,
      activeConversationId,
      additionalDetails,
      additionalDetailsByConversation,
      requestsByConversation,
      resolvedRequests,
    } = get()
    if (!activeRequest) return {}

    const answers = get().getAnswers()

    // Move to resolved.
    const newResolved = new Map(resolvedRequests)
    newResolved.set(activeRequest.id, {
      request: activeRequest,
      answers,
      additionalDetails: additionalDetails.trim() || undefined,
      resolvedAt: Date.now(),
    })

    const nextRequests = { ...requestsByConversation }
    delete nextRequests[activeRequest.conversationId]

    const nextAdditionalDetails = { ...additionalDetailsByConversation }
    delete nextAdditionalDetails[activeRequest.conversationId]

    const nextVisibleRequest = activeConversationId
      ? nextRequests[activeConversationId] || null
      : null
    const nextVisibleAdditionalDetails = activeConversationId
      ? nextAdditionalDetails[activeConversationId] || ''
      : ''

    set({
      requestsByConversation: nextRequests,
      additionalDetailsByConversation: nextAdditionalDetails,
      activeRequest: nextVisibleRequest,
      additionalDetails: nextVisibleAdditionalDetails,
      resolvedRequests: newResolved,
    })

    // Send response back to main process.
    if (window.jelico?.clarification?.respond) {
      await window.jelico.clarification.respond(activeRequest.id, answers)
    }

    return answers
  },

  clearForConversation: (conversationId) => {
    const { activeConversationId, resolvedRequests, requestsByConversation, additionalDetailsByConversation } = get()

    const nextRequests = { ...requestsByConversation }
    delete nextRequests[conversationId]

    const nextAdditionalDetails = { ...additionalDetailsByConversation }
    delete nextAdditionalDetails[conversationId]

    // Clear resolved for this conversation.
    const newResolved = new Map(resolvedRequests)
    for (const [id, resolved] of newResolved) {
      if (resolved.request.conversationId === conversationId) {
        newResolved.delete(id)
      }
    }

    if (activeConversationId === conversationId) {
      set({
        requestsByConversation: nextRequests,
        additionalDetailsByConversation: nextAdditionalDetails,
        resolvedRequests: newResolved,
        activeRequest: null,
        additionalDetails: '',
      })
      return
    }

    set({
      requestsByConversation: nextRequests,
      additionalDetailsByConversation: nextAdditionalDetails,
      resolvedRequests: newResolved,
    })
  },
}))
