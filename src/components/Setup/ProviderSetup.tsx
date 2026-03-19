import { useState } from 'react'
import { ArrowLeft, ExternalLink, X, Lock } from 'lucide-react'
import type { ReasoningEffort } from '../../lib/reasoning'
import { useProviderStore } from '../../stores/providers'
import { ProviderConfigForm } from './ProviderConfigForm'
import { JelicoLogo } from '../Brand/JelicoLogo'
import { ToolSupportBadge } from '../Providers/ToolSupportBadge'

interface ProviderOption {
  id: string
  type: 'anthropic' | 'openai' | 'google' | 'ollama' | 'openrouter' | 'custom' | 'local' | 'zai' | 'zai-china' | 'zai-coding' | 'zai-coding-china' | 'minimax' | 'openai-compatible' | 'anthropic-compatible'
  group: 'Hosted APIs' | 'Local APIs' | 'Custom Endpoints'
  name: string
  cardTitle: string
  summary: string
  icon: string
  defaultModel: string
  defaultBaseUrl?: string
  defaultProviderName?: string
  apiKeyUrl?: string
  docsUrl?: string
  capabilitySummary?: ProviderCapabilitySummary
}

function buildCapabilitySummary(
  toolSupport: ProviderCapabilitySummary['toolSupport'],
  note: string
): ProviderCapabilitySummary {
  return {
    toolSupport,
    label:
      toolSupport === 'supported'
        ? 'Tools supported'
        : toolSupport === 'unsupported'
          ? 'Chat only'
          : 'Tool support unknown',
    source: toolSupport === 'unknown' ? 'default_unknown' : 'provider_override',
    note,
  }
}

