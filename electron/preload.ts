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
    delete: (id: string) => ipcRenderer.invoke('conversations:delete', id),
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
    stopStream: (channelId: string) => {
      ipcRenderer.send('ai:stop', channelId)
    },
    removeListeners: (channelId: string) => {
      ipcRenderer.removeAllListeners(`ai:chunk:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:end:${channelId}`)
      ipcRenderer.removeAllListeners(`ai:error:${channelId}`)
    },
  },
})
