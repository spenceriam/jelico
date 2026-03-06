import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useUpdateStore } from './updates'

const AVAILABLE_DISMISS_KEY = 'jelico:update:dismissed-available-version'
const APPLY_DISMISS_KEY = 'jelico:update:dismissed-apply-version'
const APPLY_LAUNCHED_KEY = 'jelico:update:launched-apply-version'
const DOWNLOADED_VERSION_KEY = 'jelico:update:downloaded-version'
const DOWNLOADED_PATH_KEY = 'jelico:update:downloaded-path'

interface LocalStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

function createLocalStorageMock(): LocalStorageLike {
  const store = new Map<string, string>()
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
}

function setGlobalWindow(overrides: Partial<any> = {}) {
  const bridge = {
    getCurrentVersion: async () => '0.35.0',
    check: async () => ({
      currentVersion: '0.35.0',
      latestVersion: '0.36.0',
      isUpdateAvailable: true,
      releaseUrl: 'https://example.com/release',
      publishedAt: '2026-03-04T00:00:00.000Z',
      assets: [],
      recommendedAsset: null,
    }),
    download: async () => ({ savedTo: 'C:/tmp/Jelico-0.36.0.exe' }),
    applyDownloaded: async () => ({ success: true }),
    clearDownloadedState: async () => true,
    openRelease: async (_url: string) => true,
    onDownloadProgress: (_callback: (progress: any) => void) => () => {},
    ...overrides,
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      jelico: {
        updates: bridge,
      },
    },
  })
}

function resetStoreState() {
  useUpdateStore.setState({
    info: null,
    currentVersion: null,
    isChecking: false,
    isDownloading: false,
    isApplying: false,
    downloadProgress: null,
    lastChecked: null,
    lastDownloadedTo: null,
    downloadedVersion: null,
    dismissedAvailableVersion: null,
    dismissedApplyVersion: null,
    launchedApplyVersion: null,
    error: null,
  })
}

beforeEach(() => {
  const localStorageMock = createLocalStorageMock()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorageMock,
  })

  setGlobalWindow()
  resetStoreState()
})

test('checkForUpdates(force) hydrates update info and current version', async () => {
  const expectedInfo = {
    currentVersion: '0.35.0',
    latestVersion: '0.36.0',
    isUpdateAvailable: true,
    releaseUrl: 'https://example.com/release',
    publishedAt: '2026-03-04T00:00:00.000Z',
    assets: [],
    recommendedAsset: null,
  }

  setGlobalWindow({
    check: async () => expectedInfo,
  })

  const result = await useUpdateStore.getState().checkForUpdates({ force: true })

  assert.deepEqual(result, expectedInfo)
  const state = useUpdateStore.getState()
  assert.deepEqual(state.info, expectedInfo)
  assert.equal(state.currentVersion, '0.35.0')
  assert.equal(typeof state.lastChecked, 'number')
})

test('downloadUpdate marks downloaded version and persists dismissal keys correctly', async () => {
  const info = {
    currentVersion: '0.35.0',
    latestVersion: '0.36.0',
    isUpdateAvailable: true,
    releaseUrl: 'https://example.com/release',
    publishedAt: '2026-03-04T00:00:00.000Z',
    assets: [],
    recommendedAsset: null,
  }
  useUpdateStore.setState({ info })

  setGlobalWindow({
    download: async () => ({ savedTo: 'C:/tmp/Jelico-0.36.0.exe' }),
  })

  const result = await useUpdateStore.getState().downloadUpdate()
  assert.deepEqual(result, { savedTo: 'C:/tmp/Jelico-0.36.0.exe' })

  const state = useUpdateStore.getState()
  assert.equal(state.lastDownloadedTo, 'C:/tmp/Jelico-0.36.0.exe')
  assert.equal(state.downloadedVersion, '0.36.0')
  assert.equal(state.dismissedApplyVersion, null)
  assert.equal(state.launchedApplyVersion, null)
  assert.equal(state.dismissedAvailableVersion, '0.36.0')
  assert.equal(localStorage.getItem(DOWNLOADED_PATH_KEY), 'C:/tmp/Jelico-0.36.0.exe')
  assert.equal(localStorage.getItem(DOWNLOADED_VERSION_KEY), '0.36.0')
  assert.equal(localStorage.getItem(AVAILABLE_DISMISS_KEY), '0.36.0')
  assert.equal(localStorage.getItem(APPLY_DISMISS_KEY), null)
  assert.equal(localStorage.getItem(APPLY_LAUNCHED_KEY), null)
})

test('applyDownloadedUpdate returns error when no downloaded path exists', async () => {
  const result = await useUpdateStore.getState().applyDownloadedUpdate()
  assert.equal(result, null)
  assert.match(useUpdateStore.getState().error || '', /No downloaded update file is available yet/i)
})

