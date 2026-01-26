import { useEffect } from 'react'
import { useProviderStore } from './stores/providers'
import { useChatStore } from './stores/chat'
import { useUIStore } from './stores/ui'
import { Sidebar } from './components/Layout/Sidebar'
import { Header } from './components/Layout/Header'
import { ChatArea } from './components/Chat/ChatArea'
import { ProviderSetup } from './components/Setup/ProviderSetup'
import { Settings } from './components/Settings/Settings'

export default function App() {
  const { providers, loadProviders, isLoading } = useProviderStore()
  const { loadConversations } = useChatStore()
  const { settingsOpen, closeSettings, providerSetupOpen, closeProviderSetup } = useUIStore()

  useEffect(() => {
    loadProviders()
    loadConversations()
  }, [])

  // Show loading state
  if (isLoading && providers.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-void">
        <div className="text-text-secondary">Loading...</div>
      </div>
    )
  }

  // Show provider setup if no providers configured
  if (providers.length === 0) {
    return <ProviderSetup onComplete={loadProviders} />
  }

  return (
    <div className="h-screen flex bg-bg-void text-text-primary overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <Header />
        <ChatArea />
      </main>

      {/* Settings modal */}
      {settingsOpen && (
        <Settings onClose={closeSettings} />
      )}

      {/* Provider setup modal (for adding additional providers) */}
      {providerSetupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-surface rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-auto">
            <ProviderSetup
              isModal
              onComplete={() => {
                loadProviders()
                closeProviderSetup()
              }}
              onCancel={closeProviderSetup}
            />
          </div>
        </div>
      )}
    </div>
  )
}
