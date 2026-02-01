import { create } from 'zustand'
import type { AgentMode } from '../lib/modes'

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface SubAgent {
  id: string
  parentId?: string
  conversationId?: string  // Track which conversation this agent belongs to
  name: string
  displayName?: string     // Friendly display name like "Maya: Creating Wordle"
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
  addAgent: (params: {
    id: string
    name: string
    displayName?: string
    task: string
    mode?: AgentMode
    parentId?: string
    conversationId?: string
  }) => void
  getAgentsByConversation: (conversationId: string) => SubAgent[]
  clearAgentsByConversation: (conversationId: string) => void
  updateAgent: (id: string, updates: Partial<SubAgent>) => void
  addToolCall: (agentId: string, toolCall: SubAgent['toolCalls'][0]) => void
  updateToolCallResult: (agentId: string, toolCallId: string, result: unknown) => void
  setActiveAgent: (id: string | null) => void
  cancelAgent: (id: string) => void
  removeAgent: (id: string) => void
  clearCompletedAgents: () => void
}

/**
 * Frontend agent store
 *
 * This store tracks sub-agents for UI display purposes.
 * Agents are spawned and run in the main process (bi-directional communication).
 * The main process notifies the frontend via IPC events.
 */
export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  activeAgentId: null,

  // Add an agent (called when main process spawns one)
  addAgent: ({ id, name, displayName, task, mode = 'auto', parentId, conversationId }) => {
    const agent: SubAgent = {
      id,
      parentId,
      conversationId,
      name,
      displayName,
      task,
      mode,
      status: 'running', // Agents start running immediately in main process
      createdAt: Date.now(),
      startedAt: Date.now(),
      toolCalls: [],
    }

    set((state) => ({
      agents: [...state.agents, agent],
      activeAgentId: id,
    }))
  },

  // Get agents for a specific conversation
  getAgentsByConversation: (conversationId: string): SubAgent[] => {
    return get().agents.filter((a: SubAgent) => a.conversationId === conversationId)
  },

  // Clear agents when conversation is deleted/cleared
  clearAgentsByConversation: (conversationId: string) => {
    set((state) => ({
      agents: state.agents.filter((a: SubAgent) => a.conversationId !== conversationId),
    }))
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

  // Cancel agent (UI-side tracking - actual cancellation happens in main process)
  cancelAgent: (id) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id && a.status === 'running'
          ? { ...a, status: 'cancelled' as AgentStatus, completedAt: Date.now() }
          : a
      ),
    }))
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
