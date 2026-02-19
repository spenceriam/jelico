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
      getModelContextSize: (providerId: string, modelId: string) => Promise<number | null>
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
      deleteMessage: (messageId: string) => Promise<{ success: boolean }>
      updateMessage: (messageId: string, updates: Partial<MessageInput>) => Promise<Message | null>
      updateTitle: (id: string, title: string) => Promise<void>
      updateWorkspaceId: (id: string, workspaceId: string | null) => Promise<Conversation | null>
      transferToWorkspace: (id: string, workspaceId: string | null) => Promise<{
        success: boolean
        transferred: number
        failed: number
        errors: string[]
        conversation: Conversation | null
      }>
      getArtifactCount: (id: string) => Promise<number>
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
    compaction: {
      getThresholds: () => Promise<CompactionThresholds>
      shouldCompact: (currentTokens: number, maxTokens: number) => Promise<boolean>
      getStatus: (currentTokens: number, maxTokens: number) => Promise<CompactionStatus>
      compact: (params: CompactionParams) => Promise<CompactionResult>
      onProgress: (callback: (progress: CompactionProgress) => void) => () => void
    }
    updates: {
      getCurrentVersion: () => Promise<string>
      check: () => Promise<UpdateInfo>
      download: () => Promise<UpdateDownloadResult>
      openRelease: (url: string) => Promise<boolean>
      onDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void
    }
    window: {
      toggleMaximize: () => Promise<{ success: boolean; state?: 'maximized' | 'restored'; error?: string }>
      startDrag: (mouseScreenX: number, mouseScreenY: number) => Promise<{ success: boolean; error?: string }>
      updateDrag: (mouseScreenX: number, mouseScreenY: number) => Promise<{ success: boolean; error?: string }>
      endDrag: () => Promise<{ success: boolean; error?: string }>
    }
    ai: {
      stream: (params: StreamParams) => string
      onStreamChunk: (channelId: string, callback: (chunk: string) => void) => void
      onStreamEnd: (channelId: string, callback: (stats?: StreamEndStats) => void) => void
      onStreamError: (channelId: string, callback: (error: string) => void) => void
      onToolCalls: (channelId: string, callback: (toolCalls: ToolCallEvent[]) => void) => void
      onToolResults: (channelId: string, callback: (toolResults: ToolResultEvent[]) => void) => void
      onToolCallUpdate: (channelId: string, callback: (update: ToolCallUpdateEvent) => void) => void
      onArtifact: (channelId: string, callback: (artifact: ArtifactEvent) => void) => void
      onSpawnAgent: (channelId: string, callback: (agent: SpawnAgentEvent) => void) => void
      onOrphanedAgents: (channelId: string, callback: (data: OrphanedAgentsEvent) => void) => void
      onModeSwitch: (channelId: string, callback: (data: ModeSwitchEvent) => void) => void
      onAgentProgress: (channelId: string, callback: (update: AgentProgressEvent) => void) => void
      onUpdateArtifact: (channelId: string, callback: (update: ArtifactUpdateEvent) => void) => void
      onTodos: (channelId: string, callback: (todos: TodoTask[]) => void) => void
      onToolInputProgress: (channelId: string, callback: (progress: { toolName: string; charCount: number }) => void) => void
      // Artifact preview streaming - shows content as it's being generated
      onArtifactPreview: (channelId: string, callback: (preview: ArtifactPreviewEvent) => void) => void
      // Sub-agent artifact creation (artifact completed, add to store)
      onSubAgentArtifact: (callback: (artifact: { type: string; title: string; content: string; language?: string; agentId: string; agentName: string; conversationId?: string }) => void) => () => void
      // Sub-agent artifact preview streaming
      onSubAgentArtifactPreview: (callback: (preview: ArtifactPreviewEvent) => void) => () => void
      // Multiple artifacts status (for status line)
      onArtifactStatus: (callback: (status: { count: number; titles: string[]; activeTitle?: string }) => void) => () => void
      // Reasoning/thinking events for thinking models (Kimi K2.5, o1, o3, etc.)
      onReasoning: (channelId: string, callback: (data: ReasoningEvent) => void) => void
      onReasoningStart: (channelId: string, callback: () => void) => void
      onReasoningEnd: (channelId: string, callback: () => void) => void
      stopStream: (channelId: string) => void
      removeListeners: (channelId: string) => void
      generateTitle: (params: GenerateTitleParams) => Promise<GenerateTitleResult>
      getAgentLimit: (conversationId: string) => Promise<AgentLimitInfo>
      increaseAgentLimit: (params: IncreaseAgentLimitParams) => Promise<IncreaseAgentLimitResult>
    }
    artifacts: {
      list: () => Promise<ArtifactRow[]>
      get: (id: string) => Promise<ArtifactRow | null>
      getByConversation: (conversationId: string) => Promise<ArtifactRow[]>
      create: (artifact: ArtifactInput) => Promise<ArtifactRow>
      update: (id: string, updates: Partial<ArtifactInput>) => Promise<ArtifactRow | null>
      delete: (id: string) => Promise<{ success: boolean }>
      deleteByConversation: (conversationId: string) => Promise<{ success: boolean }>
      getRevisions: (baseArtifactId: string) => Promise<ArtifactRow[]>
      getLatestRevision: (baseArtifactId: string) => Promise<ArtifactRow | null>
      // File-based artifact operations
      getFilePath: (id: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
      reveal: (id: string) => Promise<{ success: boolean; error?: string }>
      download: (id: string) => Promise<{ success: boolean; savedTo?: string; canceled?: boolean; error?: string }>
      getBasePath: () => Promise<{ success: boolean; basePath: string }>
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
    todos: {
      getByConversation: (conversationId: string) => Promise<TodoTask[]>
      replaceAll: (conversationId: string, todos: TodoTask[]) => Promise<{ success: boolean }>
      update: (conversationId: string, todoId: string, updates: Partial<TodoTask>) => Promise<{ success: boolean; todo?: TodoTask }>
      deleteByConversation: (conversationId: string) => Promise<{ success: boolean }>
      migrateFromLocalStorage: () => Promise<{ success: boolean; migrated: number }>
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
      // New permission checker methods
      respond: (data: PermissionRespondData) => Promise<{ success: boolean }>
      getPendingRequests: () => Promise<MainProcessPermissionRequest | null>
      getAllowAll: () => Promise<boolean>
      setAllowAll: (allow: boolean) => Promise<{ success: boolean }>
      getSessionPermissions: () => Promise<Array<{ key: string; permission: PermissionAction }>>
      clearSessionPermissions: () => Promise<{ success: boolean }>
      onPermissionRequest: (callback: (request: MainProcessPermissionRequest) => void) => () => void
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
    clarification: {
      respond: (requestId: string, answers: Record<string, string[]>) => Promise<{ success: boolean }>
      onRequest: (callback: (request: ClarificationRequest) => void) => () => void
    }
  }
}

interface ProviderConfig {
  id: string
  type: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter' | 'custom' | 'local' | 'zai' | 'zai-china' | 'zai-coding' | 'zai-coding-china' | 'openai-compatible' | 'anthropic-compatible'
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
  segments?: MessageSegmentData[]
  attachments?: MessageAttachmentData[]
  toolCalls?: ToolCallEvent[]
  toolResults?: ToolResultEvent[]
  usage?: MessageUsageData
  createdAt: number
}

type MessageSegmentData =
  | { type: 'text'; content: string }
  | { type: 'tool'; toolCallId: string }

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
  createdAt?: number
  segments?: MessageSegmentData[]
  toolCalls?: ToolCallEvent[]
  toolResults?: ToolResultEvent[]
  attachments?: MessageAttachmentData[]
  usage?: MessageUsageData
}

