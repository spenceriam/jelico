import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Check, AlertCircle, AlertTriangle, Settings as SettingsIcon, Archive, Database, Edit2, Loader2, Search, HardDrive, Eye, EyeOff, Shield, User, Palette } from 'lucide-react'
import { useProviderStore } from '../../stores/providers'
import { useUIStore } from '../../stores/ui'
import { useChatStore } from '../../stores/chat'
import { useContextStore } from '../../stores/context'
import { SkillManager } from '../Skills/SkillManager'
import { ShelvingUnitIcon } from '../Brand/ShelvingUnitIcon'
import { useSkillStore } from '../../stores/skills'
import { BackupSettings } from './BackupSettings'
import { GeneralSettings } from './GeneralSettings'
import { PermissionsSettings } from './PermissionsSettings'
import { ProfileSettings } from './ProfileSettings'
import { AppearanceSettings } from './AppearanceSettings'
import { ArchiveSettings } from './ArchiveSettings'
// MicrophoneSettings disabled - WASM crashes on Windows ARM64, will revisit later
// import { MicrophoneSettings } from './MicrophoneSettings'

type SettingsTab = 'profile' | 'appearance' | 'general' | 'archive' | 'providers' | 'permissions' | 'skills' | 'backup'

interface SettingsProps {
  onClose: () => void
}

interface OpenRouterModel {
  id: string
  name: string
}

