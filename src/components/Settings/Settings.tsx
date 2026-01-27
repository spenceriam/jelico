import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Check, AlertCircle, Settings as SettingsIcon, Zap, Database } from 'lucide-react'
import { useProviderStore } from '../../stores/providers'
import { useUIStore } from '../../stores/ui'
import { SkillManager } from '../Skills/SkillManager'
import { useSkillStore } from '../../stores/skills'

type SettingsTab = 'providers' | 'skills' | 'general'

interface SettingsProps {
  onClose: () => void
}

export function Settings({ onClose }: SettingsProps) {
  const { providers, deleteProvider, testConnection } = useProviderStore()
  const { openProviderSetup, settingsTab } = useUIStore()
  const { loadSkills } = useSkillStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>(settingsTab || 'providers')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})

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
                      className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg border border-border"
                    >
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
                        <div className="text-sm text-text-secondary mt-1">
                          {provider.type} · {provider.defaultModel}
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
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'skills' && <SkillManager />}

          {activeTab === 'general' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-text-primary">General</h3>
              <p className="text-sm text-text-muted">
                More settings coming in future updates.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
