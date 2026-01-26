import { useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { useProviderStore } from '../../stores/providers'
import { ProviderConfigForm } from './ProviderConfigForm'

const PROVIDER_TYPES = [
  {
    type: 'anthropic' as const,
    name: 'Anthropic',
    description: 'Claude models',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  {
    type: 'openai' as const,
    name: 'OpenAI',
    description: 'GPT models',
    defaultModel: 'gpt-4o',
  },
  {
    type: 'google' as const,
    name: 'Google',
    description: 'Gemini models',
    defaultModel: 'gemini-1.5-pro',
  },
  {
    type: 'ollama' as const,
    name: 'Ollama',
    description: 'Local models',
    defaultModel: 'llama3.1',
  },
  {
    type: 'openrouter' as const,
    name: 'OpenRouter',
    description: 'Multiple providers',
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },
  {
    type: 'custom' as const,
    name: 'Custom',
    description: 'OpenAI-compatible API',
    defaultModel: 'gpt-4',
  },
]

interface ProviderSetupProps {
  isModal?: boolean
  onComplete: () => void
  onCancel?: () => void
}

export function ProviderSetup({ isModal, onComplete, onCancel }: ProviderSetupProps) {
  const [selectedType, setSelectedType] = useState<typeof PROVIDER_TYPES[number] | null>(null)
  const { addProvider } = useProviderStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleProviderSave = async (config: {
    name: string
    apiKey: string
    defaultModel: string
    baseUrl?: string
  }) => {
    if (!selectedType) return

    setIsLoading(true)
    setError(null)

    try {
      await addProvider({
        type: selectedType.type,
        name: config.name || selectedType.name,
        apiKey: config.apiKey,
        defaultModel: config.defaultModel,
        baseUrl: config.baseUrl,
        isDefault: true,
      })
      onComplete()
    } catch (err: any) {
      setError(err.message || 'Failed to add provider')
    } finally {
      setIsLoading(false)
    }
  }

  // Provider selection view
  if (!selectedType) {
    return (
      <div className={`${isModal ? '' : 'min-h-screen'} bg-bg-void flex items-center justify-center p-8`}>
        <div className="max-w-lg w-full">
          {isModal && onCancel && (
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-2 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-text-primary mb-2">
              {isModal ? 'Add a provider' : 'Welcome to Jelico'}
            </h1>
            <p className="text-text-secondary">
              {isModal
                ? 'Connect another AI service.'
                : 'Connect an AI service to start using Jelico.'}
            </p>
          </div>

          <div className="space-y-2">
            {PROVIDER_TYPES.map((provider) => (
              <button
                key={provider.type}
                onClick={() => setSelectedType(provider)}
                className="w-full p-4 text-left bg-bg-surface hover:bg-bg-elevated border border-border rounded-lg transition-colors"
              >
                <div className="font-medium text-text-primary">{provider.name}</div>
                <div className="text-sm text-text-secondary">{provider.description}</div>
              </button>
            ))}
          </div>

          {!isModal && (
            <button
              onClick={onComplete}
              className="mt-6 w-full text-center text-sm text-text-muted hover:text-text-secondary"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    )
  }

  // Provider configuration view
  return (
    <div className={`${isModal ? '' : 'min-h-screen'} bg-bg-void flex items-center justify-center p-8`}>
      <div className="max-w-lg w-full">
        <button
          onClick={() => setSelectedType(null)}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h1 className="text-2xl font-semibold text-text-primary mb-8">
          {selectedType.name}
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
            {error}
          </div>
        )}

        <ProviderConfigForm
          type={selectedType.type}
          defaultModel={selectedType.defaultModel}
          onSave={handleProviderSave}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
