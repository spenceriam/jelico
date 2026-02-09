import { useState, useEffect } from 'react'
import { Check, Moon, Sun, Monitor, Palette, User, Brain, Sparkles, Package, Download, RefreshCw, ArrowUpRight, Bell } from 'lucide-react'
import { useThemeStore, COLOR_THEMES, type ThemeMode } from '../../stores/theme'
import { useChatStore } from '../../stores/chat'
import { useUpdateStore } from '../../stores/updates'
import type { AgentMode } from '../../lib/modes'

const THEME_MODES: { id: ThemeMode; name: string; icon: typeof Sun }[] = [
  { id: 'dark', name: 'Dark', icon: Moon },
  { id: 'light', name: 'Light', icon: Sun },
  { id: 'system', name: 'System', icon: Monitor },
]

const AGENT_MODES: { id: AgentMode; name: string; description: string }[] = [
  { id: 'auto', name: 'Auto', description: 'AI decides the best approach' },
  { id: 'explore', name: 'Explore', description: 'Read-only understanding and analysis' },
  { id: 'execute', name: 'Execute', description: 'Full tool access, take action' },
  { id: 'plan', name: 'Plan', description: 'Strategic planning and roadmaps' },
  { id: 'review', name: 'Review', description: 'Quality assurance and feedback' },
]

function parseSemver(version: string): [number, number, number] {
  const cleaned = version.trim().replace(/^v/i, '')
  const main = cleaned.split('-')[0] || cleaned
  const parts = main.split('.')
  return [
    Number(parts[0]) || 0,
    Number(parts[1]) || 0,
    Number(parts[2]) || 0,
  ]
}

function compareSemver(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseSemver(a)
  const [bMajor, bMinor, bPatch] = parseSemver(b)

  if (aMajor !== bMajor) return aMajor > bMajor ? 1 : -1
  if (aMinor !== bMinor) return aMinor > bMinor ? 1 : -1
  if (aPatch !== bPatch) return aPatch > bPatch ? 1 : -1
  return 0
}

