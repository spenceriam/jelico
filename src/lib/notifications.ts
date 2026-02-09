import notificationSoundUrl from '../assets/sounds/notification.wav'

type NotificationEventType = 'turn_complete' | 'needs_input'

interface NotificationPrefs {
  desktopEnabled: boolean
  soundEnabled: boolean
  notifyOnTurnComplete: boolean
  notifyOnNeedsInput: boolean
}

interface NotificationPayload {
  title: string
  body: string
}

const PREF_KEYS = {
  desktopEnabled: 'desktopNotificationsEnabled',
  soundEnabled: 'soundNotificationsEnabled',
  notifyOnTurnComplete: 'notifyOnTurnComplete',
  notifyOnNeedsInput: 'notifyOnNeedsInput',
} as const

const DEFAULT_PREFS: NotificationPrefs = {
  desktopEnabled: false,
  soundEnabled: false,
  notifyOnTurnComplete: true,
  notifyOnNeedsInput: true,
}

let cachedAudio: HTMLAudioElement | null = null

async function getBooleanPreference(
  key: string,
  fallback: boolean
): Promise<boolean> {
  try {
    const pref = await window.jelico.soul.getPreference(key)
    if (pref?.value === undefined || pref?.value === null) return fallback
    return Boolean(pref.value)
  } catch {
    return fallback
  }
}

async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const [desktopEnabled, soundEnabled, notifyOnTurnComplete, notifyOnNeedsInput] = await Promise.all([
    getBooleanPreference(PREF_KEYS.desktopEnabled, DEFAULT_PREFS.desktopEnabled),
    getBooleanPreference(PREF_KEYS.soundEnabled, DEFAULT_PREFS.soundEnabled),
    getBooleanPreference(PREF_KEYS.notifyOnTurnComplete, DEFAULT_PREFS.notifyOnTurnComplete),
    getBooleanPreference(PREF_KEYS.notifyOnNeedsInput, DEFAULT_PREFS.notifyOnNeedsInput),
  ])

  return {
    desktopEnabled,
    soundEnabled,
    notifyOnTurnComplete,
    notifyOnNeedsInput,
  }
}

async function showDesktopNotification(payload: NotificationPayload): Promise<void> {
  if (!('Notification' in window)) return

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }

  if (permission !== 'granted') return

  new Notification(payload.title, {
    body: payload.body,
    silent: true,
  })
}

async function playNotificationSound(): Promise<void> {
  if (!cachedAudio) {
    cachedAudio = new Audio(notificationSoundUrl)
    cachedAudio.preload = 'auto'
    cachedAudio.volume = 0.9
  }

  try {
    cachedAudio.currentTime = 0
    await cachedAudio.play()
  } catch (error) {
    // Audio playback can be blocked by OS/browser policy in some contexts.
    console.warn('[Notifications] Failed to play notification sound:', error)
  }
}

function isEventEnabled(eventType: NotificationEventType, prefs: NotificationPrefs): boolean {
  switch (eventType) {
    case 'turn_complete':
      return prefs.notifyOnTurnComplete
    case 'needs_input':
      return prefs.notifyOnNeedsInput
    default:
      return false
  }
}

export async function notifyUserEvent(
  eventType: NotificationEventType,
  payload: NotificationPayload
): Promise<void> {
  const prefs = await getNotificationPrefs()
  if (!isEventEnabled(eventType, prefs)) return

  const tasks: Promise<void>[] = []
  if (prefs.desktopEnabled) {
    tasks.push(showDesktopNotification(payload))
  }
  if (prefs.soundEnabled) {
    tasks.push(playNotificationSound())
  }

  if (tasks.length === 0) return
  await Promise.allSettled(tasks)
}