interface MessageUsageData {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  tokensPerSecond?: number
  durationMs?: number
  mode?: 'auto' | 'explore' | 'execute' | 'plan' | 'review'
  model?: string
}

interface StreamParams {
  providerId: string
  model?: string
  mode?: 'auto' | 'explore' | 'execute' | 'plan' | 'review'
  messages: Array<{ role: string; content: string }>
  tools?: ToolDefinition[]
  workspacePath?: string
  artifacts?: ArtifactContext[]
  conversationId?: string  // Track which conversation this stream belongs to
}

interface ArtifactContext {
  id: string
  type: string
  title: string
  language?: string
  preview: string
}

interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

interface ToolCallEvent {
  id: string
  name: string
  args: Record<string, unknown>
  status?: 'starting' | 'executing' | 'complete' | 'error' | 'canceled' | 'cancelled'
}

interface ToolCallUpdateEvent {
  id: string
  name: string
  args: Record<string, unknown>
  status: 'starting' | 'executing' | 'complete' | 'error' | 'canceled' | 'cancelled'
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
  id: string
  name: string
  displayName?: string  // Friendly name like "Maya: Creating Wordle"
  task: string
  mode: 'auto' | 'explore' | 'execute' | 'plan' | 'review'
}

interface OrphanedAgentsEvent {
  count: number
  agentIds: string[]
}