export function GeneralSettings() {
  const { mode, colorThemeId, setMode, setColorTheme } = useThemeStore()
  const { mode: defaultMode, setMode: setDefaultMode } = useChatStore()
  const { info, currentVersion, isChecking, isDownloading, downloadProgress, lastDownloadedTo, error, checkForUpdates, downloadUpdate } = useUpdateStore()
  const versionStatus = (() => {
    if (!info) return null

    const comparison = compareSemver(info.currentVersion, info.latestVersion)
    if (comparison < 0) {
      return { text: 'Update available', className: 'text-accent' }
    }
    if (comparison > 0) {
      return { text: 'Running newer than latest release', className: 'text-text-muted' }
    }
    return { text: 'Up to date', className: 'text-text-secondary' }
  })()

  // User profile state (loaded from soul)
  const [userName, setUserName] = useState('')
  const [userIntentions, setUserIntentions] = useState('')
  const [userPreferences, setUserPreferences] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Memory settings
  const [learningEnabled, setLearningEnabled] = useState(true)

  // Sandbox settings
  const [crossSandboxSearch, setCrossSandboxSearch] = useState(false)

  // Notification settings
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(false)
  const [soundNotificationsEnabled, setSoundNotificationsEnabled] = useState(false)
  const [notifyOnTurnComplete, setNotifyOnTurnComplete] = useState(true)
  const [notifyOnNeedsInput, setNotifyOnNeedsInput] = useState(true)

  // Load user profile from soul
  useEffect(() => {
    async function loadProfile() {
      setIsLoadingProfile(true)
      try {
        const [
          name,
          intentions,
          preferences,
          additional,
          learning,
          crossSandbox,
          desktopNotifications,
          soundNotifications,
          turnCompleteNotifications,
          needsInputNotifications,
        ] = await Promise.all([
          window.jelico.soul.getPreference('userName'),
          window.jelico.soul.getPreference('userIntentions'),
          window.jelico.soul.getPreference('userPreferences'),
          window.jelico.soul.getPreference('additionalInfo'),
          window.jelico.soul.getPreference('learningEnabled'),
          window.jelico.soul.getPreference('crossSandboxSearch'),
          window.jelico.soul.getPreference('desktopNotificationsEnabled'),
          window.jelico.soul.getPreference('soundNotificationsEnabled'),
          window.jelico.soul.getPreference('notifyOnTurnComplete'),
          window.jelico.soul.getPreference('notifyOnNeedsInput'),
        ])

        if (name?.value) setUserName(name.value as string)
        if (intentions?.value) setUserIntentions(intentions.value as string)
        if (preferences?.value) setUserPreferences(preferences.value as string)
        if (additional?.value) setAdditionalInfo(additional.value as string)
        if (learning?.value !== undefined) setLearningEnabled(learning.value as boolean)
        if (crossSandbox?.value !== undefined) setCrossSandboxSearch(crossSandbox.value as boolean)
        if (desktopNotifications?.value !== undefined) setDesktopNotificationsEnabled(desktopNotifications.value as boolean)
        if (soundNotifications?.value !== undefined) setSoundNotificationsEnabled(soundNotifications.value as boolean)
        if (turnCompleteNotifications?.value !== undefined) setNotifyOnTurnComplete(turnCompleteNotifications.value as boolean)
        if (needsInputNotifications?.value !== undefined) setNotifyOnNeedsInput(needsInputNotifications.value as boolean)
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setIsLoadingProfile(false)
      }
    }
    loadProfile()
  }, [])

  const handleSaveProfile = async () => {
    setIsSavingProfile(true)
    try {
      await Promise.all([
        window.jelico.soul.setPreference('userName', userName.trim(), 1.0),
        window.jelico.soul.setPreference('userIntentions', userIntentions.trim(), 1.0),
        window.jelico.soul.setPreference('userPreferences', userPreferences.trim(), 1.0),
        window.jelico.soul.setPreference('additionalInfo', additionalInfo.trim(), 1.0),
      ])
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSaveLearningSettings = async () => {
    try {
      await window.jelico.soul.setPreference('learningEnabled', learningEnabled, 1.0)
    } catch (err) {
      console.error('Failed to save learning settings:', err)
    }
  }

  const handleSaveSandboxSettings = async () => {
    try {
      await window.jelico.soul.setPreference('crossSandboxSearch', crossSandboxSearch, 1.0)
    } catch (err) {
      console.error('Failed to save sandbox settings:', err)
    }
  }

  const handleSaveNotificationSettings = async () => {
    try {
      await Promise.all([
        window.jelico.soul.setPreference('desktopNotificationsEnabled', desktopNotificationsEnabled, 1.0),
        window.jelico.soul.setPreference('soundNotificationsEnabled', soundNotificationsEnabled, 1.0),
        window.jelico.soul.setPreference('notifyOnTurnComplete', notifyOnTurnComplete, 1.0),
        window.jelico.soul.setPreference('notifyOnNeedsInput', notifyOnNeedsInput, 1.0),
      ])
    } catch (err) {
      console.error('Failed to save notification settings:', err)
    }
  }

  // Save learning settings when they change
  useEffect(() => {
    if (!isLoadingProfile) {
      handleSaveLearningSettings()
    }
  }, [learningEnabled])

  // Save sandbox settings when they change
  useEffect(() => {
    if (!isLoadingProfile) {
      handleSaveSandboxSettings()
    }
  }, [crossSandboxSearch])

  // Save notification settings when they change
  useEffect(() => {
    if (!isLoadingProfile) {
      handleSaveNotificationSettings()
    }
  }, [desktopNotificationsEnabled, soundNotificationsEnabled, notifyOnTurnComplete, notifyOnNeedsInput])

  const handleOpenReleaseNotes = async () => {
    if (info?.releaseUrl) {
      await window.jelico.updates.openRelease(info.releaseUrl)
    }
  }

  const handleToggleDesktopNotifications = async () => {
    const nextValue = !desktopNotificationsEnabled
    if (!nextValue) {
      setDesktopNotificationsEnabled(false)
      return
    }

    if (!('Notification' in window)) {
      console.warn('Desktop notifications are not supported in this environment')
      return
    }

    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          console.warn('Desktop notification permission not granted')
          return
        }
      } catch (err) {
        console.warn('Failed to request desktop notification permission:', err)
        return
      }
    } else if (Notification.permission !== 'granted') {
      console.warn('Desktop notifications are blocked by the OS/browser permission settings')
      return
    }

    setDesktopNotificationsEnabled(true)
  }

  return (
    <div className="space-y-8">
      {/* Appearance Section */}
      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Appearance
        </h3>

        {/* Theme Mode */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Theme Mode
          </label>
          <div className="flex gap-2">
            {THEME_MODES.map((themeMode) => {
              const Icon = themeMode.icon
              return (
                <button
                  key={themeMode.id}
                  onClick={() => setMode(themeMode.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    mode === themeMode.id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{themeMode.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Color Theme */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Color Theme
          </label>
          <div className="grid grid-cols-5 gap-2">
            {COLOR_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setColorTheme(theme.id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                  colorThemeId === theme.id
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:border-border-strong'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full border-2 border-white/20"
                  style={{ backgroundColor: theme.dark.accent }}
                />
                <span className="text-xs text-text-secondary">{theme.name}</span>
                {colorThemeId === theme.id && (
                  <Check className="w-3 h-3 text-accent" />
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Updates Section */}
      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Updates
        </h3>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 p-4 bg-bg-elevated rounded-lg border border-border">
            <div>
              <div className="font-medium text-text-primary">Version</div>
              <div className="text-sm text-text-muted">
                Current: {currentVersion ?? info?.currentVersion ?? 'Unknown'}
              </div>
              {info?.latestVersion && (
                <div className="text-sm text-text-muted">
                  Latest: {info.latestVersion}
                </div>
              )}
              {versionStatus && (
                <div className={`text-sm mt-1 ${versionStatus.className}`}>{versionStatus.text}</div>
              )}
              {error && (
                <div className="text-sm text-error mt-1">{error}</div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => checkForUpdates()}
                disabled={isChecking}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                Check for updates
              </button>

              {info?.isUpdateAvailable && (
                <button
                  onClick={() => downloadUpdate()}
                  disabled={isDownloading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-black hover:bg-accent-bright transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {isDownloading ? 'Downloading...' : 'Download update'}
                </button>
              )}

              {info?.releaseUrl && (
                <button
                  onClick={handleOpenReleaseNotes}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Release notes
                </button>
              )}
            </div>

            {isDownloading && (
              <div className="space-y-1">
                <div className="h-2 bg-bg-deep rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${downloadProgress?.percent ?? 0}%` }}
                  />
                </div>
                <div className="text-xs text-text-muted">
                  {downloadProgress?.percent !== null && downloadProgress?.percent !== undefined
                    ? `Downloading... ${downloadProgress.percent}%`
                    : 'Downloading...'}
                </div>
              </div>
            )}

            {lastDownloadedTo && !isDownloading && (
              <div className="text-xs text-text-muted">
                Downloaded to: {lastDownloadedTo}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* User Profile Section */}
      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Your Profile
        </h3>

        {isLoadingProfile ? (
          <div className="text-text-muted">Loading profile...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
                placeholder="What should Jelico call you?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Your Intentions
              </label>
              <textarea
                value={userIntentions}
                onChange={(e) => setUserIntentions(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent resize-none"
                placeholder="What are you working on? What brings you here?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Communication Preferences
              </label>
              <textarea
                value={userPreferences}
                onChange={(e) => setUserPreferences(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent resize-none"
                placeholder="How do you prefer Jelico to communicate?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Additional Context
              </label>
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent resize-none"
                placeholder="Anything else Jelico should know about you?"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-black rounded-lg hover:bg-accent-bright transition-colors disabled:opacity-50"
            >
              {profileSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : isSavingProfile ? (
                'Saving...'
              ) : (
                'Save Profile'
              )}
            </button>
          </div>
        )}
      </section>

      {/* Default Mode Section */}
      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Default Mode
        </h3>

        <div className="grid grid-cols-1 gap-2">
          {AGENT_MODES.map((agentMode) => (
            <button
              key={agentMode.id}
              onClick={() => setDefaultMode(agentMode.id)}
              className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-left ${
                defaultMode === agentMode.id
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-border-strong'
              }`}
            >
              <div>
                <div className={`font-medium ${defaultMode === agentMode.id ? 'text-accent' : 'text-text-primary'}`}>
                  {agentMode.name}
                </div>
                <div className="text-sm text-text-muted">{agentMode.description}</div>
              </div>
              {defaultMode === agentMode.id && (
                <Check className="w-4 h-4 text-accent" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Memory & Learning Section */}
      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Memory & Learning
        </h3>

        <div className="space-y-4">
          {/* Learning Toggle */}
          <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg border border-border">
            <div>
              <div className="font-medium text-text-primary">Learn from conversations</div>
              <div className="text-sm text-text-muted">
                Jelico will remember patterns, preferences, and corrections forever
              </div>
            </div>
            <button
              onClick={() => setLearningEnabled(!learningEnabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                learningEnabled ? 'bg-accent' : 'bg-bg-deep'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  learningEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <p className="text-sm text-text-muted">
            When enabled, Jelico learns your preferences, coding style, and common corrections over time.
            You can view and manage what Jelico has learned in the Memory section of the Backup settings.
          </p>
        </div>
      </section>

      {/* Notifications Section */}
      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg border border-border">
            <div>
              <div className="font-medium text-text-primary">Desktop notifications</div>
              <div className="text-sm text-text-muted">
                Show OS notifications when configured events happen
              </div>
            </div>
            <button
              onClick={handleToggleDesktopNotifications}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                desktopNotificationsEnabled ? 'bg-accent' : 'bg-bg-deep'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  desktopNotificationsEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg border border-border">
            <div>
              <div className="font-medium text-text-primary">Sound notifications</div>
              <div className="text-sm text-text-muted">
                Play a sound when configured events happen
              </div>
            </div>
            <button
              onClick={() => setSoundNotificationsEnabled(!soundNotificationsEnabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                soundNotificationsEnabled ? 'bg-accent' : 'bg-bg-deep'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  soundNotificationsEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg border border-border">
            <div>
              <div className="font-medium text-text-primary">Notify when response completes</div>
              <div className="text-sm text-text-muted">
                Trigger notification when Jelico finishes a turn
              </div>
            </div>
            <button
              onClick={() => setNotifyOnTurnComplete(!notifyOnTurnComplete)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                notifyOnTurnComplete ? 'bg-accent' : 'bg-bg-deep'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  notifyOnTurnComplete ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg border border-border">
            <div>
              <div className="font-medium text-text-primary">Notify when input is needed</div>
              <div className="text-sm text-text-muted">
                Trigger notification when Jelico asks a clarification question
              </div>
            </div>
            <button
              onClick={() => setNotifyOnNeedsInput(!notifyOnNeedsInput)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                notifyOnNeedsInput ? 'bg-accent' : 'bg-bg-deep'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  notifyOnNeedsInput ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <p className="text-sm text-text-muted">
            Tip: Enable sound and/or desktop delivery, then choose which events should trigger alerts.
          </p>
        </div>
      </section>

      {/* Sandbox Section */}
      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Package className="w-5 h-5" />
          Sandbox
        </h3>

        <div className="space-y-4">
          {/* Cross-sandbox search toggle */}
          <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg border border-border">
            <div>
              <div className="font-medium text-text-primary">Allow cross-conversation sandbox search</div>
              <div className="text-sm text-text-muted">
                When enabled and you explicitly request it, Jelico can search files in other conversation sandboxes
              </div>
            </div>
            <button
              onClick={() => setCrossSandboxSearch(!crossSandboxSearch)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                crossSandboxSearch ? 'bg-accent' : 'bg-bg-deep'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  crossSandboxSearch ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <p className="text-sm text-warning">
              <strong>Important:</strong> Even when enabled, Jelico will only search other sandboxes when you explicitly ask.
              The AI will never proactively search other conversation sandboxes on its own.
            </p>
          </div>

          <p className="text-sm text-text-muted">
            Each conversation has its own isolated sandbox directory. Files created without a workspace
            are stored there. This setting allows searching across sandboxes when you need to find
            something from a previous session.
          </p>
        </div>
      </section>
    </div>
  )
}
