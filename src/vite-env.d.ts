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
      onStreamEnd: (channelId: string, callback: (stats?: StreamEndStats) => void) => void
      onStreamError: (channelId: string, callback: (error: string) => void) => void
      onToolCalls: (channelId: string, callback: (toolCalls: ToolCallEvent[]) => void) => void
      onToolResults: (channelId: string, callback: (toolResults: ToolResultEvent[]) => void) => void
      onArtifact: (channelId: string, callback: (artifact: ArtifactEvent) => void) => void
      onSpawnAgent: (channelId: string, callback: (agent: SpawnAgentEvent) => void) => void
      stopStream: (channelId: string) => void
      removeListeners: (channelId: string) => void
    }
    artifacts: {
      list: () => Promise<ArtifactRow[]>
      get: (id: string) => Promise<ArtifactRow | null>
      getByConversation: (conversationId: string) => Promise<ArtifactRow[]>
      create: (artifact: ArtifactInput) => Promise<ArtifactRow>
      update: (id: string, updates: Partial<ArtifactInput>) => Promise<ArtifactRow | null>
      delete: (id: string) => Promise<{ success: boolean }>
      deleteByConversation: (conversationId: string) => Promise<{ success: boolean }>
    }
    sandbox: {
      getPath: () => Promise<string>
      getConversationPath: (conversationId: string) => Promise<string>
      listFiles: (conversationId: string) => Promise<string[]>
      getStructure: (conversationId: string) => Promise<SandboxDirectoryEntry[]>
      writeFile: (conversationId: string, relativePath: string, content: string) => Promise<string>
      readFile: (conversationId: string, relativePath: string) => Promise<string | null>
      deleteFile: (conversationId: string, relativePath: string) => Promise<boolean>
      clear: (conversationId: string) => Promise<{ success: boolean }>
      export: (conversationId: string) => Promise<SandboxExportResult>
      exportToPath: (conversationId: string, destinationPath: string) => Promise<SandboxExportResult>
    }
    memory: {
      list: (scope?: MemoryScope, scopeId?: string) => Promise<MemoryRecord[]>
      get: (id: string) => Promise<MemoryRecord | null>
      getForContext: (workspaceId?: string, conversationId?: string) => Promise<MemoryRecord[]>
      getGlobal: () => Promise<MemoryRecord[]>
      getByWorkspace: (workspaceId: string) => Promise<MemoryRecord[]>
      getByConversation: (conversationId: string) => Promise<MemoryRecord[]>
      create: (memory: MemoryInput) => Promise<MemoryRecord>
      update: (id: string, updates: Partial<MemoryInput>) => Promise<MemoryRecord | null>
      delete: (id: string) => Promise<{ success: boolean }>
      deleteByScope: (scope: MemoryScope, scopeId?: string) => Promise<{ success: boolean }>
      decayConfidence: (decayRate?: number) => Promise<{ success: boolean }>
    }
    permissions: {
      list: (workspaceId?: string) => Promise<PermissionRecord[]>
      get: (id: string) => Promise<PermissionRecord | null>
      check: (toolName: string, action: string, workspaceId?: string) => Promise<PermissionAction | null>
      create: (permission: PermissionInput) => Promise<PermissionRecord>
      update: (id: string, updates: Partial<PermissionInput>) => Promise<PermissionRecord | null>
      delete: (id: string) => Promise<{ success: boolean }>
      deleteByWorkspace: (workspaceId: string) => Promise<{ success: boolean }>
      clearOnce: () => Promise<{ success: boolean }>
      request: (request: PermissionRequest) => Promise<PermissionRequestResult>
    }
    soul: {
      get: () => Promise<Soul>
      getPatterns: (category?: SoulPatternCategory) => Promise<SoulPattern[]>
      addPattern: (pattern: Omit<SoulPattern, 'id'>) => Promise<SoulPattern>
      updatePattern: (id: string, updates: Partial<SoulPattern>) => Promise<SoulPattern | null>
      removePattern: (id: string) => Promise<{ success: boolean }>
      getCorrections: () => Promise<SoulCorrection[]>
      addCorrection: (correction: Omit<SoulCorrection, 'id' | 'timestamp'>) => Promise<SoulCorrection>
      setPreference: (key: string, value: unknown, confidence?: number) => Promise<{ success: boolean }>
      getPreference: (key: string) => Promise<{ value: unknown; confidence: number } | null>
      getAllPreferences: () => Promise<Record<string, { value: unknown; confidence: number }>>
      decayConfidence: () => Promise<{ success: boolean }>
      getContext: () => Promise<string>
      analyzeConversation: (messages: Array<{ role: string; content: string }>, metadata?: {
        wasSuccessful?: boolean
        userFeedback?: string
      }) => Promise<SoulAnalysisResult>
    }
    backup: {
      export: () => Promise<BackupExportResult>
      import: () => Promise<BackupImportResult>
      getStats: () => Promise<BackupStats>
      clearAll: () => Promise<{ success: boolean; error?: string }>
    }
    speech: {
      getModels: () => Promise<WhisperModel[]>
      getStatus: () => Promise<SpeechModelStatus>
      setModel: (modelId: string) => Promise<{ success: boolean }>
      setLanguage: (language: string) => Promise<{ success: boolean }>
      isModelDownloaded: (modelId: string) => Promise<boolean>
      preload: () => Promise<{ success: boolean; error?: string }>
      transcribe: (audioData: ArrayBuffer, options?: { language?: string }) => Promise<TranscriptionResult>
      onProgress: (callback: (progress: TranscriptionProgress) => void) => () => void
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
  attachments?: MessageAttachmentData[]
  createdAt: number
}

