import { useState } from 'react'
import { ArrowLeft, X, Lock } from 'lucide-react'
import type { ReasoningEffort } from '../../lib/reasoning'
import { useProviderStore } from '../../stores/providers'
import { ProviderConfigForm } from './ProviderConfigForm'
import { JelicoLogo } from '../Brand/JelicoLogo'

interface ProviderOption {
  id: string
  type: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter' | 'custom' | 'local' | 'zai' | 'zai-china' | 'zai-coding' | 'zai-coding-china' | 'minimax' | 'openai-compatible' | 'anthropic-compatible'
  group: 'Hosted APIs' | 'Local APIs' | 'Custom Endpoints'
  name: string
  description: string
  icon: string
  defaultModel: string
  defaultBaseUrl?: string
  defaultProviderName?: string
  apiKeyUrl?: string
}

const PROVIDER_TYPES: ProviderOption[] = [
  {
    id: 'anthropic',
    type: 'anthropic' as const,
    group: 'Hosted APIs',
    name: 'Anthropic',
    description: 'Claude API',
    icon: 'A',
    defaultModel: '',
    apiKeyUrl: 'console.anthropic.com',
  },
  {
    id: 'openai',
    type: 'openai' as const,
    group: 'Hosted APIs',
    name: 'OpenAI',
    description: 'OpenAI API',
    icon: '\u2B21', // hexagon
    defaultModel: '',
    apiKeyUrl: 'platform.openai.com',
  },
  {
    id: 'google',
    type: 'google' as const,
    group: 'Hosted APIs',
    name: 'Google',
    description: 'Gemini API',
    icon: 'G',
    defaultModel: '',
    apiKeyUrl: 'aistudio.google.com',
  },
  {
    id: 'openrouter',
    type: 'openrouter' as const,
    group: 'Hosted APIs',
    name: 'OpenRouter',
    description: 'Marketplace models',
    icon: '\u25C8', // diamond
    defaultModel: '',
    apiKeyUrl: 'openrouter.ai',
  },
  {
    id: 'nvidia',
    type: 'openai-compatible' as const,
    group: 'Hosted APIs',
    name: 'NVIDIA NIM',
    description: 'Build API',
    icon: 'N',
    defaultModel: '',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultProviderName: 'NVIDIA NIM',
    apiKeyUrl: 'build.nvidia.com',
  },
  {
    id: 'cerebras',
    type: 'openai-compatible' as const,
    group: 'Hosted APIs',
    name: 'Cerebras',
    description: 'Inference API',
    icon: 'C',
    defaultModel: '',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    defaultProviderName: 'Cerebras',
    apiKeyUrl: 'inference-docs.cerebras.ai',
  },
  {
    id: 'alibaba-qwen',
    type: 'openai-compatible' as const,
    group: 'Hosted APIs',
    name: 'Alibaba Qwen',
    description: 'DashScope compatible',
    icon: 'Q',
    defaultModel: '',
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    defaultProviderName: 'Alibaba Qwen',
    apiKeyUrl: 'dashscope.console.aliyun.com',
  },
  {
    id: 'nous-research',
    type: 'openai-compatible' as const,
    group: 'Hosted APIs',
    name: 'Nous Research',
    description: 'Hermes models',
    icon: 'N',
    defaultModel: '',
    defaultProviderName: 'Nous Research',
    apiKeyUrl: 'shadow.nousresearch.com',
  },
  {
    id: 'kwai-kat',
    type: 'openai-compatible' as const,
    group: 'Hosted APIs',
    name: 'KwaiKat',
    description: 'Kat Coder',
    icon: 'K',
    defaultModel: '',
    defaultProviderName: 'KwaiKat',
    apiKeyUrl: 'streamlake.ai',
  },
  {
    id: 'zai',
    type: 'zai' as const,
    group: 'Hosted APIs',
    name: 'Z.ai',
    description: 'Global API',
    icon: 'Z',
    defaultModel: 'glm-4.7',
  },
  {
    id: 'zai-china',
    type: 'zai-china' as const,
    group: 'Hosted APIs',
    name: 'Z.ai China',
    description: 'CN API',
    icon: 'Z',
    defaultModel: 'glm-4.7',
  },
  {
    id: 'zai-coding',
    type: 'zai-coding' as const,
    group: 'Hosted APIs',
    name: 'Z.ai Coding',
    description: 'Global Coding',
    icon: 'Z',
    defaultModel: 'glm-4.7',
  },
  {
    id: 'zai-coding-china',
    type: 'zai-coding-china' as const,
    group: 'Hosted APIs',
    name: 'Z.ai Coding CN',
    description: 'CN Coding',
    icon: 'Z',
    defaultModel: 'glm-4.7',
  },
  {
    id: 'minimax-api',
    type: 'openai-compatible' as const,
    group: 'Hosted APIs',
    name: 'MiniMax API',
    description: 'Official API',
    icon: 'M',
    defaultModel: '',
    defaultBaseUrl: 'https://api.minimax.io/v1',
    defaultProviderName: 'MiniMax API',
    apiKeyUrl: 'platform.minimax.io',
  },
  {
    id: 'minimax-coding-plan',
    type: 'anthropic-compatible' as const,
    group: 'Hosted APIs',
    name: 'MiniMax Coding Plan',
    description: 'Anthropic Compatible',
    icon: 'M',
    defaultModel: '',
    defaultBaseUrl: 'https://api.minimax.io/anthropic/v1',
    defaultProviderName: 'MiniMax Coding Plan',
    apiKeyUrl: 'platform.minimax.io',
  },
  {
    id: 'lm-studio',
    type: 'local' as const,
    group: 'Local APIs',
    name: 'LM Studio',
    description: 'Local OpenAI API',
    icon: 'L',
    defaultModel: '',
    defaultBaseUrl: 'http://127.0.0.1:1234/v1',
    defaultProviderName: 'LM Studio',
  },
  {
    id: 'ollama',
    type: 'ollama' as const,
    group: 'Local APIs',
    name: 'Ollama',
    description: 'Local LLMs',
    icon: 'O',
    defaultModel: '',
  },
  {
    id: 'local',
    type: 'local' as const,
    group: 'Local APIs',
    name: 'Custom Local',
    description: 'Self-hosted OpenAI API',
    icon: 'H',
    defaultModel: '',
    defaultBaseUrl: 'http://localhost:8080/v1',
    defaultProviderName: 'Custom Local',
  },
  {
    id: 'openai-compatible',
    type: 'openai-compatible' as const,
    group: 'Custom Endpoints',
    name: 'OpenAI Compatible',
    description: 'Custom Endpoint',
    icon: '\u2699', // gear
    defaultModel: '',
  },
  {
    id: 'anthropic-compatible',
    type: 'anthropic-compatible' as const,
    group: 'Custom Endpoints',
    name: 'Anthropic Compatible',
    description: 'Custom Endpoint',
    icon: '\u2699', // gear
    defaultModel: '',
  },
  {
    id: 'custom',
    type: 'custom' as const,
    group: 'Custom Endpoints',
    name: 'Custom',
    description: 'Generic endpoint',
    icon: '+',
    defaultModel: '',
  },
]

