/// <reference types="vite/client" />

interface Window {
  jelico: {
    providers: {
      list: () => Promise<ProviderConfig[]>
      get: (id: string) => Promise<ProviderConfig | null>
      create: (provider: ProviderInput) => Promise<ProviderConfig>
      update: (id: string, updates: Partial<ProviderInput>) => Promise<ProviderConfig>
      delete: (id: string) => Promise<void>
      test: (id: string) => Promise<boolean>
      fetchOpenRouterModels: (apiKey: string) => Promise<OpenRouterModel[]>
    }
    keychain: {
      setApiKey: (providerId: string, key: string) => Promise<void>
      getApiKey: (providerId: string) => Promise<string | null>
      deleteApiKey: (providerId: string) => Promise<void>
    }
    conversations: {
      list: () => Promise<Conversation[]>
      get: (id: string) => Promise<Conversation | null>
      create: (conversation: ConversationInput) => Promise<Conversation>
      addMessage: (convId: string, message: MessageInput) => Promise<Message>
      updateTitle: (id: string, title: string) => Promise<void>
      delete: (id: string) => Promise<void>
    }
    workspaces: {
      list: () => Promise<Workspace[]>
      get: (id: string) => Promise<Workspace | null>
      selectFolder: () => Promise<Workspace | null>
      create: (input: WorkspaceInput) => Promise<Workspace>
      update: (id: string, updates: Partial<WorkspaceInput>) => Promise<Workspace | null>
      delete: (id: string) => Promise<void>
      refreshGit: (id: string) => Promise<Workspace | null>
      getConversations: (workspaceId: string) => Promise<Conversation[]>
      getStructure: (workspaceId: string, maxDepth?: number) => Promise<DirectoryEntry[] | null>
      // Git worktree operations
      listWorktrees: (workspaceId: string) => Promise<GitWorktree[]>
      listBranches: (workspaceId: string) => Promise<GitBranch[]>
      createWorktree: (workspaceId: string, branch: string, targetPath?: string) => Promise<Workspace>
      removeWorktree: (mainWorkspaceId: string, worktreePath: string) => Promise<boolean>
    }
    ai: {
      stream: (params: StreamParams) => string
      onStreamChunk: (channelId: string, callback: (chunk: string) => void) => void
      onStreamEnd: (channelId: string, callback: () => void) => void
      onStreamError: (channelId: string, callback: (error: string) => void) => void
      onToolCalls: (channelId: string, callback: (toolCalls: ToolCallEvent[]) => void) => void
      onToolResults: (channelId: string, callback: (toolResults: ToolResultEvent[]) => void) => void
      onArtifact: (channelId: string, callback: (artifact: ArtifactEvent) => void) => void
      onSpawnAgent: (channelId: string, callback: (agent: SpawnAgentEvent) => void) => void
      stopStream: (channelId: string) => void
      removeListeners: (channelId: string) => void
    }
  }
}

interface ProviderConfig {
  id: string
  type: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter' | 'custom'
  name: string
  baseUrl?: string
  defaultModel: string
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

interface ProviderInput {
  type: ProviderConfig['type']
  name: string
  baseUrl?: string
  defaultModel: string
  isDefault?: boolean
}

interface Conversation {
  id: string
  title: string
  workspaceId?: string
  model: string
  providerId: string
  createdAt: number
  updatedAt: number
  messages?: Message[]
}

interface ConversationInput {
  title: string
  model: string
  providerId: string
  workspaceId?: string
}

interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
}

interface MessageInput {
  role: Message['role']
  content: string
}

interface StreamParams {
  providerId: string
  model?: string
  mode?: 'auto' | 'explore' | 'execute' | 'plan' | 'review'
  messages: Array<{ role: string; content: string }>
  tools?: ToolDefinition[]
  workspacePath?: string
}

interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

interface ToolCallEvent {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

interface ToolResultEvent {
  toolCallId: string
  result: unknown
}

interface ArtifactEvent {
  type: 'code' | 'document' | 'html' | 'svg' | 'mermaid'
  title: string
  content: string
  language?: string
}

interface SpawnAgentEvent {
  name: string
  task: string
  mode: 'auto' | 'explore' | 'execute' | 'plan' | 'review'
}

interface OpenRouterModel {
  id: string
  name: string
  contextLength?: number
  pricing?: { prompt: string; completion: string }
}

interface Workspace {
  id: string
  name: string
  path: string
  isGit: boolean
  gitBranch?: string
  createdAt: number
  updatedAt: number
}

interface WorkspaceInput {
  name?: string
  path: string
}

interface DirectoryEntry {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: DirectoryEntry[]
}

interface GitWorktree {
  path: string
  branch: string
  isBare: boolean
}

interface GitBranch {
  name: string
  isRemote: boolean
  isCurrent: boolean
}