test('applyDownloadedUpdate persists launched installer state after launch succeeds', async () => {
  useUpdateStore.setState({
    lastDownloadedTo: 'C:/tmp/Jelico-0.36.0.exe',
    downloadedVersion: '0.36.0',
    info: {
      currentVersion: '0.35.0',
      latestVersion: '0.36.0',
      isUpdateAvailable: true,
      releaseUrl: 'https://example.com/release',
      publishedAt: '2026-03-04T00:00:00.000Z',
      assets: [],
      recommendedAsset: null,
    },
  })

  setGlobalWindow({
    applyDownloaded: async () => ({
      success: true,
      launchedPath: 'C:/tmp/Jelico-0.36.0.exe',
    }),
  })

  const result = await useUpdateStore.getState().applyDownloadedUpdate()

  assert.deepEqual(result, {
    success: true,
    launchedPath: 'C:/tmp/Jelico-0.36.0.exe',
  })
  assert.equal(useUpdateStore.getState().downloadedVersion, '0.36.0')
  assert.equal(useUpdateStore.getState().lastDownloadedTo, 'C:/tmp/Jelico-0.36.0.exe')
  assert.equal(useUpdateStore.getState().dismissedApplyVersion, null)
  assert.equal(useUpdateStore.getState().launchedApplyVersion, '0.36.0')
  assert.equal(localStorage.getItem(APPLY_DISMISS_KEY), null)
  assert.equal(localStorage.getItem(APPLY_LAUNCHED_KEY), '0.36.0')
})

test('applyDownloadedUpdate clears stale downloaded state when installer is missing', async () => {
  useUpdateStore.setState({
    lastDownloadedTo: 'C:/tmp/Jelico-0.36.0.exe',
    downloadedVersion: '0.36.0',
  })
  localStorage.setItem(DOWNLOADED_PATH_KEY, 'C:/tmp/Jelico-0.36.0.exe')
  localStorage.setItem(DOWNLOADED_VERSION_KEY, '0.36.0')

  setGlobalWindow({
    applyDownloaded: async () => ({
      success: false,
      error: 'Downloaded update file no longer exists.',
    }),
  })

  const result = await useUpdateStore.getState().applyDownloadedUpdate()

  assert.deepEqual(result, {
    success: false,
    error: 'Downloaded update file no longer exists.',
  })
  assert.equal(useUpdateStore.getState().lastDownloadedTo, null)
  assert.equal(useUpdateStore.getState().downloadedVersion, null)
  assert.equal(useUpdateStore.getState().launchedApplyVersion, null)
  assert.equal(localStorage.getItem(DOWNLOADED_PATH_KEY), null)
  assert.equal(localStorage.getItem(DOWNLOADED_VERSION_KEY), null)
  assert.equal(localStorage.getItem(APPLY_LAUNCHED_KEY), null)
})

test('silent check failures do not override an existing visible error', async () => {
  useUpdateStore.setState({ error: 'existing error' })

  setGlobalWindow({
    check: async () => {
      throw new Error('network failure')
    },
  })

  const result = await useUpdateStore.getState().checkForUpdates({ force: true, silent: true })
  assert.equal(result, null)
  assert.equal(useUpdateStore.getState().error, 'existing error')
})

test('successful check clears stale errors even when silent', async () => {
  useUpdateStore.setState({ error: 'stale error' })

  const result = await useUpdateStore.getState().checkForUpdates({ force: true, silent: true })
  assert.ok(result)
  assert.equal(useUpdateStore.getState().error, null)
})

test('checkForUpdates clears stale downloaded state after version advances', async () => {
  useUpdateStore.setState({
    downloadedVersion: '0.36.0',
    lastDownloadedTo: 'C:/tmp/Jelico-0.36.0.exe',
    dismissedApplyVersion: '0.36.0',
    launchedApplyVersion: '0.36.0',
  })
  localStorage.setItem(DOWNLOADED_VERSION_KEY, '0.36.0')
  localStorage.setItem(DOWNLOADED_PATH_KEY, 'C:/tmp/Jelico-0.36.0.exe')
  localStorage.setItem(APPLY_DISMISS_KEY, '0.36.0')
  localStorage.setItem(APPLY_LAUNCHED_KEY, '0.36.0')

  setGlobalWindow({
    check: async () => ({
      currentVersion: '0.37.0',
      latestVersion: '0.37.0',
      isUpdateAvailable: false,
      releaseUrl: 'https://example.com/release',
      publishedAt: '2026-03-04T00:00:00.000Z',
      assets: [],
      recommendedAsset: null,
    }),
  })

  const result = await useUpdateStore.getState().checkForUpdates({ force: true })
  assert.ok(result)
  assert.equal(useUpdateStore.getState().downloadedVersion, null)
  assert.equal(useUpdateStore.getState().lastDownloadedTo, null)
  assert.equal(useUpdateStore.getState().dismissedApplyVersion, null)
  assert.equal(useUpdateStore.getState().launchedApplyVersion, null)
  assert.equal(localStorage.getItem(DOWNLOADED_VERSION_KEY), null)
  assert.equal(localStorage.getItem(DOWNLOADED_PATH_KEY), null)
  assert.equal(localStorage.getItem(APPLY_DISMISS_KEY), null)
  assert.equal(localStorage.getItem(APPLY_LAUNCHED_KEY), null)
})