function normalizeCapabilityProfiles(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringifyCapabilityProfiles(value: Record<string, unknown> | null): string {
  return JSON.stringify(value || null)
}

export function Settings({ onClose }: SettingsProps) {
  const { providers, deleteProvider, testConnection, updateProvider, setActiveModel, setActiveSelection, activeProviderId } = useProviderStore()
  const { openProviderSetup, settingsTab } = useUIStore()
  const { activeConversationId, addSystemNotification } = useChatStore((state) => ({
    activeConversationId: state.activeConversationId,
    addSystemNotification: state.addSystemNotification,
  }))
  const switchConversationModel = useContextStore((state) => state.switchConversationModel)
  const { loadSkills } = useSkillStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>(settingsTab || 'profile')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; message: string; status?: number }>
  >({})
  const testResultTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Edit provider state (name, endpoint, model)
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')
  const [editBaseUrlValue, setEditBaseUrlValue] = useState('')
  const [editModelValue, setEditModelValue] = useState('')
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const settingsContentRef = useRef<HTMLDivElement>(null)
  const providerCardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // API key state within provider edit form
  const [editApiKeyValue, setEditApiKeyValue] = useState('')
  const [editCapabilityProfilesValue, setEditCapabilityProfilesValue] = useState('')
  const [capabilityProfilesError, setCapabilityProfilesError] = useState<string | null>(null)
  const [showCurrentKey, setShowCurrentKey] = useState(false)
  const [currentApiKey, setCurrentApiKey] = useState<string | null>(null)
  const [loadingCurrentApiKey, setLoadingCurrentApiKey] = useState(false)
  const [invalidStoredApiKey, setInvalidStoredApiKey] = useState(false)

  useEffect(() => {
    void loadSkills()
  }, [])

  useEffect(() => {
    return () => {
      for (const timer of Object.values(testResultTimersRef.current)) {
        clearTimeout(timer)
      }
      testResultTimersRef.current = {}
    }
  }, [])

  const handleTest = async (id: string) => {
    if (testResultTimersRef.current[id]) {
      clearTimeout(testResultTimersRef.current[id])
      delete testResultTimersRef.current[id]
    }

    setTestResults(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setTestingId(id)
    const result = await testConnection(id)
    setTestResults(prev => ({ ...prev, [id]: result }))
    setTestingId(null)

    testResultTimersRef.current[id] = setTimeout(() => {
      setTestResults(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      delete testResultTimersRef.current[id]
    }, 5000)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this provider? This will remove the API key from your keychain.')) {
      await deleteProvider(id)
    }
  }

  const scrollProviderCardToTop = (providerId: string) => {
    requestAnimationFrame(() => {
      const container = settingsContentRef.current
      const card = providerCardRefs.current[providerId]
      if (!container || !card) return

      const containerRect = container.getBoundingClientRect()
      const cardRect = card.getBoundingClientRect()
      const nextTop = container.scrollTop + (cardRect.top - containerRect.top)
      container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
    })
  }

  const startEditingProvider = async (provider: any) => {
    if (testResultTimersRef.current[provider.id]) {
      clearTimeout(testResultTimersRef.current[provider.id])
      delete testResultTimersRef.current[provider.id]
    }
    setTestResults(prev => {
      if (!(provider.id in prev)) return prev
      const next = { ...prev }
      delete next[provider.id]
      return next
    })

    setEditingProviderId(provider.id)
    setEditNameValue(provider.name || '')
    setEditBaseUrlValue(provider.baseUrl || '')
    setEditModelValue(provider.defaultModel)
    setEditApiKeyValue('')
    const currentProfiles = normalizeCapabilityProfiles(provider.capabilityProfiles)
    setEditCapabilityProfilesValue(currentProfiles ? JSON.stringify(currentProfiles, null, 2) : '')
    setCapabilityProfilesError(null)
    setShowCurrentKey(false)
    setCurrentApiKey(null)
    setInvalidStoredApiKey(false)
    setModelSearch('')
    setOpenRouterModels([])
    scrollProviderCardToTop(provider.id)

    // Load current API key for inline editing
    let providerApiKey: string | null = null
    let keyLooksLikeModel = false
    setLoadingCurrentApiKey(true)
    try {
      providerApiKey = await window.jelico.keychain.getApiKey(provider.id)
      const normalizedStored = providerApiKey?.trim() || ''
      const normalizedModel = (provider.defaultModel || '').trim()
      keyLooksLikeModel = !!normalizedStored && normalizedStored === normalizedModel
      setInvalidStoredApiKey(keyLooksLikeModel)
      setCurrentApiKey(keyLooksLikeModel ? null : providerApiKey)
    } catch (error) {
      console.error('Failed to get API key:', error)
      setCurrentApiKey(null)
      setInvalidStoredApiKey(false)
      providerApiKey = null
      keyLooksLikeModel = false
    } finally {
      setLoadingCurrentApiKey(false)
    }

    // Fetch models for OpenRouter when key is available
    if (provider.type === 'openrouter') {
      setLoadingModels(true)
      try {
        if (providerApiKey && !keyLooksLikeModel) {
          const models = await window.jelico.providers.fetchOpenRouterModels(providerApiKey)
          setOpenRouterModels(models.map((m: any) => ({ id: m.id, name: m.name })))
        }
      } catch (error) {
        console.error('Failed to fetch OpenRouter models:', error)
      } finally {
        setLoadingModels(false)
      }
    }
  }

  const saveProviderEdit = async () => {
    if (!editingProviderId) return

    const currentProvider = providers.find((p) => p.id === editingProviderId)
    if (!currentProvider) return

    const trimmedName = editNameValue.trim()
    const trimmedBaseUrl = editBaseUrlValue.trim()
    const trimmedModel = editModelValue.trim()
    const normalizedCurrentBaseUrl = (currentProvider.baseUrl || '').trim()
    const resolvedName = trimmedName || currentProvider.name || 'Provider'
    const currentCapabilityProfiles = normalizeCapabilityProfiles(currentProvider.capabilityProfiles)
    const trimmedCapabilityProfiles = editCapabilityProfilesValue.trim()
    let parsedCapabilityProfiles: Record<string, unknown> | null = null

    if (trimmedCapabilityProfiles) {
      try {
        const parsed = JSON.parse(trimmedCapabilityProfiles)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setCapabilityProfilesError('Capability profiles must be a JSON object keyed by model id or pattern.')
          return
        }
        parsedCapabilityProfiles = parsed as Record<string, unknown>
      } catch {
        setCapabilityProfilesError('Capability profiles must be valid JSON.')
        return
      }
    }
    setCapabilityProfilesError(null)

    const providerChanged =
      resolvedName !== currentProvider.name ||
      trimmedBaseUrl !== normalizedCurrentBaseUrl ||
      trimmedModel !== currentProvider.defaultModel ||
      stringifyCapabilityProfiles(currentCapabilityProfiles) !== stringifyCapabilityProfiles(parsedCapabilityProfiles)

    const keyChanged = !!editApiKeyValue.trim()

    if (providerChanged) {
      await updateProvider(editingProviderId, {
        name: resolvedName,
        baseUrl: trimmedBaseUrl,
        defaultModel: trimmedModel,
        capabilityProfiles: parsedCapabilityProfiles,
      })
    }

    // Update active model if this is the active provider
    if (providerChanged && editingProviderId === activeProviderId && trimmedModel !== currentProvider.defaultModel) {
      await setActiveModel(trimmedModel)
    }

    if (keyChanged) {
      await window.jelico.keychain.setApiKey(editingProviderId, editApiKeyValue.trim())
    }

    setEditingProviderId(null)
    setEditNameValue('')
    setEditBaseUrlValue('')
    setEditModelValue('')
    setEditApiKeyValue('')
    setEditCapabilityProfilesValue('')
    setCapabilityProfilesError(null)
    setShowCurrentKey(false)
    setCurrentApiKey(null)
    setLoadingCurrentApiKey(false)
    setInvalidStoredApiKey(false)
    setOpenRouterModels([])
  }

  const isProviderEditDirty = (provider: any) => {
    const trimmedName = editNameValue.trim()
    const trimmedBaseUrl = editBaseUrlValue.trim()
    const trimmedModel = editModelValue.trim()
    const normalizedCurrentBaseUrl = (provider.baseUrl || '').trim()
    const resolvedName = trimmedName || provider.name || 'Provider'
    const currentCapabilityProfiles = normalizeCapabilityProfiles(provider.capabilityProfiles)

    let parsedCapabilityProfiles: Record<string, unknown> | null = null
    const trimmedCapabilityProfiles = editCapabilityProfilesValue.trim()
    if (trimmedCapabilityProfiles) {
      try {
        const parsed = JSON.parse(trimmedCapabilityProfiles)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return true
        }
        parsedCapabilityProfiles = parsed as Record<string, unknown>
      } catch {
        return true
      }
    }

    return (
      resolvedName !== provider.name ||
      trimmedBaseUrl !== normalizedCurrentBaseUrl ||
      trimmedModel !== provider.defaultModel ||
      stringifyCapabilityProfiles(currentCapabilityProfiles) !== stringifyCapabilityProfiles(parsedCapabilityProfiles) ||
      !!editApiKeyValue.trim()
    )
  }

  const handleEditProviderClick = async (provider: any) => {
    if (editingProviderId !== provider.id) {
      await startEditingProvider(provider)
      return
    }

    if (isProviderEditDirty(provider)) {
      await saveProviderEdit()
      return
    }

    cancelEditProvider()
  }

  const toggleProviderVisibility = async (provider: any) => {
    const willHide = !provider.hiddenFromSelector
    const providersAfterToggle = providers.map((p) =>
      p.id === provider.id
        ? { ...p, hiddenFromSelector: willHide }
        : p
    )
    const fallbackVisible =
      providersAfterToggle.find((p) => !p.hiddenFromSelector && !!p.defaultModel?.trim()) || null

    await updateProvider(provider.id, {
      hiddenFromSelector: willHide,
    })

    if (willHide && activeProviderId === provider.id && fallbackVisible) {
      setActiveSelection(fallbackVisible.id, fallbackVisible.defaultModel)

      if (activeConversationId) {
        try {
          await window.jelico.conversations.updateModelProvider(
            activeConversationId,
            fallbackVisible.id,
            fallbackVisible.defaultModel
          )
          await switchConversationModel(
            activeConversationId,
            fallbackVisible.id,
            fallbackVisible.defaultModel
          )
          addSystemNotification({
            type: 'model_changed',
            conversationId: activeConversationId,
            modelName: `${fallbackVisible.name} / ${fallbackVisible.defaultModel}`,
          })
        } catch (error) {
          console.warn('[Settings] Failed to switch conversation after hiding provider:', error)
        }
      }
    }
  }

  const cancelEditProvider = () => {
    setEditingProviderId(null)
    setEditNameValue('')
    setEditBaseUrlValue('')
    setEditModelValue('')
    setEditApiKeyValue('')
    setEditCapabilityProfilesValue('')
    setCapabilityProfilesError(null)
    setShowCurrentKey(false)
    setCurrentApiKey(null)
    setLoadingCurrentApiKey(false)
    setInvalidStoredApiKey(false)
    setOpenRouterModels([])
    setModelSearch('')
  }

  const filteredModels = openRouterModels.filter(m =>
    m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-surface rounded-lg shadow-xl w-full max-w-4xl mx-4 h-[82vh] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors ${
              activeTab === 'profile'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors ${
              activeTab === 'appearance'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Palette className="w-4 h-4" />
            Appearance
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors ${
              activeTab === 'general'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            General
          </button>
          <button
            onClick={() => setActiveTab('providers')}
            className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors ${
              activeTab === 'providers'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Database className="w-4 h-4" />
            Providers
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors ${
              activeTab === 'permissions'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Shield className="w-4 h-4" />
            Permissions
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors ${
              activeTab === 'skills'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <ShelvingUnitIcon className="w-4 h-4" />
            Skills
          </button>
          {/* Microphone tab disabled - WASM crashes on Windows ARM64 */}
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors ${
              activeTab === 'backup'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            Backup
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors ${
              activeTab === 'archive'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
        </div>

        {/* Content */}
        <div ref={settingsContentRef} className="flex-1 overflow-y-auto p-6">
          {activeTab === 'profile' && <ProfileSettings />}

          {activeTab === 'appearance' && <AppearanceSettings />}

          {activeTab === 'providers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-text-primary">Providers</h3>
                <button
                  onClick={() => {
                    onClose()
                    openProviderSetup()
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent text-accent-foreground rounded-lg hover:bg-accent-bright transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Provider
                </button>
              </div>

              {providers.length === 0 ? (
                <div className="text-center py-8 text-text-muted">
                  No providers configured
                </div>
              ) : (
                <div className="space-y-3">
                  {providers.map((provider) => (
                    <div
                      key={provider.id}
                      ref={(el) => { providerCardRefs.current[provider.id] = el }}
                      className="p-4 bg-bg-elevated rounded-lg border border-border"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-text-primary">
                              {provider.name}
                            </span>
                            {activeProviderId === provider.id && (
                              <span className="px-1.5 py-0.5 text-xs bg-accent/10 text-accent rounded">
                                Last used
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-text-secondary mt-1 flex items-center gap-2">
                            <span>{provider.type}</span>
                            <span>·</span>
                            <span className="font-mono text-xs">
                              {provider.defaultModel?.trim() ? provider.defaultModel : 'No model configured'}
                            </span>
                            <button
                              onClick={() => {
                                void handleEditProviderClick(provider)
                              }}
                              className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                              title={editingProviderId === provider.id ? 'Save and close editor' : 'Edit provider'}
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                          {(testingId === provider.id || testResults[provider.id]) && (
                            <div
                              className={`text-xs mt-1 break-words ${
                                testingId === provider.id
                                  ? 'text-text-muted'
                                  : testResults[provider.id].ok
                                    ? 'text-success'
                                    : 'text-error'
                              }`}
                            >
                              {testingId === provider.id
                                ? 'API test: In progress...'
                                : `API test: ${testResults[provider.id].message}${testResults[provider.id].status ? ` (HTTP ${testResults[provider.id].status})` : ''}`}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {testResults[provider.id] !== undefined && (
                            testResults[provider.id].ok ? (
                              <Check className="w-4 h-4 text-success" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-error" />
                            )
                          )}

                          {!provider.defaultModel?.trim() && (
                            <span
                              className="p-1.5 text-warning"
                              title="Missing! Missing model name/id"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </span>
                          )}

                          <button
                            onClick={() => handleTest(provider.id)}
                            disabled={testingId === provider.id}
                            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors disabled:opacity-50"
                          >
                            {testingId === provider.id ? 'Testing...' : 'Test'}
                          </button>

                          <button
                            onClick={() => {
                              void toggleProviderVisibility(provider)
                            }}
                            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                            title={
                              provider.hiddenFromSelector
                                ? 'Show in chat model selector'
                                : 'Hide from chat model selector'
                            }
                          >
                            {provider.hiddenFromSelector ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={() => handleDelete(provider.id)}
                            className="p-1.5 text-text-muted hover:text-error hover:bg-bg-hover rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Edit provider form */}
                      {editingProviderId === provider.id && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <label className="block text-sm font-medium text-text-secondary mb-2">
                            Display Name <span className="text-text-muted font-normal">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-bg-deep border border-border rounded focus:outline-none focus:border-accent text-text-primary mb-3"
                            placeholder={provider.name}
                          />

                          <label className="block text-sm font-medium text-text-secondary mb-2">
                            Endpoint URL <span className="text-text-muted font-normal">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={editBaseUrlValue}
                            onChange={(e) => setEditBaseUrlValue(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-bg-deep border border-border rounded focus:outline-none focus:border-accent text-text-primary font-mono mb-3"
                            placeholder="https://api.example.com/v1"
                          />

                          <label className="block text-sm font-medium text-text-secondary mb-2">
                            Default Model
                          </label>

                          {provider.type === 'openrouter' ? (
                            <div className="space-y-2">
                              {loadingModels ? (
                                <div className="flex items-center gap-2 text-text-muted py-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Loading models...</span>
                                </div>
                              ) : openRouterModels.length > 0 ? (
                                <>
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                    <input
                                      type="text"
                                      value={modelSearch}
                                      onChange={(e) => setModelSearch(e.target.value)}
                                      className="w-full px-3 py-2 pl-9 text-sm bg-bg-deep border border-border rounded focus:outline-none focus:border-accent text-text-primary"
                                      placeholder="Search models..."
                                    />
                                  </div>
                                  <div className="max-h-40 overflow-y-auto border border-border rounded bg-bg-deep">
                                    {filteredModels.slice(0, 30).map((model) => (
                                      <button
                                        key={model.id}
                                        type="button"
                                        onClick={() => setEditModelValue(model.id)}
                                        className={`w-full px-3 py-2 text-left text-sm hover:bg-bg-surface border-b border-border last:border-b-0 ${
                                          editModelValue === model.id ? 'bg-accent/10 text-accent' : 'text-text-primary'
                                        }`}
                                      >
                                        <div className="font-medium">{model.name}</div>
                                        <div className="text-xs text-text-muted font-mono">{model.id}</div>
                                      </button>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <input
                                  type="text"
                                  value={editModelValue}
                                  onChange={(e) => setEditModelValue(e.target.value)}
                                  className="w-full px-3 py-2 text-sm bg-bg-deep border border-border rounded focus:outline-none focus:border-accent text-text-primary font-mono"
                                  placeholder="Enter model ID..."
                                />
                              )}
                              {editModelValue && (
                                <p className="text-xs text-text-muted">
                                  Selected: <span className="font-mono">{editModelValue}</span>
                                </p>
                              )}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={editModelValue}
                              onChange={(e) => setEditModelValue(e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-bg-deep border border-border rounded focus:outline-none focus:border-accent text-text-primary font-mono"
                              placeholder="Enter model ID..."
                            />
                          )}

                          <div className="mt-3">
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                              Capability Profiles <span className="text-text-muted font-normal">(optional JSON map)</span>
                            </label>
                            <textarea
                              value={editCapabilityProfilesValue}
                              onChange={(e) => {
                                setEditCapabilityProfilesValue(e.target.value)
                                if (capabilityProfilesError) {
                                  setCapabilityProfilesError(null)
                                }
                              }}
                              className="w-full min-h-[110px] px-3 py-2 text-sm bg-bg-deep border border-border rounded focus:outline-none focus:border-accent text-text-primary font-mono resize-y"
                              placeholder={`{
  "*": {
    "toolUseGuidance": "normal",
    "reminderAggressiveness": "normal"
  },
  "gpt-4o-mini": {
    "maxRetries": 3,
    "delegationStyle": "parallel-first"
  }
}`}
                            />
                            {capabilityProfilesError ? (
                              <p className="mt-1 text-xs text-error">{capabilityProfilesError}</p>
                            ) : (
                              <p className="mt-1 text-xs text-text-muted">
                                Keys can be exact model IDs, substrings, or `*`. Values can include
                                `toolUseGuidance`, `reminderAggressiveness`, `maxRetries`,
                                `retryBaseDelayMs`, and `delegationStyle`.
                              </p>
                            )}
                          </div>

                          <div className="mt-3">
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                              API Key <span className="text-text-muted font-normal">(optional)</span>
                            </label>

                            {loadingCurrentApiKey ? (
                              <div className="flex items-center gap-2 text-text-muted py-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Loading key...</span>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {invalidStoredApiKey && (
                                  <p className="text-xs text-warning">
                                    Stored key looked like a model ID. Enter a new API key to replace it.
                                  </p>
                                )}

                                {currentApiKey && (
                                  <div className="p-3 bg-bg-deep border border-border rounded">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-text-muted">Current key:</span>
                                      <button
                                        type="button"
                                        onClick={() => setShowCurrentKey(!showCurrentKey)}
                                        className="p-1 text-text-muted hover:text-text-primary"
                                      >
                                        {showCurrentKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                      </button>
                                    </div>
                                    <code className="text-xs font-mono text-text-primary break-all">
                                      {showCurrentKey
                                        ? currentApiKey
                                        : `${currentApiKey.substring(0, 10)}${'•'.repeat(20)}`}
                                    </code>
                                  </div>
                                )}

                                <div>
                                  <label className="block text-xs text-text-muted mb-1">
                                    Enter new API key:
                                  </label>
                                  <input
                                    type="password"
                                    value={editApiKeyValue}
                                    onChange={(e) => setEditApiKeyValue(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-bg-deep border border-border rounded focus:outline-none focus:border-accent text-text-primary font-mono"
                                    placeholder="Leave blank to keep current key"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={saveProviderEdit}
                              className="px-3 py-1.5 text-sm bg-accent text-accent-foreground rounded hover:bg-accent-bright transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditProvider}
                              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'skills' && <SkillManager />}

          {activeTab === 'permissions' && <PermissionsSettings />}

          {activeTab === 'general' && <GeneralSettings />}

          {/* Microphone settings disabled - WASM crashes on Windows ARM64 */}

          {activeTab === 'backup' && <BackupSettings />}

          {activeTab === 'archive' && <ArchiveSettings />}
        </div>
      </div>
    </div>
  )
}
