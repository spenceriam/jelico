import { useProviderStore } from '../../stores/providers'
import { useUIStore } from '../../stores/ui'
import { ProviderSetup } from '../Setup/ProviderSetup'
import { WelcomeScreen } from './WelcomeScreen'

export function OnboardingFlow() {
  const { providers, loadProviders } = useProviderStore()
  const { onboardingComplete, completeOnboarding } = useUIStore()

  // First, need to set up a provider
  if (providers.length === 0) {
    return <ProviderSetup onComplete={loadProviders} />
  }

  // Then, show welcome screen if onboarding not complete
  if (!onboardingComplete) {
    return <WelcomeScreen onComplete={completeOnboarding} />
  }

  // Shouldn't reach here, but return null just in case
  return null
}