interface ModeSwitchEvent {
  fromMode: 'auto' | 'explore' | 'execute' | 'plan' | 'review'
  toMode: 'auto' | 'explore' | 'execute' | 'plan' | 'review'
  reason: string
}

interface TodoTask {
  id: string
  text: string
  status: 'pending' | 'in_progress' | 'done'
}

interface ReasoningEvent {
  content: string
  type: 'reasoning' | 'reasoning-delta' | 'thinking' | 'thinking-delta'
}

interface ArtifactPreviewEvent {
  type?: string
  title?: string
  content: string
}

interface AgentProgressEvent {
  agentId: string
  status: string
  displayName?: string  // Friendly name for UI display
  progress?: string
  result?: string
  error?: string
  toolCalls?: Array<{
    id: string
    name: string
    input: Record<string, unknown>
    output?: unknown
  }>
  // Latest self-reported status update from agent
  latestUpdate?: {
    message: string
    phase?: string
    timestamp: number
  }
}

interface ArtifactUpdateEvent {
  id: string
  updates: {
    title?: string
    content: string
    language?: string
  }
}

interface StreamEndStats {
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason: string
}

interface GenerateTitleParams {
  providerId: string
  model: string
  userMessage: string
  assistantMessage: string
}

interface GenerateTitleResult {
  success: boolean
  title?: string
  error?: string
}

interface AgentLimitInfo {
  current: number
  limit: number
  remaining: number
}

interface IncreaseAgentLimitParams {
  conversationId: string
  additionalAgents?: number
}

interface IncreaseAgentLimitResult {
  success: boolean
  newLimit: number
  current: number
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
  isWorktree?: boolean
  projectPath?: string
  gitBranch?: string
  createdAt: number
  updatedAt: number
}

interface WorkspaceInput {
  name?: string
  path: string
  isWorktree?: boolean
  projectPath?: string
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
  // Versioning fields (may be undefined in older records)
  base_artifact_id?: string | null
  revision?: number
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

interface PermissionRespondData {
  requestId: string
  permission: PermissionAction
  remember: boolean
  toolName: string
  action: string
  workspaceId?: string
}

interface MainProcessPermissionRequest {
  requestId: string
  toolName: string
  action: string
  description: string
  preview?: string
  workspaceId?: string
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
  status: 'loading' | 'transcribing' | 'done' | 'error'
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

// Compaction types
interface CompactionThresholds {
  WARNING: number
  COMPACT: number
  CRITICAL: number
}

type CompactionStatus = 'normal' | 'warning' | 'compact' | 'critical'

interface CompactionParams {
  conversationId: string
  providerId: string
  model: string
  customInstructions?: string
  forceCompact?: boolean
}

interface CompactionResult {
  success: boolean
  tokensBefore?: number
  tokensAfter?: number
  messagesBefore?: number
  messagesAfter?: number
  error?: string
}

interface CompactionProgress {
  status: 'compacting' | 'saving' | 'complete'
  message: string
  tokensBefore?: number
  tokensAfter?: number
}

// Update types
interface UpdateAssetInfo {
  name: string
  url: string
  size: number
}

interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  isUpdateAvailable: boolean
  releaseUrl: string
  publishedAt: string
  assets: UpdateAssetInfo[]
  recommendedAsset?: UpdateAssetInfo | null
}

interface UpdateDownloadProgress {
  received: number
  total: number
  percent: number | null
}

interface UpdateDownloadResult {
  canceled?: boolean
  savedTo?: string
  error?: string
}

// Clarification types (for AskUserQuestion tool)
interface ClarificationOption {
  label: string
  description?: string
}

interface ClarificationQuestionInput {
  question: string
  options: ClarificationOption[]
  multiSelect: boolean
}

interface ClarificationRequest {
  id: string
  subject: string
  questions: Array<{
    id: string
    question: string
    header?: string
    options: ClarificationOption[]
    multiSelect: boolean
    selectedOptions: string[]
    otherText: string
  }>
  conversationId: string
  createdAt: number
}
