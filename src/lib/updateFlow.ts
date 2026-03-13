import { useChatStore } from '../stores/chat'
import { useDecisionPromptStore } from '../stores/decisionPrompt'
import { useUpdateStore } from '../stores/updates'

export function hasAnyStreamingConversation(): boolean {
  const { conversationStreams, isStreaming } = useChatStore.getState()
  if (isStreaming) return true
  return Object.values(conversationStreams).some((streamState) => streamState.isStreaming)
}

function getDownloadedUpdateVersion(): string | null {
  const { downloadedVersion, info } = useUpdateStore.getState()
  return downloadedVersion ?? info?.latestVersion ?? null
}

async function promptForImmediateRestart(version: string): Promise<boolean> {
  const { request } = useDecisionPromptStore.getState()
  const result = await request({
    title: `Restart to install Jelico ${version}?`,
    message: 'Applying the update will close Jelico, install the new version, clean up the downloaded installer, and reopen the app where you left off.',
    detail: 'Choose Later to keep the update downloaded without restarting right now.',
    options: [
      { label: 'Restart and install', value: 'restart', variant: 'primary' },
      { label: 'Later', value: 'later', variant: 'secondary' },
    ],
    defaultValue: 'restart',
    cancelValue: 'later',
  })

  return result.value === 'restart'
}

async function promptForRestartAfterTurn(version: string): Promise<boolean> {
  const { request } = useDecisionPromptStore.getState()
  const result = await request({
    title: `Finish updating to Jelico ${version} after active turns finish?`,
    message: 'Jelico can wait for all active AI turns to finish, then restart automatically and apply the update.',
    detail: 'Choose Later to keep the downloaded update ready without interrupting any in-flight response.',
    options: [
      { label: 'Restart after turns', value: 'after-turn', variant: 'primary' },
      { label: 'Later', value: 'later', variant: 'secondary' },
    ],
    defaultValue: 'after-turn',
    cancelValue: 'later',
  })

  return result.value === 'after-turn'
}

export async function runDownloadAndApplyFlow(): Promise<void> {
  const updateState = useUpdateStore.getState()
  if (updateState.isDownloading || updateState.isApplying) return

  const result = await updateState.downloadUpdate()
  if (!result?.savedTo) return

  await runApplyDownloadedUpdateFlow()
}

export async function runApplyDownloadedUpdateFlow(): Promise<void> {
  const updateState = useUpdateStore.getState()
  if (updateState.isApplying) return
  if (!updateState.lastDownloadedTo) {
    await updateState.applyDownloadedUpdate()
    return
  }

  const version = getDownloadedUpdateVersion()
  if (!version) {
    await updateState.applyDownloadedUpdate()
    return
  }

  if (hasAnyStreamingConversation()) {
    const shouldSchedule = await promptForRestartAfterTurn(version)
    if (shouldSchedule) {
      useUpdateStore.getState().scheduleApplyAfterTurn(version)
    } else {
      useUpdateStore.getState().clearScheduledApply()
    }
    return
  }

  const shouldRestart = await promptForImmediateRestart(version)
  if (!shouldRestart) {
    useUpdateStore.getState().clearScheduledApply()
    return
  }

  await useUpdateStore.getState().applyDownloadedUpdate()
}

export async function maybeAutoApplyScheduledUpdate(): Promise<void> {
  const updateState = useUpdateStore.getState()
  if (updateState.isApplying || hasAnyStreamingConversation()) return

  const version = getDownloadedUpdateVersion()
  if (!updateState.scheduledApplyVersion) return

  if (!version || updateState.scheduledApplyVersion !== version) {
    useUpdateStore.getState().clearScheduledApply()
    return
  }

  useUpdateStore.getState().clearScheduledApply()
  await useUpdateStore.getState().applyDownloadedUpdate()
}
