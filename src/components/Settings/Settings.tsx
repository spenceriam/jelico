import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Check, AlertCircle, Settings as SettingsIcon, Zap, Database, Edit2, Loader2, Search, HardDrive } from 'lucide-react'
import { useProviderStore } from '../../stores/providers'
import { useUIStore } from '../../stores/ui'
import { SkillManager } from '../Skills/SkillManager'
import { useSkillStore } from '../../stores/skills'
import { BackupSettings } from './BackupSettings'
import { GeneralSettings } from './GeneralSettings'

type SettingsTab = 'general' | 'providers' | 'skills' | 'backup'

interface SettingsProps {
  onClose: () => void
}

interface OpenRouterModel {
  id: string
  name: string
}

export function Settings({ onClose }: SettingsProps) {
  const { providers, deleteProvider, testConnection, updateProvider, setActiveModel, activeProviderId } = useProviderStore()
  const { openProviderSetup, settingsTab } = useUIStore()
  const { loadSkills } = useSkillStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>(settingsTab || 'general')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})

  // Edit model state
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null)
  const [editModelValue, setEditModelValue] = useState('')
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelSearch, setModelSearch] = useState('')

  useEffect(() => {
    loadSkills()
  }, [])

  const handleTest = async (id: string) => {
    setTestingId(id)
    const result = await testConnection(id)
    setTestResults(prev => ({ ...prev, [id]: result }))
    setTestingId(null)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this provider? This will remove the API key from your keychain.')) {
      await deleteProvider(id)
    }
  }

  const startEditingModel = async (provider: any) => {
    setEditingProviderId(provider.id)
    setEditModelValue(provider.defaultModel)
    setModelSearch('')
    setOpenRouterModels([])

    // Fetch models for OpenRouter
    if (provider.type === 'openrouter') {
      setLoadingModels(true)
      try {
        const apiKey = await window.jelico.keychain.getApiKey(provider.id)
        if (apiKey) {
          const models = await window.jelico.providers.fetchOpenRouterModels(apiKey)
          setOpenRouterModels(models.map((m: any) => ({ id: m.id, name: m.name })))
        }
      } catch (error) {
        console.error('Failed to fetch OpenRouter models:', error)
      } finally {
        setLoadingModels(false)
      }
    }
  }

  const saveModelEdit = async () => {
    if (!editingProviderId || !editModelValue.trim()) return

    await updateProvider(editingProviderId, { defaultModel: editModelValue.trim() })
    // Update active model if this is the active provider
    if (editingProviderId === activeProviderId) {
      setActiveModel(editModelValue.trim())
    }
    setEditingProviderId(null)
    setEditModelValue('')
    setOpenRouterModels([])
  }

  const cancelEditModel = () => {
    setEditingProviderId(null)
    setEditModelValue('')
    setOpenRouterModels([])
    setModelSearch('')
  }

  const filteredModels = openRouterModels.filter(m =>
    m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-surface rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
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
            onClick={() => setActiveTab('skills')}
            className={`px-4 py-3 text-sm flex items-center gap-2 border-b-2 -mb-px transition-colors ${
              activeTab === 'skills'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Zap className="w-4 h-4" />
            Skills
          </button>
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'providers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-text-primary">Providers</h3>
                <button
                  onClick={() => {
                    onClose()
                    openProviderSetup()
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent text-black rounded-lg hover:bg-accent-bright transition-colors"
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
                      className="p-4 bg-bg-elevated rounded-lg border border-border"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-text-primary">
                              {provider.name}
                            </span>
                            {provider.isDefault && (
                              <span className="px-1.5 py-0.5 text-xs bg-accent/10 text-accent rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-text-secondary mt-1 flex items-center gap-2">
                            <span>{provider.type}</span>
                            <span>·</span>
                            <span className="font-mono text-xs">{provider.defaultModel}</span>
                            <button
                              onClick={() => startEditingModel(provider)}
                              className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                              title="Change model"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {testResults[provider.id] !== undefined && (
                            testResults[provider.id] ? (
                              <Check className="w-4 h-4 text-success" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-error" />
                            )
                          )}

                          <button
                            onClick={() => handleTest(provider.id)}
                            disabled={testingId === provider.id}
                            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors disabled:opacity-50"
                          >
                            {testingId === provider.id ? 'Testing...' : 'Test'}
                          </button>

                          <button
                            onClick={() => handleDelete(provider.id)}
                            className="p-1.5 text-text-muted hover:text-error hover:bg-bg-hover rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Edit model form */}
                      {editingProviderId === provider.id && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <label className="block text-sm font-medium text-text-secondary mb-2">
                            Change Model
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

                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={saveModelEdit}
                              disabled={!editModelValue.trim()}
                              className="px-3 py-1.5 text-sm bg-accent text-black rounded hover:bg-accent-bright transition-colors disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditModel}
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

          {activeTab === 'general' && <GeneralSettings />}

          {activeTab === 'backup' && <BackupSettings />}
        </div>
      </div>
    </div>
  )
}
