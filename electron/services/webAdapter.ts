import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export interface WebProviderRuntime {
  providerType: WebProviderType
  apiKey: string | null
  baseUrl?: string | null
  model: string
}

export type WebProviderType =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'openrouter'
  | 'ollama'
  | 'local'
  | 'unknown'

export function normalizeWebProviderType(rawType: string | null | undefined): WebProviderType {
  switch (rawType) {
    case 'anthropic':
      return 'anthropic'
    case 'openai':
    case 'minimax':
      return 'openai'
    case 'google':
      return 'google'
    case 'openrouter':
      return 'openrouter'
    case 'ollama':
      return 'ollama'
    case 'local':
      return 'local'
    default:
      return 'unknown'
  }
}

export interface WebCapability {
  search: boolean
  fetch: boolean
  backend: string
}

export interface WebSearchItem {
  title: string
  url: string
  snippet: string
}

export interface WebSearchResult {
  success: boolean
  type: 'search_results' | 'no_results' | 'blocked' | 'unsupported'
  query: string
  items?: WebSearchItem[]
  message?: string
  backend: string
  error?: string
}

export interface WebFetchResult {
  success: boolean
  url: string
  content?: string
  backend: string
  error?: string
}

function getBackendLabel(runtime: WebProviderRuntime): string {
  switch (runtime.providerType) {
    case 'anthropic':
      return 'anthropic_native'
    case 'openai':
      return 'openai_native'
    case 'google':
      return 'google_native'
    case 'openrouter':
      return 'openrouter_online'
    case 'ollama':
    case 'local':
      return 'local_no_search'
    default:
      return 'provider_unknown'
  }
}

export function getWebCapability(runtime: WebProviderRuntime): WebCapability {
  switch (runtime.providerType) {
    case 'anthropic':
      return { search: true, fetch: true, backend: 'anthropic_native' }
    case 'openai':
      return { search: true, fetch: true, backend: 'openai_native_plus_local_fetch' }
    case 'google':
      return { search: true, fetch: true, backend: 'google_native_plus_local_fetch' }
    case 'openrouter':
      return { search: true, fetch: true, backend: 'openrouter_online_plus_local_fetch' }
    case 'ollama':
    case 'local':
      return { search: false, fetch: true, backend: 'local_fetch_only' }
    default:
      return { search: false, fetch: true, backend: 'unknown_provider_local_fetch_only' }
  }
}

function normalizeWebText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()
}

function extractTextFromHtml(html: string): string {
  return normalizeWebText(
    html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<li>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, ' ')
  )
}

