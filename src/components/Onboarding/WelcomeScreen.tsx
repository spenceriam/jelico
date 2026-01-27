import { useState } from 'react'
import { ArrowRight, ArrowLeft, FolderOpen, Sparkles } from 'lucide-react'
import { ModeSelector } from '../ModeSelector/ModeSelector'
import { WorkspaceSelector } from '../Workspace/WorkspaceSelector'

interface WelcomeScreenProps {
  onComplete: (profile: OnboardingProfile) => void
}

export interface OnboardingProfile {
  name: string
  intentions: string
  preferences: string
  additionalInfo: string
}

type OnboardingStep = 'name' | 'intentions' | 'preferences' | 'additional' | 'setup'

const STEP_ORDER: OnboardingStep[] = ['name', 'intentions', 'preferences', 'additional', 'setup']

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [step, setStep] = useState<OnboardingStep>('name')
  const [profile, setProfile] = useState<OnboardingProfile>({
    name: '',
    intentions: '',
    preferences: '',
    additionalInfo: '',
  })

  const currentStepIndex = STEP_ORDER.indexOf(step)
  const isLastStep = step === 'setup'

  const canContinue = () => {
    switch (step) {
      case 'name':
        return profile.name.trim().length > 0
      case 'intentions':
      case 'preferences':
      case 'additional':
      case 'setup':
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (isLastStep) {
      onComplete(profile)
    } else {
      const nextIndex = currentStepIndex + 1
      if (nextIndex < STEP_ORDER.length) {
        setStep(STEP_ORDER[nextIndex])
      }
    }
  }

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setStep(STEP_ORDER[prevIndex])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && canContinue()) {
      e.preventDefault()
      handleNext()
    }
  }

  // Step 1: Name
  if (step === 'name') {
    return (
      <div className="min-h-screen bg-bg-void flex items-center justify-center p-10">
        <div className="w-full max-w-[500px] animate-fade-in">
          <div className="text-center mb-10">
            <div className="welcome-logo mb-6">J</div>
            <h1 className="font-display text-[32px] font-normal text-text-primary mb-3 tracking-tight">
              Hello! I'm Jelico.
            </h1>
            <p className="text-text-secondary text-lg">
              I'm excited to work with you. Let's get to know each other.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-base font-medium text-text-primary mb-3">
                What should I call you?
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="Your name"
                autoFocus
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-lg text-text-primary text-lg placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleNext}
                disabled={!canContinue()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-black font-medium rounded-lg hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Intentions
  if (step === 'intentions') {
    return (
      <div className="min-h-screen bg-bg-void flex items-center justify-center p-10">
        <div className="w-full max-w-[550px] animate-slide-in">
          <div className="text-center mb-10">
            <h1 className="font-display text-[28px] font-normal text-text-primary mb-3 tracking-tight">
              Nice to meet you, {profile.name}!
            </h1>
            <p className="text-text-secondary text-base">
              I'd love to understand what brings you here.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-base font-medium text-text-primary mb-3">
                What are you hoping to accomplish with me?
              </label>
              <p className="text-sm text-text-muted mb-3">
                Are you building software, writing content, learning something new, or something else entirely?
              </p>
              <textarea
                value={profile.intentions}
                onChange={(e) => setProfile({ ...profile, intentions: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="I'm working on... / I want to... / I need help with..."
                rows={4}
                autoFocus
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
              />
            </div>

            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-black font-medium rounded-lg hover:bg-accent-bright transition-colors"
              >
                {profile.intentions.trim() ? 'Continue' : 'Skip for now'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Preferences
  if (step === 'preferences') {
    return (
      <div className="min-h-screen bg-bg-void flex items-center justify-center p-10">
        <div className="w-full max-w-[550px] animate-slide-in">
          <div className="text-center mb-10">
            <h1 className="font-display text-[28px] font-normal text-text-primary mb-3 tracking-tight">
              How do you like to work?
            </h1>
            <p className="text-text-secondary text-base">
              This helps me tailor my responses to your style.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-base font-medium text-text-primary mb-3">
                Any preferences for how I should communicate?
              </label>
              <p className="text-sm text-text-muted mb-3">
                Do you prefer detailed explanations or concise answers? Technical depth or high-level overviews? Formal or casual tone?
              </p>
              <textarea
                value={profile.preferences}
                onChange={(e) => setProfile({ ...profile, preferences: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="I prefer... / Please always... / I like when..."
                rows={4}
                autoFocus
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
              />
            </div>

            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-black font-medium rounded-lg hover:bg-accent-bright transition-colors"
              >
                {profile.preferences.trim() ? 'Continue' : 'Skip for now'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 4: Additional info
  if (step === 'additional') {
    return (
      <div className="min-h-screen bg-bg-void flex items-center justify-center p-10">
        <div className="w-full max-w-[550px] animate-slide-in">
          <div className="text-center mb-10">
            <h1 className="font-display text-[28px] font-normal text-text-primary mb-3 tracking-tight">
              Anything else I should know?
            </h1>
            <p className="text-text-secondary text-base">
              Share anything that might help me assist you better.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-base font-medium text-text-primary mb-3">
                Is there anything else you'd like to tell me upfront?
              </label>
              <p className="text-sm text-text-muted mb-3">
                Your background, specific tools you use, things to avoid, or anything that would help me understand you better.
              </p>
              <textarea
                value={profile.additionalInfo}
                onChange={(e) => setProfile({ ...profile, additionalInfo: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="You should know that... / I often work with... / Please remember..."
                rows={4}
                autoFocus
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
              />
            </div>

            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-black font-medium rounded-lg hover:bg-accent-bright transition-colors"
              >
                {profile.additionalInfo.trim() ? 'Continue' : 'Skip for now'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 5: Setup (workspace & mode)
  return (
    <div className="min-h-screen bg-bg-void flex items-center justify-center p-10">
      <div className="w-full max-w-[650px] animate-slide-in">
        <div className="text-center mb-10">
          <h1 className="font-display text-[28px] font-normal text-text-primary mb-3 tracking-tight">
            Great, {profile.name}! One last thing.
          </h1>
          <p className="text-text-secondary text-base">
            Let's set up your workspace. You can always change these later.
          </p>
        </div>

        <div className="space-y-6">
          {/* Workspace selection */}
          <div className="p-5 bg-bg-surface rounded-xl border border-border">
            <h3 className="font-medium text-text-primary mb-2 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-accent" />
              Select a Workspace
            </h3>
            <p className="text-sm text-text-muted mb-4">
              Connect a folder so I can help with your project files, or use the sandbox for quick experiments.
            </p>
            <WorkspaceSelector />
          </div>

          {/* Mode selection */}
          <div className="p-5 bg-bg-surface rounded-xl border border-border">
            <h3 className="font-medium text-text-primary mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              Choose a Mode
            </h3>
            <p className="text-sm text-text-muted mb-4">
              Auto mode adapts to what you need. Or pick a specific mode for focused work.
            </p>
            <ModeSelector />
          </div>
        </div>

        <div className="flex justify-between mt-8">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-8 py-3 bg-accent text-black font-medium rounded-lg hover:bg-accent-bright transition-colors"
          >
            Let's Begin
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
