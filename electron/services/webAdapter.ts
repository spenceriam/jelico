import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { access } from 'node:fs/promises'

export interface WebProviderRuntime {
  providerType: WebProviderType
  rawProviderType?: string | null
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
    case 'openai-compatible':
    case 'anthropic-compatible':
    case 'custom':
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

type AgentBrowserResponse = {
  success: boolean
  data?: unknown
  error?: string
}

type AgentBrowserBrowser = {
  close: () => Promise<void>
}

type AgentBrowserRuntime = {
  BrowserManager: new () => AgentBrowserBrowser
  executeCommand: (command: Record<string, unknown>, browser: AgentBrowserBrowser) => Promise<AgentBrowserResponse>
}

type AgentBrowserEngine = {
  name: string
  buildUrl: (query: string) => string
}

const AGENT_BROWSER_ENGINES: AgentBrowserEngine[] = [
  {
    name: 'brave',
    buildUrl: (query) => `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`,
  },
  {
    name: 'bing',
    buildUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  },
]

const AGENT_BROWSER_SEARCH_SCRIPT = `(() => {
  const normalize = (value) => (value || '').toString().replace(/\\s+/g, ' ').trim();
  const searchHosts = new Set([
    'search.brave.com',
    'bing.com',
    'www.bing.com',
    'google.com',
    'www.google.com',
    'duckduckgo.com',
    'www.duckduckgo.com'
  ]);
  const isBlockedPage = () => {
    const text = normalize(document.body?.innerText || '').toLowerCase();
    const signals = [
      'verify you are human',
      'unusual traffic',
      'captcha',
      'robot check',
      'are you a robot',
      'access denied',
      'request blocked'
    ];
    return signals.some((signal) => text.includes(signal));
  };
  const isResultUrl = (href) => {
    if (!href || !/^https?:\\/\\//i.test(href)) return false;
    try {
      const host = new URL(href).hostname.toLowerCase();
      return !searchHosts.has(host);
    } catch {
      return false;
    }
  };
  const seen = new Set();
  const items = [];
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  for (const anchor of anchors) {
    const href = anchor.href || '';
    if (!isResultUrl(href)) continue;
    if (seen.has(href)) continue;
    const title = normalize(anchor.textContent);
    if (title.length < 14) continue;
    const container = anchor.closest('article, li, div, section');
    let snippet = normalize(container?.textContent || '');
    if (snippet.startsWith(title)) {
      snippet = normalize(snippet.slice(title.length));
    }
    if (!snippet) {
      snippet = normalize(anchor.parentElement?.nextElementSibling?.textContent || '');
    }
    if (snippet.length > 260) snippet = snippet.slice(0, 260) + '...';
    seen.add(href);
    items.push({ title, url: href, snippet });
    if (items.length >= 8) break;
  }
  return { blocked: isBlockedPage(), items };
})()`

let agentBrowserCommandCounter = 0

function nextAgentBrowserCommandId(): string {
  agentBrowserCommandCounter += 1
  return `jelico-agent-browser-${Date.now()}-${agentBrowserCommandCounter}`
}

function normalizeItemText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeAgentBrowserItem(raw: unknown): WebSearchItem | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const url = normalizeItemText(row.url)
  if (!/^https?:\/\//i.test(url)) return null
  const title = normalizeItemText(row.title)
  const snippet = normalizeItemText(row.snippet)
  return {
    title: title.length > 0 ? title : url,
    url,
    snippet,
  }
}

function parseAgentBrowserSearchPayload(payload: unknown): { blocked: boolean; items: WebSearchItem[] } {
  if (!payload || typeof payload !== 'object') {
    return { blocked: false, items: [] }
  }

  const parsed = payload as Record<string, unknown>
  const blocked = Boolean(parsed.blocked)
  const rawItems = Array.isArray(parsed.items) ? parsed.items : []
  const deduped = new Map<string, WebSearchItem>()
  for (const item of rawItems) {
    const normalized = normalizeAgentBrowserItem(item)
    if (!normalized) continue
    if (!deduped.has(normalized.url)) {
      deduped.set(normalized.url, normalized)
    }
    if (deduped.size >= 5) break
  }

  return {
    blocked,
    items: Array.from(deduped.values()),
  }
}

async function resolveAgentBrowserExecutablePath(): Promise<string | undefined> {
  const platformCandidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
          ]

