import { create } from 'zustand'
import type { AgentMode } from '../lib/modes'

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface SubAgent {
  id: string
  parentId?: string
  name: string
  task: string
  mode: AgentMode
  status: AgentStatus
  progress?: string
  result?: string
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  toolCalls: Array<{
    id: string
    name: string
    args: Record<string, unknown>
    result?: unknown
  }>
}

interface AgentStore {
  agents: SubAgent[]
  activeAgentId: string | null

  // Actions
  spawnAgent: (params: {
    name: string
    task: string
    mode?: AgentMode
    parentId?: string
  }) => string
  updateAgent: (id: string, updates: Partial<SubAgent>) => void
  addToolCall: (agentId: string, toolCall: SubAgent['toolCalls'][0]) => void
  updateToolCallResult: (agentId: string, toolCallId: string, result: unknown) => void
  setActiveAgent: (id: string | null) => void
  cancelAgent: (id: string) => void
  removeAgent: (id: string) => void
  clearCompletedAgents: () => void
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  activeAgentId: null,

  spawnAgent: ({ name, task, mode = 'auto', parentId }) => {
    const id = crypto.randomUUID()
    const agent: SubAgent = {
      id,
      parentId,
      name,
      task,
      mode,
      status: 'pending',
      createdAt: Date.now(),
      toolCalls: [],
    }

    set((state) => ({
      agents: [...state.agents, agent],
      activeAgentId: id,
    }))

    // Start the agent asynchronously
    startAgent(id, task, mode)

    return id
  },

  updateAgent: (id, updates) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    }))
  },

  addToolCall: (agentId, toolCall) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId
          ? { ...a, toolCalls: [...a.toolCalls, toolCall] }
          : a
      ),
    }))
  },

  updateToolCallResult: (agentId, toolCallId, result) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId
          ? {
              ...a,
              toolCalls: a.toolCalls.map((tc) =>
                tc.id === toolCallId ? { ...tc, result } : tc
              ),
            }
          : a
      ),
    }))
  },

  setActiveAgent: (id) => set({ activeAgentId: id }),

  cancelAgent: (id) => {
    const agent = get().agents.find((a) => a.id === id)
    if (agent && agent.status === 'running') {
      // Stop the stream if running
      if (agentStreams.has(id)) {
        window.jelico.ai.stopStream(agentStreams.get(id)!)
        agentStreams.delete(id)
      }
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === id
            ? { ...a, status: 'cancelled' as AgentStatus, completedAt: Date.now() }
            : a
        ),
      }))
    }
  },

  removeAgent: (id) => {
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      activeAgentId: state.activeAgentId === id ? null : state.activeAgentId,
    }))
  },

  clearCompletedAgents: () => {
    set((state) => ({
      agents: state.agents.filter(
        (a) => a.status !== 'completed' && a.status !== 'failed' && a.status !== 'cancelled'
      ),
    }))
  },
}))

// Track active agent streams for cancellation
const agentStreams = new Map<string, string>()

async function startAgent(agentId: string, task: string, mode: AgentMode) {
  const { updateAgent, addToolCall, updateToolCallResult } = useAgentStore.getState()

  // Mark as running
  updateAgent(agentId, {
    status: 'running',
    startedAt: Date.now(),
  })

  try {
    // Get active provider from provider store
    const providerStore = await import('./providers')
    const { activeProviderId, activeModel } = providerStore.useProviderStore.getState()

    if (!activeProviderId || !activeModel) {
      throw new Error('No active provider configured')
    }

    // Get workspace context
    const workspaceStore = await import('./workspaces')
    const { workspaces, activeWorkspaceId } = workspaceStore.useWorkspaceStore.getState()
    const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

    // Start streaming
    const channelId = window.jelico.ai.stream({
      providerId: activeProviderId,
      model: activeModel,
      mode,
      messages: [{ role: 'user', content: task }],
      workspacePath: activeWorkspace?.path,
    })

    agentStreams.set(agentId, channelId)

    let result = ''

    // Handle stream events
    window.jelico.ai.onStreamChunk(channelId, (chunk) => {
      result += chunk
      updateAgent(agentId, { progress: result })
    })

    window.jelico.ai.onToolCalls(channelId, (toolCalls) => {
      toolCalls.forEach((tc) => {
        addToolCall(agentId, {
          id: tc.toolCallId,
          name: tc.toolName,
          args: tc.args,
        })
      })
    })

    window.jelico.ai.onToolResults(channelId, (toolResults) => {
      toolResults.forEach((tr) => {
        updateToolCallResult(agentId, tr.toolCallId, tr.result)
      })
    })

    // Wait for completion
    await new Promise<void>((resolve, reject) => {
      window.jelico.ai.onStreamEnd(channelId, () => {
        window.jelico.ai.removeListeners(channelId)
        agentStreams.delete(agentId)
        resolve()
      })

      window.jelico.ai.onStreamError(channelId, (error) => {
        window.jelico.ai.removeListeners(channelId)
        agentStreams.delete(agentId)
        reject(new Error(error))
      })
    })

    // Mark as completed
    updateAgent(agentId, {
      status: 'completed',
      result,
      completedAt: Date.now(),
    })
  } catch (error: any) {
    // Mark as failed
    updateAgent(agentId, {
      status: 'failed',
      error: error.message,
      completedAt: Date.now(),
    })
  }
}
