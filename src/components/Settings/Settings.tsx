import { useState } from 'react'
import { X, Plus, Trash2, Check, AlertCircle } from 'lucide-react'
import { useProviderStore } from '../../stores/providers'
import { useUIStore } from '../../stores/ui'

interface SettingsProps {
  onClose: () => void
}

export function Settings({ onClose }: SettingsProps) {
  const { providers, deleteProvider, testConnection } = useProviderStore()
  const { openProviderSetup } = useUIStore()
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})

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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Providers section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-text-primary">Providers</h3>
                <button
                  onClick={() => {
                    onClose()
                    openProviderSetup()
                  }}
                  className="flex items-center gap-1 text-sm text-accent hover:text-accent-bright"
                >
                  <Plus className="w-4 h-4" />
                  Add provider
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
                        {/* Test result indicator */}
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

            {/* General section placeholder */}
            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-medium text-text-primary mb-4">General</h3>
              <div className="text-sm text-text-muted">
                More settings coming in future updates.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
