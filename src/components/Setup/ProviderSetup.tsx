import { useState } from 'react'
import { ArrowLeft, X, Lock } from 'lucide-react'
import { useProviderStore } from '../../stores/providers'
import { ProviderConfigForm } from './ProviderConfigForm'

const PROVIDER_TYPES = [
  {
    type: 'anthropic' as const,
    name: 'Anthropic',
    description: 'Claude',
    icon: 'A',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  {
    type: 'openai' as const,
    name: 'OpenAI',
    description: 'GPT-4o',
    icon: '\u2B21', // hexagon
    defaultModel: 'gpt-4o',
  },
  {
    type: 'google' as const,
    name: 'Google',
    description: 'Gemini',
    icon: 'G',
    defaultModel: 'gemini-1.5-pro',
  },
  {
    type: 'ollama' as const,
    name: 'Ollama',
    description: 'Local',
    icon: '\uD83E\uDD99', // llama emoji
    defaultModel: 'llama3.1',
  },
  {
    type: 'openrouter' as const,
    name: 'OpenRouter',
    description: 'Any Model',
    icon: '\u25C8', // diamond
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },
  {
    type: 'custom' as const,
    name: 'Custom',
    description: 'OpenAI API',
    icon: '+',
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
      <div className={`${isModal ? '' : 'min-h-screen'} bg-bg-void flex items-center justify-center p-10`}>
        <div className="w-full max-w-[560px] animate-fade-in">
          {isModal && onCancel && (
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-2 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="text-center">
            {!isModal && (
              <div className="welcome-logo">J</div>
            )}
            <h1 className="font-display text-[32px] font-normal text-text-primary mb-2 tracking-tight">
              {isModal ? 'Add a provider' : 'Welcome to Jelico'}
            </h1>
            <p className="text-text-secondary text-base mb-12">
              {isModal ? 'Connect another AI service.' : 'Your AI productivity partner'}
            </p>

            {!isModal && (
              <p className="text-text-secondary text-[15px] mb-6">
                To get started, add an AI provider:
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-8">
            {PROVIDER_TYPES.map((provider) => (
              <button
                key={provider.type}
                onClick={() => setSelectedType(provider)}
                className="provider-card"
              >
                <div className={`provider-icon provider-icon-${provider.type} mx-auto mb-3`}>
                  {provider.icon}
                </div>
                <div className="text-[13px] font-medium text-text-primary mb-0.5">
                  {provider.name}
                </div>
                <div className="text-[11px] text-text-muted">
                  {provider.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Provider configuration view
  return (
    <div className={`${isModal ? '' : 'min-h-screen'} bg-bg-void flex items-center justify-center p-10`}>
      <div className="w-full max-w-[560px] animate-slide-in">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setSelectedType(null)}
            className="back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-display text-2xl font-normal text-text-primary">
            {selectedType.name} Setup
          </h2>
        </div>

        <div className="config-form">
          {error && (
            <div className="mb-5 p-3 bg-error/10 border border-error/20 rounded-md text-error text-sm">
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

        <div className="security-note">
          <Lock className="w-4 h-4 flex-shrink-0" />
          Key stored securely in system keychain
        </div>
      </div>
    </div>
  )
}