const PROVIDER_TYPES: ProviderOption[] = [
  {
    id: 'anthropic',
    type: 'anthropic' as const,
    group: 'Hosted APIs',
    name: 'Anthropic',
    cardTitle: 'Anthropic API',
    summary: 'Claude models with Haiku, Sonnet, and Opus tiers.',
    icon: 'A',
    defaultModel: '',
    apiKeyUrl: 'console.anthropic.com',
    docsUrl: 'https://platform.claude.com/docs/en/api/overview',
    capabilitySummary: buildCapabilitySummary('supported', 'Artifacts, file writes, and workspace actions depend on tool support.'),
  },
  {
    id: 'openai',
    type: 'openai' as const,
    group: 'Hosted APIs',
    name: 'OpenAI',
    cardTitle: 'OpenAI API',
    summary: 'GPT and codex models for chat, reasoning, and tool use.',
    icon: '\u2B21', // hexagon
    defaultModel: '',
    apiKeyUrl: 'platform.openai.com',
    docsUrl: 'https://developers.openai.com/api/docs/models',
    capabilitySummary: buildCapabilitySummary('supported', 'Artifacts, file writes, and workspace actions depend on tool support.'),
  },
  {
    id: 'google',
    type: 'google' as const,
    group: 'Hosted APIs',
    name: 'Google Gemini',
    cardTitle: 'Google Gemini API',
    summary: 'Gemini 3 models with multimodal, thinking, and long context support.',
    icon: 'G',
    defaultModel: '',
    apiKeyUrl: 'aistudio.google.com',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/quickstart',
    capabilitySummary: buildCapabilitySummary('supported', 'Artifacts, file writes, and workspace actions depend on tool support.'),
  },
  {
    id: 'openrouter',
    type: 'openrouter' as const,
    group: 'Hosted APIs',
    name: 'OpenRouter',
    cardTitle: 'OpenRouter API',
    summary: 'One API for 300+ models across many providers.',
    icon: '\u25C8', // diamond
    defaultModel: '',
    apiKeyUrl: 'openrouter.ai',
    docsUrl: 'https://openrouter.ai/docs/quickstart',
    capabilitySummary: buildCapabilitySummary('supported', 'Artifacts, file writes, and workspace actions depend on tool support.'),
  },
  {
    id: 'zai',
    type: 'zai' as const,
    group: 'Hosted APIs',
    name: 'Z.ai',
    cardTitle: 'Z.ai API',
    summary: 'General GLM chat and multimodal endpoints from Z.ai.',
    icon: 'Z',
    defaultModel: 'glm-5',
    docsUrl: 'https://docs.z.ai/',
    capabilitySummary: buildCapabilitySummary('supported', 'Artifacts, file writes, and workspace actions depend on tool support.'),
  },
  {
    id: 'zai-china',
    type: 'zai-china' as const,
    group: 'Hosted APIs',
    name: 'Z.ai China',
    cardTitle: 'Z.ai API China',
    summary: 'China-region access to Z.ai general GLM API endpoints.',
    icon: 'Z',
    defaultModel: 'glm-5',
    docsUrl: 'https://docs.z.ai/',
    capabilitySummary: buildCapabilitySummary('supported', 'Artifacts, file writes, and workspace actions depend on tool support.'),
  },
  {
    id: 'zai-coding',
    type: 'zai-coding' as const,
    group: 'Hosted APIs',
    name: 'Z.ai Coding Plan',
    cardTitle: 'Z.ai Coding Plan',
    summary: 'Dedicated GLM coding endpoint for coding-plan access.',
    icon: 'Z',
    defaultModel: 'glm-4.7',
    docsUrl: 'https://docs.z.ai/devpack/overview',
    capabilitySummary: buildCapabilitySummary('supported', 'Artifacts, file writes, and workspace actions depend on tool support.'),
  },
  {
    id: 'zai-coding-china',
    type: 'zai-coding-china' as const,
    group: 'Hosted APIs',
    name: 'Z.ai Coding Plan China',
    cardTitle: 'Z.ai Coding Plan China',
    summary: 'China-region coding-plan endpoint for GLM coding tools.',
    icon: 'Z',
    defaultModel: 'glm-4.7',
    docsUrl: 'https://docs.z.ai/devpack/overview',
    capabilitySummary: buildCapabilitySummary('supported', 'Artifacts, file writes, and workspace actions depend on tool support.'),
  },
  {
    id: 'minimax-api',
    type: 'openai-compatible' as const,
    group: 'Hosted APIs',
    name: 'MiniMax API',
    cardTitle: 'MiniMax API',
    summary: 'M2.5 text plus speech, image, video, and music APIs.',
    icon: 'M',
    defaultModel: '',
    defaultBaseUrl: 'https://api.minimax.io/v1',
    defaultProviderName: 'MiniMax API',
    apiKeyUrl: 'platform.minimax.io',
    docsUrl: 'https://platform.minimax.io/docs/api-reference/api-overview',
    capabilitySummary: buildCapabilitySummary('unknown', 'Artifacts, file writes, and workspace actions depend on verified tool support for the selected endpoint.'),
  },
  {
    id: 'minimax-coding-plan',
    type: 'anthropic-compatible' as const,
    group: 'Hosted APIs',
    name: 'MiniMax Coding Plan',
    cardTitle: 'MiniMax Coding Plan',
    summary: 'Anthropic-compatible coding access for MiniMax M2.5.',
    icon: 'M',
    defaultModel: '',
    defaultBaseUrl: 'https://api.minimax.io/anthropic/v1',
    defaultProviderName: 'MiniMax Coding Plan',
    apiKeyUrl: 'platform.minimax.io',
    docsUrl: 'https://platform.minimax.io/docs/coding-plan/quickstart',
    capabilitySummary: buildCapabilitySummary('unknown', 'Artifacts, file writes, and workspace actions depend on verified tool support for the selected endpoint.'),
  },
  {
    id: 'nous-research',
    type: 'openai-compatible' as const,
    group: 'Hosted APIs',
    name: 'Nous Research',
    cardTitle: 'Nous Research API',
    summary: 'Hermes and Forge-powered reasoning APIs from Nous Research.',
    icon: 'N',
    defaultModel: '',
    defaultBaseUrl: 'https://shadow.nousresearch.com/v1',
    defaultProviderName: 'Nous Research',
    apiKeyUrl: 'shadow.nousresearch.com',
    docsUrl: 'https://shadow-portal.nousresearch.com/api-docs',
    capabilitySummary: buildCapabilitySummary('unsupported', 'This endpoint is currently treated as chat only. Artifacts, file writes, and workspace actions depend on tool support.'),
  },
  {
    id: 'cerebras',
    type: 'openai-compatible' as const,
    group: 'Hosted APIs',
    name: 'Cerebras',
    cardTitle: 'Cerebras API',
    summary: 'Fast hosted inference for open models like GLM and GPT-OSS.',
    icon: 'C',
    defaultModel: '',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    defaultProviderName: 'Cerebras',
    apiKeyUrl: 'inference-docs.cerebras.ai',
    docsUrl: 'https://inference-docs.cerebras.ai/introduction',
    capabilitySummary: buildCapabilitySummary('unknown', 'Artifacts, file writes, and workspace actions depend on verified tool support for the selected endpoint.'),
  },
  {
    id: 'kwai-kat',
    type: 'openai-compatible' as const,
    group: 'Hosted APIs',
    name: 'KwaiKat',
    cardTitle: 'KwaiKat API',
    summary: 'Kat Coder endpoints aimed at coding-focused workflows.',
    icon: 'K',
    defaultModel: '',
    defaultProviderName: 'KwaiKat',
    apiKeyUrl: 'streamlake.ai',
    docsUrl: 'https://streamlake.ai',
    capabilitySummary: buildCapabilitySummary('unknown', 'Artifacts, file writes, and workspace actions depend on verified tool support for the selected endpoint.'),
  },
  {
    id: 'alibaba-qwen',
    type: 'openai-compatible' as const,
    group: 'Hosted APIs',
    name: 'Alibaba Qwen',
    cardTitle: 'Alibaba API',
    summary: 'DashScope access to Qwen models over compatible endpoints.',
    icon: 'Q',
    defaultModel: '',
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    defaultProviderName: 'Alibaba Qwen',
    apiKeyUrl: 'dashscope.console.aliyun.com',
    docsUrl: 'https://www.alibabacloud.com/help/en/model-studio/regions/',
    capabilitySummary: buildCapabilitySummary('unknown', 'Artifacts, file writes, and workspace actions depend on verified tool support for the selected endpoint.'),
  },
  {
    id: 'nvidia',
    type: 'openai-compatible' as const,
    group: 'Hosted APIs',
    name: 'NVIDIA NIM',
    cardTitle: 'NVIDIA NIM API',
    summary: 'Hosted NVIDIA and partner models through NIM endpoints.',
    icon: 'N',
    defaultModel: '',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultProviderName: 'NVIDIA NIM',
    apiKeyUrl: 'build.nvidia.com',
    docsUrl: 'https://docs.nvidia.com/nim/',
    capabilitySummary: buildCapabilitySummary('unknown', 'Artifacts, file writes, and workspace actions depend on verified tool support for the selected endpoint.'),
  },
  {
    id: 'lm-studio',
    type: 'local' as const,
    group: 'Local APIs',
    name: 'LM Studio',
    cardTitle: 'LM Studio API',
    summary: 'Local OpenAI-compatible server for models on your machine.',
    icon: 'L',
    defaultModel: '',
    defaultBaseUrl: 'http://127.0.0.1:1234/v1',
    defaultProviderName: 'LM Studio',
    capabilitySummary: buildCapabilitySummary('unknown', 'Artifacts, file writes, and workspace actions depend on verified tool support for the selected endpoint.'),
  },
  {
    id: 'ollama',
    type: 'ollama' as const,
    group: 'Local APIs',
    name: 'Ollama',
    cardTitle: 'Ollama API',
    summary: 'Run and serve local models from a simple local endpoint.',
    icon: 'O',
    defaultModel: '',
    capabilitySummary: buildCapabilitySummary('unknown', 'Artifacts, file writes, and workspace actions depend on verified tool support for the selected endpoint.'),
  },
  {
    id: 'local',
    type: 'local' as const,
    group: 'Local APIs',
    name: 'Custom Local',
    cardTitle: 'Custom Local API',
    summary: 'Bring your own self-hosted OpenAI-compatible server.',
    icon: 'H',
    defaultModel: '',
    defaultBaseUrl: 'http://localhost:8080/v1',
    defaultProviderName: 'Custom Local',
    capabilitySummary: buildCapabilitySummary('unknown', 'Artifacts, file writes, and workspace actions depend on verified tool support for the selected endpoint.'),
  },
  {
    id: 'openai-compatible',
    type: 'openai-compatible' as const,
    group: 'Custom Endpoints',
    name: 'OpenAI Compatible',
    cardTitle: 'OpenAI Compatible',
    summary: 'Custom endpoint',
    icon: '\u2699', // gear
    defaultModel: '',
    capabilitySummary: buildCapabilitySummary('unknown', 'Artifacts, file writes, and workspace actions depend on verified tool support for the selected endpoint.'),
  },
  {
    id: 'anthropic-compatible',
    type: 'anthropic-compatible' as const,
    group: 'Custom Endpoints',
    name: 'Anthropic Compatible',
    cardTitle: 'Anthropic Compatible',
    summary: 'Custom endpoint',
    icon: '\u2699', // gear
    defaultModel: '',
    capabilitySummary: buildCapabilitySummary('unknown', 'Artifacts, file writes, and workspace actions depend on verified tool support for the selected endpoint.'),
  },
  {
    id: 'custom',
    type: 'custom' as const,
    group: 'Custom Endpoints',
    name: 'Custom',
    cardTitle: 'Custom',
    summary: 'Generic endpoint',
    icon: '+',
    defaultModel: '',
    capabilitySummary: buildCapabilitySummary('unknown', 'Artifacts, file writes, and workspace actions depend on verified tool support for the selected endpoint.'),
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
        <div className="relative w-full max-w-[1080px] animate-fade-in">
          {isModal && onCancel && (
            <button
              onClick={onCancel}
              className="absolute top-4 right-5 z-10 rounded-md p-2 text-text-muted hover:bg-bg-surface hover:text-text-primary transition-colors"
              aria-label="Close add provider"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="text-center pr-12">
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
            <p className="text-xs text-text-muted mb-6">
              Artifacts, file writes, and workspace actions depend on tool support. Chat-only providers still work for normal conversations.
            </p>
          </div>

          <div className="space-y-7 mb-8 text-left">
            {(['Hosted APIs', 'Local APIs', 'Custom Endpoints'] as const).map((group) => {
              const groupProviders = PROVIDER_TYPES.filter((provider) => provider.group === group)
              if (groupProviders.length === 0) return null

              return (
                <div key={group} className="space-y-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-text-muted px-1">
                    {group}
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {groupProviders.map((provider) => (
                      <div
                        key={provider.id}
                        className="group relative"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedType(provider)}
                          aria-label={`Select ${provider.cardTitle}`}
                          className="absolute inset-0 rounded-xl border border-border bg-bg-elevated transition-colors group-hover:border-accent/40 group-hover:bg-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        />
                        <div className="relative z-10 flex min-h-[8.5rem] flex-col items-center justify-center gap-3 px-5 py-5 text-center pointer-events-none">
                          <div className="min-w-0 space-y-1">
                            <div className="text-sm font-medium text-text-primary">
                              {provider.cardTitle}
                            </div>
                            <div className="text-xs text-text-muted leading-5">
                              {provider.summary}
                            </div>
                          </div>
                          <div className="pointer-events-none">
                            <ToolSupportBadge summary={provider.capabilitySummary} />
                          </div>
                          {provider.docsUrl && (
                            <a
                              href={provider.docsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="pointer-events-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-bright transition-colors"
                            >
                              Docs
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
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
            {selectedType.cardTitle} Setup
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
