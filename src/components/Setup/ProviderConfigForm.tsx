import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'

const API_KEY_URLS: Record<string, string> = {
  anthropic: 'console.anthropic.com',
  openai: 'platform.openai.com',
  google: 'makersuite.google.com',
  openrouter: 'openrouter.ai',
}

const MODEL_OPTIONS: Record<string, Array<{ id: string; name: string }>> = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],
  google: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  ],
  openrouter: [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
  ],
  ollama: [],
  custom: [],
}

interface ProviderConfigFormProps {
  type: string
  defaultModel: string
  onSave: (config: {
    name: string
    apiKey: string
    defaultModel: string
    baseUrl?: string
  }) => void
  isLoading?: boolean
}

export function ProviderConfigForm({ type, defaultModel, onSave, isLoading }: ProviderConfigFormProps) {
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(defaultModel)
  const [baseUrl, setBaseUrl] = useState(type === 'ollama' ? 'http://localhost:11434' : '')
  const [showKey, setShowKey] = useState(false)

  const needsApiKey = type !== 'ollama'
  const needsBaseUrl = type === 'ollama' || type === 'custom' || type === 'openrouter'
  const models = MODEL_OPTIONS[type] || []
  const apiKeyUrl = API_KEY_URLS[type]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: name || getDefaultName(type),
      apiKey,
      defaultModel: model,
      baseUrl: needsBaseUrl ? baseUrl : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {needsApiKey && (
        <div>
          <label className="label">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="input pr-10"
              placeholder={`${type === 'anthropic' ? 'sk-ant-' : 'sk-'}...`}
              required
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {apiKeyUrl && (
            <p className="mt-1 text-xs text-text-muted">
              Get your key at{' '}
              <a
                href={`https://${apiKeyUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                {apiKeyUrl}
              </a>
            </p>
          )}
        </div>
      )}

      <div>
        <label className="label">Name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder={getDefaultName(type)}
        />
      </div>

      {needsBaseUrl && (
        <div>
          <label className="label">
            {type === 'ollama' ? 'Server URL' : 'Base URL'}
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="input"
            placeholder={type === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
            required={type === 'custom'}
          />
        </div>
      )}

      {models.length > 0 && (
        <div>
          <label className="label">Default model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="input"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {models.length === 0 && (
        <div>
          <label className="label">Model ID</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="input"
            placeholder="llama3.1"
            required
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Lock className="w-3 h-3" />
          Stored in system keychain
        </div>

        <button
          type="submit"
          disabled={isLoading || (needsApiKey && !apiKey)}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}

function getDefaultName(type: string): string {
  const names: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    ollama: 'Ollama',
    openrouter: 'OpenRouter',
    custom: 'Custom',
  }
  return names[type] || 'Provider'
}