function truncateText(text: string, maxLength: number = 15000): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n\n[Content truncated...]`
}

async function localFetchText(url: string, selector?: string): Promise<WebFetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Jelico/1.0; +https://github.com/spenceriam/jelico)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      return {
        success: false,
        url,
        backend: 'local_fetch',
        error: `Fetch failed: ${response.status} ${response.statusText}`,
      }
    }

    const html = await response.text()
    let text = extractTextFromHtml(html)

    if (selector && selector.trim().length > 0) {
      // Selector-aware extraction is currently best-effort via full-page text fallback.
      // We keep the parameter for API compatibility and future DOM extraction upgrades.
      text = text
    }

    return {
      success: true,
      url,
      content: truncateText(text),
      backend: 'local_fetch',
    }
  } catch (error: any) {
    return {
      success: false,
      url,
      backend: 'local_fetch',
      error: error?.message || String(error),
    }
  }
}

function sourceToItem(url: string): WebSearchItem {
  try {
    const parsed = new URL(url)
    return {
      title: parsed.hostname,
      url,
      snippet: '',
    }
  } catch {
    return {
      title: url,
      url,
      snippet: '',
    }
  }
}

async function searchWithAnthropic(runtime: WebProviderRuntime, query: string): Promise<WebSearchResult> {
  if (!runtime.apiKey) {
    return {
      success: true,
      type: 'unsupported',
      query,
      backend: 'anthropic_native',
      message: 'No API key configured for Anthropic web search.',
    }
  }

  try {
    const anthropic = createAnthropic({
      apiKey: runtime.apiKey,
      baseURL: runtime.baseUrl || undefined,
    })

    const result = await generateText({
      model: anthropic.chat(runtime.model),
      prompt: `Search the web for: ${query}`,
      tools: {
        web_search: anthropic.tools.webSearch_20250305({
          maxUses: 3,
        }),
      },
      toolChoice: { type: 'tool', toolName: 'web_search' },
      maxSteps: 2,
    })

    const toolResults = result.toolResults.filter((toolResult) => toolResult.toolName === 'web_search')
    const items: WebSearchItem[] = []

    for (const toolResult of toolResults) {
      const output = toolResult.output as Array<{ url?: string; title?: string | null; pageAge?: string | null }> | undefined
      for (const entry of output || []) {
        if (!entry?.url) continue
        items.push({
          title: entry.title || entry.url,
          url: entry.url,
          snippet: entry.pageAge ? `Page age: ${entry.pageAge}` : '',
        })
      }
    }

    if (items.length === 0) {
      return {
        success: true,
        type: 'no_results',
        query,
        backend: 'anthropic_native',
        message: 'No web results returned by provider.',
      }
    }

    return {
      success: true,
      type: 'search_results',
      query,
      items: items.slice(0, 5),
      backend: 'anthropic_native',
    }
  } catch (error: any) {
    return {
      success: false,
      type: 'no_results',
      query,
      backend: 'anthropic_native',
      error: error?.message || String(error),
    }
  }
}

async function searchWithOpenAI(runtime: WebProviderRuntime, query: string): Promise<WebSearchResult> {
  if (!runtime.apiKey) {
    return {
      success: true,
      type: 'unsupported',
      query,
      backend: 'openai_native',
      message: 'No API key configured for OpenAI web search.',
    }
  }

  try {
    const openai = createOpenAI({
      apiKey: runtime.apiKey,
      baseURL: runtime.baseUrl || undefined,
    })

    const result = await generateText({
      model: openai.responses(runtime.model),
      prompt: `Search the web for: ${query}`,
      tools: {
        web_search: openai.tools.webSearch({
          searchContextSize: 'medium',
        }),
      },
      toolChoice: { type: 'tool', toolName: 'web_search' },
      maxSteps: 3,
    })

    const items = new Map<string, WebSearchItem>()
    for (const source of result.sources || []) {
      if ((source as any)?.type === 'source' && typeof (source as any)?.url === 'string') {
        const url = (source as any).url as string
        items.set(url, sourceToItem(url))
      }
      if ((source as any)?.type === 'url' && typeof (source as any)?.url === 'string') {
        const url = (source as any).url as string
        items.set(url, sourceToItem(url))
      }
    }

    for (const toolResult of result.toolResults || []) {
      if (toolResult.toolName !== 'web_search') continue
      const output = toolResult.output as { sources?: Array<{ type?: string; url?: string }> } | undefined
      for (const src of output?.sources || []) {
        if (src?.type !== 'url' || !src.url) continue
        items.set(src.url, sourceToItem(src.url))
      }
    }

    if (items.size === 0) {
      return {
        success: true,
        type: 'no_results',
        query,
        backend: 'openai_native',
        message: 'No web results returned by provider.',
      }
    }

    return {
      success: true,
      type: 'search_results',
      query,
      items: Array.from(items.values()).slice(0, 5),
      backend: 'openai_native',
    }
  } catch (error: any) {
    return {
      success: false,
      type: 'no_results',
      query,
      backend: 'openai_native',
      error: error?.message || String(error),
    }
  }
}

async function searchWithGoogle(runtime: WebProviderRuntime, query: string): Promise<WebSearchResult> {
  if (!runtime.apiKey) {
    return {
      success: true,
      type: 'unsupported',
      query,
      backend: 'google_native',
      message: 'No API key configured for Google web search.',
    }
  }

  try {
    const google = createGoogleGenerativeAI({
      apiKey: runtime.apiKey,
      baseURL: runtime.baseUrl || undefined,
    })

    const result = await generateText({
      model: google.chat(runtime.model),
      prompt: `Search the web for: ${query}`,
      tools: {
        google_search: google.tools.googleSearch({
          mode: 'MODE_UNSPECIFIED',
        }),
      },
      toolChoice: { type: 'tool', toolName: 'google_search' },
      maxSteps: 2,
    })

    const items = new Map<string, WebSearchItem>()
    for (const source of result.sources || []) {
      if ((source as any)?.type === 'source' && typeof (source as any)?.url === 'string') {
        const url = (source as any).url as string
        items.set(url, sourceToItem(url))
      }
      if ((source as any)?.type === 'url' && typeof (source as any)?.url === 'string') {
        const url = (source as any).url as string
        items.set(url, sourceToItem(url))
      }
    }

    if (items.size === 0) {
      return {
        success: true,
        type: 'no_results',
        query,
        backend: 'google_native',
        message: 'No web results returned by provider.',
      }
    }

    return {
      success: true,
      type: 'search_results',
      query,
      items: Array.from(items.values()).slice(0, 5),
      backend: 'google_native',
    }
  } catch (error: any) {
    return {
      success: false,
      type: 'no_results',
      query,
      backend: 'google_native',
      error: error?.message || String(error),
    }
  }
}

function getOpenRouterBaseUrl(runtime: WebProviderRuntime): string {
  const base = (runtime.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
  if (base.endsWith('/api/v1')) return base
  if (base.endsWith('/api')) return `${base}/v1`
  return `${base}/api/v1`
}

function parseOpenRouterJsonContent(content: string): WebSearchItem[] {
  try {
    const parsed = JSON.parse(content)
    const list = Array.isArray(parsed?.results) ? parsed.results : []
    const items: WebSearchItem[] = []
    for (const row of list) {
      if (!row?.url || typeof row.url !== 'string') continue
      items.push({
        title: typeof row.title === 'string' && row.title.trim().length > 0 ? row.title : row.url,
        url: row.url,
        snippet: typeof row.snippet === 'string' ? row.snippet : '',
      })
    }
    return items
  } catch {
    return []
  }
}

async function searchWithOpenRouter(runtime: WebProviderRuntime, query: string): Promise<WebSearchResult> {
  if (!runtime.apiKey) {
    return {
      success: true,
      type: 'unsupported',
      query,
      backend: 'openrouter_online',
      message: 'No API key configured for OpenRouter web search.',
    }
  }

  try {
    const baseUrl = getOpenRouterBaseUrl(runtime)
    const model = runtime.model.includes(':online') ? runtime.model : `${runtime.model}:online`
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${runtime.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/spenceriam/jelico',
        'X-Title': 'Jelico',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        plugins: [{ id: 'web', max_results: 5 }],
        messages: [
          {
            role: 'system',
            content: 'Return JSON only in this shape: {"results":[{"title":"...","url":"...","snippet":"..."}]}',
          },
          {
            role: 'user',
            content: `Search the web for: ${query}`,
          },
        ],
      }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload) {
      return {
        success: false,
        type: 'no_results',
        query,
        backend: 'openrouter_online',
        error: payload?.error?.message || `OpenRouter search failed: ${response.status}`,
      }
    }

    const items = new Map<string, WebSearchItem>()
    const content = payload?.choices?.[0]?.message?.content
    if (typeof content === 'string' && content.trim().length > 0) {
      for (const item of parseOpenRouterJsonContent(content)) {
        items.set(item.url, item)
      }
    }

    const annotations = payload?.choices?.[0]?.message?.annotations
    if (Array.isArray(annotations)) {
      for (const annotation of annotations) {
        if (annotation?.type === 'url_citation' && annotation?.url_citation?.url) {
          const url = annotation.url_citation.url
          items.set(url, {
            title: annotation.url_citation.title || url,
            url,
            snippet: '',
          })
        }
      }
    }

    if (items.size === 0) {
      return {
        success: true,
        type: 'no_results',
        query,
        backend: 'openrouter_online',
        message: 'No web results returned by provider.',
      }
    }

    return {
      success: true,
      type: 'search_results',
      query,
      items: Array.from(items.values()).slice(0, 5),
      backend: 'openrouter_online',
    }
  } catch (error: any) {
    return {
      success: false,
      type: 'no_results',
      query,
      backend: 'openrouter_online',
      error: error?.message || String(error),
    }
  }
}

export async function runProviderWebSearch(runtime: WebProviderRuntime, query: string): Promise<WebSearchResult> {
  const capability = getWebCapability(runtime)
  if (!capability.search) {
    return {
      success: true,
      type: 'unsupported',
      query,
      backend: getBackendLabel(runtime),
      message: 'Web search is unavailable for this provider.',
    }
  }

  switch (runtime.providerType) {
    case 'anthropic':
      return searchWithAnthropic(runtime, query)
    case 'openai':
      return searchWithOpenAI(runtime, query)
    case 'google':
      return searchWithGoogle(runtime, query)
    case 'openrouter':
      return searchWithOpenRouter(runtime, query)
    default:
      return {
        success: true,
        type: 'unsupported',
        query,
        backend: getBackendLabel(runtime),
        message: 'Web search is unavailable for this provider.',
      }
  }
}

async function fetchWithAnthropic(runtime: WebProviderRuntime, url: string): Promise<WebFetchResult> {
  if (!runtime.apiKey) {
    return {
      success: false,
      url,
      backend: 'anthropic_native',
      error: 'No API key configured for Anthropic web fetch.',
    }
  }

  try {
    const anthropic = createAnthropic({
      apiKey: runtime.apiKey,
      baseURL: runtime.baseUrl || undefined,
    })
    const result = await generateText({
      model: anthropic.chat(runtime.model),
      prompt: `Fetch and return content for this URL: ${url}`,
      tools: {
        web_fetch: anthropic.tools.webFetch_20250910({
          maxUses: 1,
          maxContentTokens: 8000,
        }),
      },
      toolChoice: { type: 'tool', toolName: 'web_fetch' },
      maxSteps: 2,
    })

    for (const toolResult of result.toolResults || []) {
      if (toolResult.toolName !== 'web_fetch') continue
      const output = toolResult.output as {
        content?: {
          source?: {
            type?: string
            data?: string
          }
        }
      } | undefined

      const source = output?.content?.source
      if (!source) continue
      if (source.type === 'text' && typeof source.data === 'string') {
        return {
          success: true,
          url,
          content: truncateText(normalizeWebText(source.data)),
          backend: 'anthropic_native',
        }
      }
      if (source.type === 'base64' && typeof source.data === 'string') {
        return {
          success: true,
          url,
          content: '[Fetched PDF content returned as base64; textual extraction unavailable in this step.]',
          backend: 'anthropic_native',
        }
      }
    }

    return {
      success: false,
      url,
      backend: 'anthropic_native',
      error: 'Provider did not return fetched content.',
    }
  } catch (error: any) {
    return {
      success: false,
      url,
      backend: 'anthropic_native',
      error: error?.message || String(error),
    }
  }
}

export async function runProviderWebFetch(runtime: WebProviderRuntime, url: string, selector?: string): Promise<WebFetchResult> {
  if (runtime.providerType === 'anthropic') {
    const nativeFetch = await fetchWithAnthropic(runtime, url)
    if (nativeFetch.success) return nativeFetch
    const fallback = await localFetchText(url, selector)
    return {
      ...fallback,
      backend: `${nativeFetch.backend}_fallback_local_fetch`,
      error: nativeFetch.error || fallback.error,
    }
  }

  // OpenAI/OpenRouter/Google/local currently use local fallback fetch.
  return localFetchText(url, selector)
}