  for (const candidate of platformCandidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // try next candidate
    }
  }

  return undefined
}

async function loadAgentBrowserRuntime(): Promise<AgentBrowserRuntime> {
  // agent-browser is © Vercel, Inc. and licensed under Apache License 2.0
  // See licenses/APACHE-2.0-LICENSE.txt
  const browserModule = await import('agent-browser/dist/browser.js')
  const actionsModule = await import('agent-browser/dist/actions.js')

  return {
    BrowserManager: browserModule.BrowserManager as AgentBrowserRuntime['BrowserManager'],
    executeCommand: actionsModule.executeCommand as AgentBrowserRuntime['executeCommand'],
  }
}

function extractAgentBrowserErrorMessage(response: AgentBrowserResponse | undefined): string {
  return String(response?.error || '')
}

function isMissingBrowserExecutableError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('executable') &&
    (normalized.includes("doesn't exist") || normalized.includes('not found') || normalized.includes('failed to launch'))
  )
}

async function searchWithAgentBrowser(query: string): Promise<WebSearchResult> {
  let runtime: AgentBrowserRuntime
  let browser: AgentBrowserBrowser | null = null

  try {
    runtime = await loadAgentBrowserRuntime()
  } catch (error: any) {
    return {
      success: true,
      type: 'unsupported',
      query,
      backend: 'agent_browser',
      message: `Browser fallback is unavailable: ${error?.message || String(error)}`,
    }
  }

  let sawBlockedPage = false

  try {
    browser = new runtime.BrowserManager()
    const executablePath = await resolveAgentBrowserExecutablePath()

    const runCommand = (action: string, payload: Record<string, unknown> = {}): Promise<AgentBrowserResponse> =>
      runtime.executeCommand(
        {
          id: nextAgentBrowserCommandId(),
          action,
          ...payload,
        },
        browser
      )

    const launchResponse = await runCommand('launch', {
      headless: true,
      viewport: { width: 1360, height: 960 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      ...(executablePath ? { executablePath } : {}),
    })

    if (!launchResponse.success) {
      const launchError = extractAgentBrowserErrorMessage(launchResponse)
      if (isMissingBrowserExecutableError(launchError)) {
        return {
          success: true,
          type: 'unsupported',
          query,
          backend: 'agent_browser',
          message: 'Browser fallback could not start because no local Chrome/Edge executable was found.',
        }
      }

      return {
        success: false,
        type: 'blocked',
        query,
        backend: 'agent_browser',
        error: launchError || 'Failed to launch browser fallback.',
      }
    }

    for (const engine of AGENT_BROWSER_ENGINES) {
      const navigateResponse = await runCommand('navigate', {
        url: engine.buildUrl(query),
        waitUntil: 'domcontentloaded',
      })

      if (!navigateResponse.success) continue

      await runCommand('waitforloadstate', { state: 'networkidle', timeout: 5000 })
      await runCommand('wait', { timeout: 1200 })

      const evaluateResponse = await runCommand('evaluate', { script: AGENT_BROWSER_SEARCH_SCRIPT })
      if (!evaluateResponse.success) continue

      const evaluateData =
        evaluateResponse.data && typeof evaluateResponse.data === 'object'
          ? (evaluateResponse.data as Record<string, unknown>).result
          : undefined
      const parsed = parseAgentBrowserSearchPayload(evaluateData)
      if (parsed.blocked) sawBlockedPage = true

      if (parsed.items.length > 0) {
        return {
          success: true,
          type: 'search_results',
          query,
          items: parsed.items,
          backend: `agent_browser_${engine.name}`,
        }
      }
    }

    return {
      success: true,
      type: sawBlockedPage ? 'blocked' : 'no_results',
      query,
      backend: 'agent_browser',
      message: sawBlockedPage
        ? 'Browser-based fallback was blocked by anti-bot protections.'
        : 'Browser-based fallback returned no results.',
    }
  } catch (error: any) {
    return {
      success: false,
      type: 'no_results',
      query,
      backend: 'agent_browser',
      error: error?.message || String(error),
    }
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch {
        // no-op: best effort cleanup
      }
    }
  }
}

