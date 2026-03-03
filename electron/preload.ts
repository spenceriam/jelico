import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('jelico', {
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    get: (id: string) => ipcRenderer.invoke('providers:get', id),
    create: (provider: any) => ipcRenderer.invoke('providers:create', provider),
    update: (id: string, updates: any) => ipcRenderer.invoke('providers:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('providers:delete', id),
    test: (id: string) => ipcRenderer.invoke('providers:test', id),
    previewModels: (type: string, apiKey: string, baseUrl?: string) =>
      ipcRenderer.invoke('providers:previewModels', type, apiKey, baseUrl),
    fetchOpenRouterModels: (apiKey: string) => ipcRenderer.invoke('providers:fetchOpenRouterModels', apiKey),
    getModelContextSize: (providerId: string, modelId: string) =>
      ipcRenderer.invoke('providers:getModelContextSize', providerId, modelId),
  },
  keychain: {
    setApiKey: (providerId: string, key: string) => ipcRenderer.invoke('keychain:set', providerId, key),
    getApiKey: (providerId: string) => ipcRenderer.invoke('keychain:get', providerId),
    deleteApiKey: (providerId: string) => ipcRenderer.invoke('keychain:delete', providerId),
  },
  conversations: {
    list: () => ipcRenderer.invoke('conversations:list'),
    get: (id: string) => ipcRenderer.invoke('conversations:get', id),
    create: (conversation: any) => ipcRenderer.invoke('conversations:create', conversation),
    addMessage: (convId: string, message: any) => ipcRenderer.invoke('conversations:addMessage', convId, message),
    deleteMessage: (messageId: string) => ipcRenderer.invoke('conversations:deleteMessage', messageId),
    updateMessage: (messageId: string, updates: any) => ipcRenderer.invoke('conversations:updateMessage', messageId, updates),
    updateTitle: (id: string, title: string) => ipcRenderer.invoke('conversations:updateTitle', id, title),
    updateWorkspaceId: (id: string, workspaceId: string | null) =>
      ipcRenderer.invoke('conversations:updateWorkspaceId', id, workspaceId),
    updateModelProvider: (id: string, providerId: string, model: string) =>
      ipcRenderer.invoke('conversations:updateModelProvider', id, providerId, model),
    transferToWorkspace: (id: string, workspaceId: string | null) =>
      ipcRenderer.invoke('conversations:transferToWorkspace', id, workspaceId),
    getArtifactCount: (id: string) => ipcRenderer.invoke('conversations:getArtifactCount', id),
    delete: (id: string) => ipcRenderer.invoke('conversations:delete', id),
  },
  workspaces: {
    list: () => ipcRenderer.invoke('workspaces:list'),
    get: (id: string) => ipcRenderer.invoke('workspaces:get', id),
    selectFolder: () => ipcRenderer.invoke('workspaces:selectFolder'),
    create: (input: any) => ipcRenderer.invoke('workspaces:create', input),
    update: (id: string, updates: any) => ipcRenderer.invoke('workspaces:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('workspaces:delete', id),
    refreshGit: (id: string) => ipcRenderer.invoke('workspaces:refreshGit', id),
    getConversations: (workspaceId: string) => ipcRenderer.invoke('workspaces:getConversations', workspaceId),
    getStructure: (workspaceId: string, maxDepth?: number) => ipcRenderer.invoke('workspaces:getStructure', workspaceId, maxDepth),
    // Git worktree operations
    listWorktrees: (workspaceId: string) => ipcRenderer.invoke('workspaces:listWorktrees', workspaceId),
    listBranches: (workspaceId: string) => ipcRenderer.invoke('workspaces:listBranches', workspaceId),
    createWorktree: (workspaceId: string, branch: string, targetPath?: string) =>
      ipcRenderer.invoke('workspaces:createWorktree', workspaceId, branch, targetPath),
    removeWorktree: (mainWorkspaceId: string, worktreePath: string) =>
      ipcRenderer.invoke('workspaces:removeWorktree', mainWorkspaceId, worktreePath),
  },
  artifacts: {
    list: () => ipcRenderer.invoke('artifacts:list'),
    get: (id: string) => ipcRenderer.invoke('artifacts:get', id),
    getByConversation: (conversationId: string) => ipcRenderer.invoke('artifacts:getByConversation', conversationId),
    getRevisions: (baseArtifactId: string) => ipcRenderer.invoke('artifacts:getRevisions', baseArtifactId),
    getLatestRevision: (baseArtifactId: string) => ipcRenderer.invoke('artifacts:getLatestRevision', baseArtifactId),
    create: (artifact: any) => ipcRenderer.invoke('artifacts:create', artifact),
    update: (id: string, updates: any) => ipcRenderer.invoke('artifacts:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('artifacts:delete', id),
    deleteByConversation: (conversationId: string) => ipcRenderer.invoke('artifacts:deleteByConversation', conversationId),
    // File-based artifact operations
    getFilePath: (id: string) => ipcRenderer.invoke('artifacts:getFilePath', id),
    reveal: (id: string) => ipcRenderer.invoke('artifacts:reveal', id),
    download: (id: string) => ipcRenderer.invoke('artifacts:download', id),
    getBasePath: () => ipcRenderer.invoke('artifacts:getBasePath'),
  },
  sandbox: {
    getPath: () => ipcRenderer.invoke('sandbox:getPath'),
    getConversationPath: (conversationId: string) => ipcRenderer.invoke('sandbox:getConversationPath', conversationId),
    listFiles: (conversationId: string) => ipcRenderer.invoke('sandbox:listFiles', conversationId),
    getStructure: (conversationId: string) => ipcRenderer.invoke('sandbox:getStructure', conversationId),
    writeFile: (conversationId: string, relativePath: string, content: string) =>
      ipcRenderer.invoke('sandbox:writeFile', conversationId, relativePath, content),
    readFile: (conversationId: string, relativePath: string) =>
      ipcRenderer.invoke('sandbox:readFile', conversationId, relativePath),
    deleteFile: (conversationId: string, relativePath: string) =>
      ipcRenderer.invoke('sandbox:deleteFile', conversationId, relativePath),
    clear: (conversationId: string) => ipcRenderer.invoke('sandbox:clear', conversationId),
    export: (conversationId: string) => ipcRenderer.invoke('sandbox:export', conversationId),
    exportToPath: (conversationId: string, destinationPath: string) =>
      ipcRenderer.invoke('sandbox:exportToPath', conversationId, destinationPath),
  },
  memory: {
    list: (scope?: string, scopeId?: string) => ipcRenderer.invoke('memory:list', scope, scopeId),
    get: (id: string) => ipcRenderer.invoke('memory:get', id),
    getForContext: (workspaceId?: string, conversationId?: string) =>
      ipcRenderer.invoke('memory:getForContext', workspaceId, conversationId),
    getGlobal: () => ipcRenderer.invoke('memory:getGlobal'),
    getByWorkspace: (workspaceId: string) => ipcRenderer.invoke('memory:getByWorkspace', workspaceId),
    getByConversation: (conversationId: string) => ipcRenderer.invoke('memory:getByConversation', conversationId),
    create: (memory: any) => ipcRenderer.invoke('memory:create', memory),
    update: (id: string, updates: any) => ipcRenderer.invoke('memory:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('memory:delete', id),
    deleteByScope: (scope: string, scopeId?: string) => ipcRenderer.invoke('memory:deleteByScope', scope, scopeId),
    decayConfidence: (decayRate?: number) => ipcRenderer.invoke('memory:decayConfidence', decayRate),
  },
  todos: {
    getByConversation: (conversationId: string) => ipcRenderer.invoke('todos:getByConversation', conversationId),
    replaceAll: (conversationId: string, todos: any[]) => ipcRenderer.invoke('todos:replaceAll', conversationId, todos),
    update: (conversationId: string, todoId: string, updates: any) => ipcRenderer.invoke('todos:update', conversationId, todoId, updates),
    deleteByConversation: (conversationId: string) => ipcRenderer.invoke('todos:deleteByConversation', conversationId),
    migrateFromLocalStorage: () => ipcRenderer.invoke('todos:migrateFromLocalStorage'),
  },
  permissions: {
    list: (workspaceId?: string) => ipcRenderer.invoke('permissions:list', workspaceId),
    get: (id: string) => ipcRenderer.invoke('permissions:get', id),
    check: (toolName: string, action: string, workspaceId?: string) =>
      ipcRenderer.invoke('permissions:check', toolName, action, workspaceId),
    create: (permission: any) => ipcRenderer.invoke('permissions:create', permission),
    update: (id: string, updates: any) => ipcRenderer.invoke('permissions:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('permissions:delete', id),
    deleteByWorkspace: (workspaceId: string) => ipcRenderer.invoke('permissions:deleteByWorkspace', workspaceId),
    clearOnce: () => ipcRenderer.invoke('permissions:clearOnce'),
    request: (request: any) => ipcRenderer.invoke('permissions:request', request),
    // New permission checker methods
    respond: (data: {
      requestId: string
      permission: 'allow_always' | 'allow_once' | 'deny'
      remember: boolean
      toolName: string
      action: string
      workspaceId?: string
    }) => ipcRenderer.invoke('permission:respond', data),
    getPendingRequests: () => ipcRenderer.invoke('permission:getPending'),
    getAllowAll: () => ipcRenderer.invoke('permission:getAllowAll'),
    setAllowAll: (allow: boolean) => ipcRenderer.invoke('permission:setAllowAll', allow),
    getSessionPermissions: () => ipcRenderer.invoke('permission:getSessionPermissions'),
    clearSessionPermissions: () => ipcRenderer.invoke('permission:clearSessionPermissions'),
    // Listen for permission requests from main process
    onPermissionRequest: (callback: (request: {
      requestId: string
      toolName: string
      action: string
      description: string
      preview?: string
      workspaceId?: string
    }) => void) => {
      const handler = (_: any, request: any) => callback(request)
      ipcRenderer.on('permission:request', handler)
      return () => ipcRenderer.removeListener('permission:request', handler)
    },
  },
  soul: {
    get: () => ipcRenderer.invoke('soul:get'),
    getPatterns: (category?: string) => ipcRenderer.invoke('soul:getPatterns', category),
    addPattern: (pattern: any) => ipcRenderer.invoke('soul:addPattern', pattern),
    updatePattern: (id: string, updates: any) => ipcRenderer.invoke('soul:updatePattern', id, updates),
    removePattern: (id: string) => ipcRenderer.invoke('soul:removePattern', id),
    getCorrections: () => ipcRenderer.invoke('soul:getCorrections'),
    addCorrection: (correction: any) => ipcRenderer.invoke('soul:addCorrection', correction),
    setPreference: (key: string, value: any, confidence?: number) =>
      ipcRenderer.invoke('soul:setPreference', key, value, confidence),
    getPreference: (key: string) => ipcRenderer.invoke('soul:getPreference', key),
    getAllPreferences: () => ipcRenderer.invoke('soul:getAllPreferences'),
    decayConfidence: () => ipcRenderer.invoke('soul:decayConfidence'),
    getContext: () => ipcRenderer.invoke('soul:getContext'),
    analyzeConversation: (messages: any[], metadata?: any) =>
      ipcRenderer.invoke('soul:analyzeConversation', messages, metadata),
  },
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import'),
    getStats: () => ipcRenderer.invoke('backup:getStats'),
    clearAll: () => ipcRenderer.invoke('backup:clearAll'),
  },
  speech: {
    getModels: () => ipcRenderer.invoke('speech:getModels'),
    getStatus: () => ipcRenderer.invoke('speech:getStatus'),
    setModel: (modelId: string) => ipcRenderer.invoke('speech:setModel', modelId),
    setLanguage: (language: string) => ipcRenderer.invoke('speech:setLanguage', language),
    isModelDownloaded: (modelId: string) => ipcRenderer.invoke('speech:isModelDownloaded', modelId),
    preload: () => ipcRenderer.invoke('speech:preload'),
    transcribe: (audioData: ArrayBuffer, options?: { language?: string }) =>
      ipcRenderer.invoke('speech:transcribe', audioData, options),
    onProgress: (callback: (progress: any) => void) => {
      const handler = (_: any, progress: any) => callback(progress)
      ipcRenderer.on('speech:progress', handler)
      return () => ipcRenderer.removeListener('speech:progress', handler)
    },
  },
  clarification: {
    respond: (requestId: string, answers: Record<string, string[]>) =>
      ipcRenderer.invoke('clarification:respond', requestId, answers),
    onRequest: (callback: (request: any) => void) => {
      const handler = (_: any, request: any) => callback(request)
      ipcRenderer.on('clarification:request', handler)
      return () => ipcRenderer.removeListener('clarification:request', handler)
    },
  },
  compaction: {
    getThresholds: () => ipcRenderer.invoke('compaction:getThresholds'),
    shouldCompact: (currentTokens: number, maxTokens: number) =>
      ipcRenderer.invoke('compaction:shouldCompact', currentTokens, maxTokens),
    getStatus: (currentTokens: number, maxTokens: number) =>
      ipcRenderer.invoke('compaction:getStatus', currentTokens, maxTokens),
    compact: (params: {
      conversationId: string
      providerId: string
      model: string
      customInstructions?: string
      forceCompact?: boolean
    }) => ipcRenderer.invoke('compaction:compact', params),
    onProgress: (callback: (progress: any) => void) => {
      const handler = (_: any, progress: any) => callback(progress)
      ipcRenderer.on('compaction:progress', handler)
      return () => ipcRenderer.removeListener('compaction:progress', handler)
    },
  },
  updates: {
    getCurrentVersion: () => ipcRenderer.invoke('updates:currentVersion'),
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    openRelease: (url: string) => ipcRenderer.invoke('updates:openRelease', url),
    onDownloadProgress: (callback: (progress: any) => void) => {
      const handler = (_: any, progress: any) => callback(progress)
      ipcRenderer.on('updates:download-progress', handler)
      return () => ipcRenderer.removeListener('updates:download-progress', handler)
    },
  },
  window: {
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    startDrag: (mouseScreenX: number, mouseScreenY: number) => ipcRenderer.invoke('window:startDrag', mouseScreenX, mouseScreenY),
    updateDrag: (mouseScreenX: number, mouseScreenY: number) => ipcRenderer.invoke('window:updateDrag', mouseScreenX, mouseScreenY),
    endDrag: () => ipcRenderer.invoke('window:endDrag'),
  },
  ai: {
    stream: (params: any) => {
      const channelId = crypto.randomUUID()
      ipcRenderer.send('ai:stream', channelId, params)
      return channelId
    },
    onStreamChunk: (channelId: string, callback: (chunk: string) => void) => {
      const handler = (_: any, chunk: string) => callback(chunk)
      ipcRenderer.on(`ai:chunk:${channelId}`, handler)
    },
    onStreamEnd: (channelId: string, callback: (stats?: { usage: { promptTokens: number; completionTokens: number; totalTokens: number }; finishReason: string }) => void) => {
      const handler = (_: any, stats: any) => callback(stats)
      ipcRenderer.on(`ai:end:${channelId}`, handler)
    },
    onStreamError: (channelId: string, callback: (error: string) => void) => {
      const handler = (_: any, error: string) => callback(error)
      ipcRenderer.on(`ai:error:${channelId}`, handler)
    },
    onToolCalls: (channelId: string, callback: (toolCalls: any[]) => void) => {
      const handler = (_: any, toolCalls: any[]) => callback(toolCalls)
      ipcRenderer.on(`ai:toolCalls:${channelId}`, handler)
    },
    onToolResults: (channelId: string, callback: (toolResults: any[]) => void) => {
      const handler = (_: any, toolResults: any[]) => callback(toolResults)
      ipcRenderer.on(`ai:toolResults:${channelId}`, handler)
    },
    onToolCallUpdate: (channelId: string, callback: (update: { id: string; name: string; args: Record<string, unknown>; status: string }) => void) => {
      const handler = (_: any, update: any) => callback(update)
      ipcRenderer.on(`ai:toolCallUpdate:${channelId}`, handler)
    },
    onArtifact: (channelId: string, callback: (artifact: any) => void) => {
      const handler = (_: any, artifact: any) => callback(artifact)
      ipcRenderer.on(`ai:artifact:${channelId}`, handler)
    },
    onSpawnAgent: (channelId: string, callback: (agent: any) => void) => {
      const handler = (_: any, agent: any) => callback(agent)
      ipcRenderer.on(`ai:spawnAgent:${channelId}`, handler)
    },
    onOrphanedAgents: (channelId: string, callback: (data: { count: number; agentIds: string[] }) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on(`ai:orphanedAgents:${channelId}`, handler)
    },
    onModeSwitch: (channelId: string, callback: (data: { fromMode: string; toMode: string; reason: string }) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on(`ai:modeSwitch:${channelId}`, handler)
    },
    onAgentProgress: (channelId: string, callback: (update: { agentId: string; status: string; progress?: string; result?: string; error?: string }) => void) => {
      const handler = (_: any, update: any) => callback(update)
      ipcRenderer.on(`ai:agentProgress:${channelId}`, handler)
    },
    onUpdateArtifact: (channelId: string, callback: (update: { id: string; updates: any }) => void) => {
      const handler = (_: any, update: any) => callback(update)
      ipcRenderer.on(`ai:updateArtifact:${channelId}`, handler)
    },
    onTodos: (channelId: string, callback: (todos: Array<{ id: string; text: string; status: 'pending' | 'in_progress' | 'done' }>) => void) => {
      const handler = (_: any, todos: any[]) => callback(todos)
      ipcRenderer.on(`ai:todos:${channelId}`, handler)
    },
    onToolInputProgress: (channelId: string, callback: (progress: { toolName: string; charCount: number }) => void) => {
      const handler = (_: any, progress: any) => callback(progress)
      ipcRenderer.on(`ai:toolInputProgress:${channelId}`, handler)
    },
    // Artifact preview streaming - shows content as it's being generated
    onArtifactPreview: (channelId: string, callback: (preview: { type?: string; title?: string; content: string }) => void) => {
      const handler = (_: any, preview: any) => callback(preview)
      ipcRenderer.on(`ai:artifactPreview:${channelId}`, handler)
    },
    // Sub-agent artifact creation (artifact completed, add to store)
    onSubAgentArtifact: (callback: (artifact: { type: string; title: string; content: string; language?: string; agentId: string; agentName: string; conversationId?: string }) => void) => {
      const handler = (_: any, artifact: any) => callback(artifact)
      ipcRenderer.on('ai:artifact:fromSubAgent', handler)
      return () => ipcRenderer.removeListener('ai:artifact:fromSubAgent', handler)
    },
    // Sub-agent artifact preview streaming
    onSubAgentArtifactPreview: (callback: (preview: { type?: string; title?: string; content: string }) => void) => {
      const handler = (_: any, preview: any) => callback(preview)
      ipcRenderer.on('ai:artifactPreview:subagent', handler)
      return () => ipcRenderer.removeListener('ai:artifactPreview:subagent', handler)
    },
    // Multiple artifacts status (for status line)
    onArtifactStatus: (callback: (status: { count: number; titles: string[]; activeTitle?: string }) => void) => {
      const handler = (_: any, status: any) => callback(status)
      ipcRenderer.on('artifact:status', handler)
      return () => ipcRenderer.removeListener('artifact:status', handler)
    },
    // Reasoning/thinking events for thinking models (Kimi K2.5, o1, o3, etc.)
    onReasoning: (channelId: string, callback: (data: { content: string; type: string }) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on(`ai:reasoning:${channelId}`, handler)
    },
    onReasoningStart: (channelId: string, callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on(`ai:reasoningStart:${channelId}`, handler)
    },
    onReasoningEnd: (channelId: string, callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on(`ai:reasoningEnd:${channelId}`, handler)
    },
    updateStreamMode: (channelId: string, mode: 'auto' | 'explore' | 'execute' | 'plan' | 'review') => {
      ipcRenderer.send('ai:updateStreamMode', channelId, mode)
    },
    stopStream: (channelId: string) => {
      ipcRenderer.send('ai:stop', channelId)
    },
    removeListeners: (channelId: string) => {
      ipcRenderer.removeAllListeners(`ai:chunk:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:end:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:error:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:toolCalls:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:toolCallUpdate:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:toolResults:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:artifact:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:spawnAgent:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:orphanedAgents:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:agentProgress:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:updateArtifact:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:todos:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:toolInputProgress:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:reasoning:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:reasoningStart:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:reasoningEnd:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:artifactPreview:${channelId}`)
    },
    generateTitle: (params: { providerId: string; model: string; userMessage: string; assistantMessage: string }): Promise<{ success: boolean; title?: string; error?: string }> => {
      return ipcRenderer.invoke('ai:generateTitle', params)
    },
    getAgentLimit: (conversationId: string): Promise<{ current: number; limit: number; remaining: number }> => {
      return ipcRenderer.invoke('ai:getAgentLimit', conversationId)
    },
    increaseAgentLimit: (params: { conversationId: string; additionalAgents?: number }): Promise<{ success: boolean; newLimit: number; current: number }> => {
      return ipcRenderer.invoke('ai:increaseAgentLimit', params)
    },
  },
})