test('checkForUpdates clears downloaded state after the downloaded version is installed', async () => {
  useUpdateStore.setState({
    downloadedVersion: '0.36.0',
    lastDownloadedTo: 'C:/tmp/Jelico-0.36.0.exe',
    dismissedApplyVersion: '0.36.0',
    launchedApplyVersion: '0.36.0',
  })
  localStorage.setItem(DOWNLOADED_VERSION_KEY, '0.36.0')
  localStorage.setItem(DOWNLOADED_PATH_KEY, 'C:/tmp/Jelico-0.36.0.exe')
  localStorage.setItem(APPLY_DISMISS_KEY, '0.36.0')
  localStorage.setItem(APPLY_LAUNCHED_KEY, '0.36.0')

  setGlobalWindow({
    check: async () => ({
      currentVersion: '0.36.0',
      latestVersion: '0.36.0',
      isUpdateAvailable: false,
      releaseUrl: 'https://example.com/release',
      publishedAt: '2026-03-04T00:00:00.000Z',
      assets: [],
      recommendedAsset: null,
    }),
  })

  const result = await useUpdateStore.getState().checkForUpdates({ force: true })
  assert.ok(result)
  assert.equal(useUpdateStore.getState().downloadedVersion, null)
  assert.equal(useUpdateStore.getState().lastDownloadedTo, null)
  assert.equal(useUpdateStore.getState().dismissedApplyVersion, null)
  assert.equal(useUpdateStore.getState().launchedApplyVersion, null)
  assert.equal(localStorage.getItem(DOWNLOADED_VERSION_KEY), null)
  assert.equal(localStorage.getItem(DOWNLOADED_PATH_KEY), null)
  assert.equal(localStorage.getItem(APPLY_DISMISS_KEY), null)
  assert.equal(localStorage.getItem(APPLY_LAUNCHED_KEY), null)
})

test('checkForUpdates keeps downloaded state when a transient response says no update is available', async () => {
  useUpdateStore.setState({
    downloadedVersion: '0.36.0',
    lastDownloadedTo: 'C:/tmp/Jelico-0.36.0.exe',
    dismissedApplyVersion: '0.36.0',
  })
  localStorage.setItem(DOWNLOADED_VERSION_KEY, '0.36.0')
  localStorage.setItem(DOWNLOADED_PATH_KEY, 'C:/tmp/Jelico-0.36.0.exe')
  localStorage.setItem(APPLY_DISMISS_KEY, '0.36.0')

  setGlobalWindow({
    check: async () => ({
      currentVersion: '0.35.0',
      latestVersion: '0.35.0',
      isUpdateAvailable: false,
      releaseUrl: 'https://example.com/release',
      publishedAt: '2026-03-04T00:00:00.000Z',
      assets: [],
      recommendedAsset: null,
    }),
  })

  const result = await useUpdateStore.getState().checkForUpdates({ force: true })
  assert.ok(result)
  assert.equal(useUpdateStore.getState().downloadedVersion, '0.36.0')
  assert.equal(useUpdateStore.getState().lastDownloadedTo, 'C:/tmp/Jelico-0.36.0.exe')
  assert.equal(useUpdateStore.getState().dismissedApplyVersion, '0.36.0')
  assert.equal(localStorage.getItem(DOWNLOADED_VERSION_KEY), '0.36.0')
  assert.equal(localStorage.getItem(DOWNLOADED_PATH_KEY), 'C:/tmp/Jelico-0.36.0.exe')
  assert.equal(localStorage.getItem(APPLY_DISMISS_KEY), '0.36.0')
})

