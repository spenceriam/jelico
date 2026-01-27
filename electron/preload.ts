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
    fetchOpenRouterModels: (apiKey: string) => ipcRenderer.invoke('providers:fetchOpenRouterModels', apiKey),
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
    updateTitle: (id: string, title: string) => ipcRenderer.invoke('conversations:updateTitle', id, title),
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
    create: (artifact: any) => ipcRenderer.invoke('artifacts:create', artifact),
    update: (id: string, updates: any) => ipcRenderer.invoke('artifacts:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('artifacts:delete', id),
    deleteByConversation: (conversationId: string) => ipcRenderer.invoke('artifacts:deleteByConversation', conversationId),
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
    onStreamEnd: (channelId: string, callback: () => void) => {
      const handler = () => callback()
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
    onArtifact: (channelId: string, callback: (artifact: any) => void) => {
      const handler = (_: any, artifact: any) => callback(artifact)
      ipcRenderer.on(`ai:artifact:${channelId}`, handler)
    },
    onSpawnAgent: (channelId: string, callback: (agent: any) => void) => {
      const handler = (_: any, agent: any) => callback(agent)
      ipcRenderer.on(`ai:spawnAgent:${channelId}`, handler)
    },
    stopStream: (channelId: string) => {
      ipcRenderer.send('ai:stop', channelId)
    },
    removeListeners: (channelId: string) => {
      ipcRenderer.removeAllListeners(`ai:chunk:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:end:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:error:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:toolCalls:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:toolResults:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:artifact:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:spawnAgent:${channelId}`)
    },
  },
})
