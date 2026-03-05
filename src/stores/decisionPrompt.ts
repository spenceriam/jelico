import { create } from 'zustand'

export interface DecisionPromptOption {
  label: string
  value: string
  variant?: 'primary' | 'secondary' | 'danger'
}

export interface DecisionPromptRequest {
  title: string
  message: string
  detail?: string
  options: DecisionPromptOption[]
  defaultValue?: string
  cancelValue?: string
}

interface DecisionPromptResult {
  value: string
  canceled: boolean
}

interface DecisionPromptState {
  activeRequest: DecisionPromptRequest | null
  request: (request: DecisionPromptRequest) => Promise<DecisionPromptResult>
  choose: (value: string) => void
  cancel: () => void
}

let pendingResolver: ((result: DecisionPromptResult) => void) | null = null

function resolvePending(result: DecisionPromptResult) {
  if (pendingResolver) {
    const resolver = pendingResolver
    pendingResolver = null
    resolver(result)
  }
}

export const useDecisionPromptStore = create<DecisionPromptState>((set, get) => ({
  activeRequest: null,

  request: async (request) => {
    // Resolve any previous unresolved prompt as canceled to avoid hanging callers.
    if (pendingResolver) {
      const previous = get().activeRequest
      const fallbackValue = previous?.cancelValue
        || previous?.defaultValue
        || previous?.options?.[0]?.value
        || ''
      resolvePending({ value: fallbackValue, canceled: true })
    }

    return await new Promise<DecisionPromptResult>((resolve) => {
      pendingResolver = resolve
      set({ activeRequest: request })
    })
  },

  choose: (value) => {
    const request = get().activeRequest
    set({ activeRequest: null })
    if (request) {
      resolvePending({
        value,
        canceled: request.cancelValue === value,
      })
    }
  },

  cancel: () => {
    const request = get().activeRequest
    set({ activeRequest: null })
    if (request) {
      const fallbackValue = request.cancelValue
        || request.defaultValue
        || request.options[0]?.value
        || ''
      resolvePending({
        value: fallbackValue,
        canceled: true,
      })
    }
  },
}))
