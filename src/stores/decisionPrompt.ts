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
  id: number
  request: DecisionPromptRequest
  resolve: (result: DecisionPromptResult) => void
  detachAbortListener?: () => void
}

interface DecisionPromptState {
  activeRequest: DecisionPromptRequest | null
  activeEntry: QueuedDecisionPrompt | null
  queuedRequests: QueuedDecisionPrompt[]
  request: (request: DecisionPromptRequest, signal?: AbortSignal) => Promise<DecisionPromptResult>
  choose: (value: string) => void
  cancel: () => void
}

let decisionPromptIdCounter = 0

function createCanceledResult(request: DecisionPromptRequest): DecisionPromptResult {
  return {
    value: request.cancelValue
      || request.defaultValue
      || request.options[0]?.value
      || '',
    canceled: true,
  }
}

function detachAbortListener(entry: QueuedDecisionPrompt | null | undefined) {
  entry?.detachAbortListener?.()
  if (entry) {
    entry.detachAbortListener = undefined
  }
}

function getNextDecisionState(queue: QueuedDecisionPrompt[]) {
  const [nextActive, ...remainingQueue] = queue
  return {
    activeRequest: nextActive?.request ?? null,
    activeEntry: nextActive ?? null,
    queuedRequests: remainingQueue,
  }
}

export const useDecisionPromptStore = create<DecisionPromptState>((set, get) => ({
  activeRequest: null,
  activeEntry: null,
  queuedRequests: [],

  request: async (request, signal) => {
    return await new Promise<DecisionPromptResult>((resolve) => {
      const entry: QueuedDecisionPrompt = {
        id: ++decisionPromptIdCounter,
        request,
        resolve,
      }

      if (signal?.aborted) {
        resolve(createCanceledResult(request))
        return
      }

      const abortQueuedRequest = () => {
        const currentState = get()
        if (currentState.activeEntry?.id === entry.id) {
          detachAbortListener(entry)
          set(getNextDecisionState(currentState.queuedRequests))
          resolve(createCanceledResult(request))
          return
        }

        const nextQueue = currentState.queuedRequests.filter((queuedEntry) => queuedEntry.id !== entry.id)
        if (nextQueue.length !== currentState.queuedRequests.length) {
          detachAbortListener(entry)
          set({ queuedRequests: nextQueue })
          resolve(createCanceledResult(request))
        }
      }

      if (signal) {
        const onAbort = () => {
          abortQueuedRequest()
        }
        signal.addEventListener('abort', onAbort, { once: true })
        entry.detachAbortListener = () => {
          signal.removeEventListener('abort', onAbort)
        }
      }

      set((state) => {
        if (!state.activeEntry) {
          return {
            activeRequest: request,
            activeEntry: entry,
          }
        }

        return {
          queuedRequests: [
            ...state.queuedRequests,
            entry,
          ],
        }
      })
    })
  },

  choose: (value) => {
    const { activeEntry, queuedRequests } = get()
    if (!activeEntry) return

    detachAbortListener(activeEntry)
    set(getNextDecisionState(queuedRequests))
    activeEntry.resolve({
      value,
      canceled: activeEntry.request.cancelValue === value,
    })
  },

  cancel: () => {
    const { activeEntry, queuedRequests } = get()
    if (!activeEntry) return

    detachAbortListener(activeEntry)
    set(getNextDecisionState(queuedRequests))
    activeEntry.resolve(createCanceledResult(activeEntry.request))
  },
}))