test('checkForUpdates restores apply prompt after restart when launched installer did not upgrade the app', async () => {
  useUpdateStore.setState({
    downloadedVersion: '0.36.0',
    lastDownloadedTo: 'C:/tmp/Jelico-0.36.0.exe',
    launchedApplyVersion: '0.36.0',
  })
  localStorage.setItem(DOWNLOADED_VERSION_KEY, '0.36.0')
  localStorage.setItem(DOWNLOADED_PATH_KEY, 'C:/tmp/Jelico-0.36.0.exe')
  localStorage.setItem(APPLY_LAUNCHED_KEY, '0.36.0')

  setGlobalWindow({
    check: async () => ({
      currentVersion: '0.35.0',
      latestVersion: '0.36.0',
      isUpdateAvailable: true,
      releaseUrl: 'https://example.com/release',
      publishedAt: '2026-03-04T00:00:00.000Z',
      assets: [],
      recommendedAsset: null,
    }),
  })

  const result = await useUpdateStore.getState().checkForUpdates({ force: true })
  assert.ok(result)
  assert.equal(useUpdateStore.getState().downloadedVersion, '0.36.0')
  assert.equal(useUpdateStore.getState().lastDownloadedTo, 'C:/tmp/Jelico-0.36.0.exe')
  assert.equal(useUpdateStore.getState().launchedApplyVersion, null)
  assert.equal(localStorage.getItem(DOWNLOADED_VERSION_KEY), '0.36.0')
  assert.equal(localStorage.getItem(DOWNLOADED_PATH_KEY), 'C:/tmp/Jelico-0.36.0.exe')
  assert.equal(localStorage.getItem(APPLY_LAUNCHED_KEY), null)
})

test('loadCurrentVersion restores apply prompt offline after a canceled installer launch', async () => {
  useUpdateStore.setState({
    downloadedVersion: '0.36.0',
    lastDownloadedTo: 'C:/tmp/Jelico-0.36.0.exe',
    launchedApplyVersion: '0.36.0',
  })
  localStorage.setItem(DOWNLOADED_VERSION_KEY, '0.36.0')
  localStorage.setItem(DOWNLOADED_PATH_KEY, 'C:/tmp/Jelico-0.36.0.exe')
  localStorage.setItem(APPLY_LAUNCHED_KEY, '0.36.0')

  setGlobalWindow({
    getCurrentVersion: async () => '0.35.0',
  })

  const version = await useUpdateStore.getState().loadCurrentVersion()

  assert.equal(version, '0.35.0')
  assert.equal(useUpdateStore.getState().launchedApplyVersion, null)
  assert.equal(useUpdateStore.getState().downloadedVersion, '0.36.0')
  assert.equal(localStorage.getItem(APPLY_LAUNCHED_KEY), null)
  assert.equal(localStorage.getItem(DOWNLOADED_VERSION_KEY), '0.36.0')
})

test('loadCurrentVersion restores a snoozed apply banner on app restart', async () => {
  useUpdateStore.setState({
    downloadedVersion: '0.36.0',
    lastDownloadedTo: 'C:/tmp/Jelico-0.36.0.exe',
    dismissedApplyVersion: '0.36.0',
  })
  localStorage.setItem(DOWNLOADED_VERSION_KEY, '0.36.0')
  localStorage.setItem(DOWNLOADED_PATH_KEY, 'C:/tmp/Jelico-0.36.0.exe')
  localStorage.setItem(APPLY_DISMISS_KEY, '0.36.0')

  setGlobalWindow({
    getCurrentVersion: async () => '0.35.0',
  })

  const version = await useUpdateStore.getState().loadCurrentVersion()

  assert.equal(version, '0.35.0')
  assert.equal(useUpdateStore.getState().dismissedApplyVersion, null)
  assert.equal(useUpdateStore.getState().downloadedVersion, '0.36.0')
  assert.equal(localStorage.getItem(APPLY_DISMISS_KEY), null)
  assert.equal(localStorage.getItem(DOWNLOADED_VERSION_KEY), '0.36.0')
})

test('loadCurrentVersion preserves same-version downloaded state until a network check confirms it is stale', async () => {
  useUpdateStore.setState({
    downloadedVersion: '0.36.0',
    lastDownloadedTo: 'C:/tmp/Jelico-0.36.0.exe',
  })
  localStorage.setItem(DOWNLOADED_VERSION_KEY, '0.36.0')
  localStorage.setItem(DOWNLOADED_PATH_KEY, 'C:/tmp/Jelico-0.36.0.exe')

  setGlobalWindow({
    getCurrentVersion: async () => '0.36.0',
  })

  const version = await useUpdateStore.getState().loadCurrentVersion()

  assert.equal(version, '0.36.0')
  assert.equal(useUpdateStore.getState().downloadedVersion, '0.36.0')
  assert.equal(useUpdateStore.getState().lastDownloadedTo, 'C:/tmp/Jelico-0.36.0.exe')
  assert.equal(useUpdateStore.getState().dismissedApplyVersion, null)
  assert.equal(useUpdateStore.getState().launchedApplyVersion, null)
  assert.equal(localStorage.getItem(DOWNLOADED_VERSION_KEY), '0.36.0')
  assert.equal(localStorage.getItem(DOWNLOADED_PATH_KEY), 'C:/tmp/Jelico-0.36.0.exe')
  assert.equal(localStorage.getItem(APPLY_DISMISS_KEY), null)
  assert.equal(localStorage.getItem(APPLY_LAUNCHED_KEY), null)
})
