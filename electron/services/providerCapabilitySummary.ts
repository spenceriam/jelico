export interface ProviderCapabilitySummary {
  label: string
  note: string
  source: 'provider_override' | 'models_dev_provider_match' | 'default_unknown'
  toolSupport: 'supported' | 'unsupported' | 'unknown'
}

interface ToolCallMetadataLike {
  toolCall?: boolean | null
}

interface ResolveProviderCapabilitySummaryParams {
  baseUrl?: string | null
  modelsDevMetadata?: ToolCallMetadataLike | null
  providerName?: string | null
  providerType: string
}

function normalize(value?: string | null): string {
  return String(value || '').trim().toLowerCase()
}

function isKnownChatOnlyCompatibleProvider(params: ResolveProviderCapabilitySummaryParams): boolean {
  const providerType = normalize(params.providerType)
  if (!['openai-compatible', 'anthropic-compatible', 'custom'].includes(providerType)) {
    return false
  }

  const providerName = normalize(params.providerName)
  const baseUrl = normalize(params.baseUrl)
  return (
    providerName.includes('nous research') ||
    providerName.includes('shadow portal') ||
    baseUrl.includes('shadow.nousresearch.com')
  )
}

export function resolveProviderCapabilitySummary(
  params: ResolveProviderCapabilitySummaryParams & { modelId?: string | null }
): ProviderCapabilitySummary | null {
  if (!String(params.modelId || '').trim()) {
    return null
  }

  if (isKnownChatOnlyCompatibleProvider(params)) {
    return {
      toolSupport: 'unsupported',
      label: 'Chat only',
      source: 'provider_override',
      note: 'This compatible endpoint is known to support plain chat but not Jelico-compatible structured tool calls.',
    }
  }

  if (params.modelsDevMetadata?.toolCall === true) {
    return {
      toolSupport: 'supported',
      label: 'Tools supported',
      source: 'models_dev_provider_match',
      note: 'Structured tool calling is verified for this provider/model.',
    }
  }

  if (params.modelsDevMetadata?.toolCall === false) {
    return {
      toolSupport: 'unsupported',
      label: 'Chat only',
      source: 'models_dev_provider_match',
      note: 'Catalog metadata marks this provider/model as lacking structured tool-call support.',
    }
  }

  return {
    toolSupport: 'unknown',
    label: 'Tool support unknown',
    source: 'default_unknown',
    note: 'Plain chat should work, but artifacts, file edits, and workspace actions are not verified for this endpoint.',
  }
}