interface ProviderSetupProps {
  isModal?: boolean
  onComplete: () => void
  onCancel?: () => void
}

export function ProviderSetup({ isModal, onComplete, onCancel }: ProviderSetupProps) {
  const [selectedType, setSelectedType] = useState<ProviderOption | null>(null)
  const { addProvider } = useProviderStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleProviderSave = async (config: {
    name: string
    apiKey: string
    defaultModel: string
    defaultReasoningEffort?: ReasoningEffort | null
    baseUrl?: string
  }) => {
    if (!selectedType) return

    setIsLoading(true)
    setError(null)

    try {
      await addProvider({
        type: selectedType.type,
        name: config.name || selectedType.defaultProviderName || selectedType.name,
        apiKey: config.apiKey,
        defaultModel: config.defaultModel,
        defaultReasoningEffort: config.defaultReasoningEffort,
        baseUrl: config.baseUrl || selectedType.defaultBaseUrl,
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
        <div className="w-full max-w-[720px] animate-fade-in">
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
              <JelicoLogo className="welcome-logo" />
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

          <div className="space-y-6 mb-8 text-left">
            {(['Hosted APIs', 'Local APIs', 'Custom Endpoints'] as const).map((group) => {
              const groupProviders = PROVIDER_TYPES.filter((provider) => provider.group === group)
              if (groupProviders.length === 0) return null

              return (
                <div key={group} className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-text-muted px-1">
                    {group}
                  </div>
                  <div className="space-y-2">
                    {groupProviders.map((provider) => (
                      <button
                        key={provider.id}
                        onClick={() => setSelectedType(provider)}
                        className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-left hover:border-accent/40 hover:bg-bg-surface transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`provider-icon provider-icon-${provider.type} flex-shrink-0`}>
                            {provider.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-text-primary">
                              {provider.name}
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">
                              {provider.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Provider configuration view
  return (
    <div className={`${isModal ? '' : 'min-h-screen'} bg-bg-void flex items-center justify-center p-10`}>
      <div className="w-full max-w-[640px] animate-slide-in">
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
            initialName={selectedType.defaultProviderName || selectedType.name}
            initialBaseUrl={selectedType.defaultBaseUrl}
            apiKeyUrl={selectedType.apiKeyUrl}
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
