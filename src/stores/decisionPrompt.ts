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

interface QueuedDecisionPrompt {
  request: DecisionPromptRequest
  resolve: (result: DecisionPromptResult) => void
}

interface DecisionPromptState {
  activeRequest: DecisionPromptRequest | null
  activeResolve: ((result: DecisionPromptResult) => void) | null
  queuedRequests: QueuedDecisionPrompt[]
  request: (request: DecisionPromptRequest) => Promise<DecisionPromptResult>
  choose: (value: string) => void
  cancel: () => void
}

function getNextDecisionState(queue: QueuedDecisionPrompt[]) {
  const [nextActive, ...remainingQueue] = queue
  return {
    activeRequest: nextActive?.request ?? null,
    activeResolve: nextActive?.resolve ?? null,
    queuedRequests: remainingQueue,
  }
}

export const useDecisionPromptStore = create<DecisionPromptState>((set, get) => ({
  activeRequest: null,
  activeResolve: null,
  queuedRequests: [],

  request: async (request) => {
    return await new Promise<DecisionPromptResult>((resolve) => {
      set((state) => {
        if (!state.activeRequest) {
          return {
            activeRequest: request,
            activeResolve: resolve,
          }
        }

        return {
          queuedRequests: [
            ...state.queuedRequests,
            { request, resolve },
          ],
        }
      })
    })
  },

  choose: (value) => {
    const { activeRequest, activeResolve, queuedRequests } = get()
    if (!activeRequest || !activeResolve) return

    set(getNextDecisionState(queuedRequests))
    activeResolve({
      value,
      canceled: activeRequest.cancelValue === value,
    })
  },

  cancel: () => {
    const { activeRequest, activeResolve, queuedRequests } = get()
    if (!activeRequest || !activeResolve) return

    const fallbackValue = activeRequest.cancelValue
      || activeRequest.defaultValue
      || activeRequest.options[0]?.value
      || ''

    set(getNextDecisionState(queuedRequests))
    activeResolve({
      value: fallbackValue,
      canceled: true,
    })
  },
}))