function shouldUseUniversalFallback(primary: WebSearchResult): boolean {
  return primary.success && primary.type === 'unsupported'
}

async function applyUniversalSearchFallback(query: string, primary: WebSearchResult): Promise<WebSearchResult> {
  if (!shouldUseUniversalFallback(primary)) {
    return primary
  }

  const fallback = await searchWithAgentBrowser(query)
  if (!fallback.success) {
    return primary
  }

  return {
    ...fallback,
    backend: `${primary.backend}+${fallback.backend}`,
  }
}

async function localFetchText(url: string, selector?: string): Promise<WebFetchResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20_000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
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
    const message = error?.name === 'AbortError'
      ? 'Fetch timed out after 20 seconds.'
      : (error?.message || String(error))

    return {
      success: false,
      url,
      backend: 'local_fetch',
      error: message,
    }
  } finally {
    clearTimeout(timeoutId)
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

function getErrorMessage(error: any): string {
  return String(
    error?.message ||
    error?.cause?.message ||
    error?.error?.message ||
    error
  )
}

function getErrorStatusCode(error: any): number | null {
  const candidates = [
    error?.statusCode,
    error?.status,
    error?.response?.status,
    error?.cause?.statusCode,
    error?.cause?.status,
    error?.cause?.response?.status,
    error?.error?.statusCode,
    error?.error?.status,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
  }

  return null
}

function isOpenAIWebSearchUnsupported(
  runtime: WebProviderRuntime,
  errorMessage: string,
  statusCode: number | null
): boolean {
  const normalized = errorMessage.toLowerCase()
  const rawType = (runtime.rawProviderType || '').toLowerCase()
  const isCompatibleProvider = rawType !== '' && rawType !== 'openai'

  const mentionsResponsesEndpoint =
    normalized.includes('/responses') ||
    normalized.includes('/v1/responses') ||
    normalized.includes('responses endpoint')

  const mentionsRoutingFailure =
    normalized.includes('unknown endpoint') ||
    normalized.includes('no route') ||
    normalized.includes('route not found') ||
    normalized.includes('endpoint not found')

  const mentionsWebToolUnsupported =
    normalized.includes('web_search') ||
    normalized.includes('web search') ||
    normalized.includes('unsupported tool') ||
    normalized.includes('tool is not supported') ||
    normalized.includes('does not support tools')

  const mentionsNotFoundWithWebToolContext =
    normalized.includes('not found') &&
    (normalized.includes('web_search') || normalized.includes('web search') || mentionsResponsesEndpoint)

  if (statusCode === 404 && isCompatibleProvider && (
    mentionsResponsesEndpoint ||
    mentionsRoutingFailure ||
    mentionsWebToolUnsupported ||
    mentionsNotFoundWithWebToolContext
  )) {
    return true
  }

  // For OpenAI-compatible providers, treat these as unsupported capability.
  if (isCompatibleProvider && (mentionsResponsesEndpoint || mentionsWebToolUnsupported)) {
    return true
  }

  // Native OpenAI can also reject web tools for certain models.
  if (!isCompatibleProvider && mentionsWebToolUnsupported) {
    return true
  }

  return false
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
    const errorMessage = getErrorMessage(error)
    const statusCode = getErrorStatusCode(error)
    if (isOpenAIWebSearchUnsupported(runtime, errorMessage, statusCode)) {
      return {
        success: true,
        type: 'unsupported',
        query,
        backend: 'openai_native',
        message: 'Web search is unavailable for this provider/model endpoint. Use a provider with native web search or fallback tools.',
      }
    }

    return {
      success: false,
      type: 'no_results',
      query,
      backend: 'openai_native',
      error: errorMessage,
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
    return applyUniversalSearchFallback(query, {
      success: true,
      type: 'unsupported',
      query,
      backend: getBackendLabel(runtime),
      message: 'Web search is unavailable for this provider.',
    })
  }

  const primary = await (async (): Promise<WebSearchResult> => {
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
  })()

  return applyUniversalSearchFallback(query, primary)
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