interface MessageAttachmentData {
  id: string
  type: 'image' | 'text' | 'document'
  name: string
  mimeType: string
  data: string
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

interface StreamEndStats {
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason: string
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

interface ArtifactRow {
  id: string
  conversation_id: string | null
  type: string
  title: string
  content: string
  language: string | null
  file_path: string | null
  created_at: number
  updated_at: number
}

interface ArtifactInput {
  conversationId?: string
  type: string
  title: string
  content: string
  language?: string
  filePath?: string
}

interface SandboxDirectoryEntry {
  name: string
  type: 'file' | 'directory'
  path: string
  relativePath: string
  children?: SandboxDirectoryEntry[]
}

interface SandboxExportResult {
  success: boolean
  filesCopied?: number
  cancelled?: boolean
  error?: string
}

// Memory types
type MemoryScope = 'global' | 'workspace' | 'conversation'
type MemoryCategory = 'preference' | 'fact' | 'style' | 'correction' | 'workflow' | 'custom'
type MemorySource = 'explicit' | 'inferred'
type MemoryPrivacy = 'private' | 'shared'

interface MemoryRecord {
  id: string
  scope: MemoryScope
  scope_id: string | null
  category: MemoryCategory
  key: string
  value: string // JSON stringified
  confidence: number
  source: MemorySource
  privacy: MemoryPrivacy
  created_at: number
  updated_at: number
}

interface MemoryInput {
  scope: MemoryScope
  scopeId?: string
  category: MemoryCategory
  key: string
  value: unknown
  confidence?: number
  source?: MemorySource
  privacy?: MemoryPrivacy
}

// Permission types
type PermissionAction = 'allow_always' | 'allow_once' | 'deny'

interface PermissionRecord {
  id: string
  tool_name: string
  action_pattern: string
  permission: PermissionAction
  workspace_id: string | null
  created_at: number
  updated_at: number
}

interface PermissionInput {
  toolName: string
  actionPattern: string
  permission: PermissionAction
  workspaceId?: string
}

interface PermissionRequest {
  toolName: string
  action: string
  description: string
  workspaceId?: string
}

interface PermissionRequestResult {
  permission: PermissionAction
  cancelled: boolean
}

// Soul types
type SoulPatternCategory =
  | 'coding_style'
  | 'communication'
  | 'mistake'
  | 'preference'
  | 'workflow'
  | 'personality'

interface SoulPattern {
  id: string
  category: SoulPatternCategory
  pattern: string
  evidence: string[]
  confidence: number
  frequency: number
  lastObserved: number
  decay: number
  source: 'explicit' | 'inferred'
}

interface SoulCorrection {
  id: string
  original: string
  corrected: string
  context: string
  category: string
  timestamp: number
}

interface Soul {
  patterns: SoulPattern[]
  corrections: SoulCorrection[]
  preferences: Record<string, {
    value: unknown
    confidence: number
    updatedAt: number
  }>
  lastAnalyzedAt: number
  version: number
}

interface SoulAnalysisResult {
  newPatterns: SoulPattern[]
  updates: string[]
}

// Backup types
interface BackupExportResult {
  success: boolean
  filePath?: string
  cancelled?: boolean
  error?: string
}

interface BackupImportResult {
  success: boolean
  imported?: {
    database: boolean
    soul: boolean
  }
  cancelled?: boolean
  error?: string
}

interface BackupStats {
  dataPath: string
  database?: {
    providers: number
    conversations: number
    messages: number
    workspaces: number
    artifacts: number
    memories: number
    permissions: number
  }
  databaseSize?: number
  soul?: {
    patterns: number
    corrections: number
    preferences: number
  }
  soulSize?: number
}

// Speech types
interface WhisperModel {
  id: string
  name: string
  size: string
  speed: string
}

interface SpeechModelStatus {
  isLoaded: boolean
  isLoading: boolean
  currentModel: string
  error: string | null
}

interface TranscriptionProgress {
  status: 'loading' | 'transcribing' | 'done'
  progress?: number
  message?: string
}

interface TranscriptionResult {
  success: boolean
  result?: {
    text: string
    language?: string
    duration?: number
  }
  error?: string
}
