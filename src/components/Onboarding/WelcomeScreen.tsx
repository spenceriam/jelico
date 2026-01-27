import { useState } from 'react'
import { ArrowRight, FolderOpen, Upload, Sparkles } from 'lucide-react'
import { ModeSelector } from '../ModeSelector/ModeSelector'
import { WorkspaceSelector } from '../Workspace/WorkspaceSelector'

interface WelcomeScreenProps {
  onComplete: () => void
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [step, setStep] = useState<'welcome' | 'setup'>('welcome')
  const [name, setName] = useState('')

  const handleContinue = () => {
    if (step === 'welcome') {
      setStep('setup')
    } else {
      onComplete()
    }
  }

  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-bg-void flex items-center justify-center p-10">
        <div className="w-full max-w-[600px] text-center animate-fade-in">
          {/* Logo */}
          <div className="welcome-logo mb-6">J</div>

          {/* Welcome text */}
          <h1 className="font-display text-[36px] font-normal text-text-primary mb-3 tracking-tight">
            Welcome to Jelico
          </h1>
          <p className="text-text-secondary text-lg mb-12">
            Your AI productivity partner
          </p>

          {/* Quick intro */}
          <div className="space-y-4 text-left max-w-md mx-auto mb-12">
            <div className="flex items-start gap-4 p-4 bg-bg-elevated rounded-lg border border-border">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-medium text-text-primary mb-1">Multiple Modes</h3>
                <p className="text-sm text-text-muted">
                  Switch between Auto, Explore, Execute, Plan, and Review modes to match your workflow.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-bg-elevated rounded-lg border border-border">
              <div className="p-2 bg-accent/10 rounded-lg">
                <FolderOpen className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-medium text-text-primary mb-1">Workspace Aware</h3>
                <p className="text-sm text-text-muted">
                  Connect to your projects for context-aware assistance with code and files.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-bg-elevated rounded-lg border border-border">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Upload className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-medium text-text-primary mb-1">Artifacts & Sandbox</h3>
                <p className="text-sm text-text-muted">
                  Generate code, documents, and files in a safe sandbox environment.
                </p>
              </div>
            </div>
          </div>

          {/* Name input (optional) */}
          <div className="max-w-sm mx-auto mb-8">
            <label className="block text-sm text-text-secondary mb-2 text-left">
              What should Jelico call you? (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Continue button */}
          <button
            onClick={handleContinue}
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-black font-medium rounded-lg hover:bg-accent-bright transition-colors"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // Setup step
  return (
    <div className="min-h-screen bg-bg-void flex items-center justify-center p-10">
      <div className="w-full max-w-[700px] animate-slide-in">
        <div className="text-center mb-10">
          <h1 className="font-display text-[28px] font-normal text-text-primary mb-2">
            {name ? `Hello, ${name}!` : 'Almost ready!'}
          </h1>
          <p className="text-text-secondary">
            Choose your starting configuration. You can change these anytime.
          </p>
        </div>

        {/* Setup options */}
        <div className="space-y-8">
          {/* Workspace selection */}
          <div className="p-6 bg-bg-surface rounded-xl border border-border">
            <h3 className="font-medium text-text-primary mb-2 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-accent" />
              Select a Workspace
            </h3>
            <p className="text-sm text-text-muted mb-4">
              Connect a folder to give Jelico context about your project. You can also use the sandbox for quick experiments.
            </p>
            <WorkspaceSelector />
          </div>

          {/* Mode selection */}
          <div className="p-6 bg-bg-surface rounded-xl border border-border">
            <h3 className="font-medium text-text-primary mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              Choose a Mode
            </h3>
            <p className="text-sm text-text-muted mb-4">
              Auto mode intelligently switches between modes. Or pick a specific mode for focused work.
            </p>
            <ModeSelector />
          </div>
        </div>

        {/* Complete button */}
        <div className="text-center mt-10">
          <button
            onClick={handleContinue}
            className="inline-flex items-center gap-2 px-8 py-3 bg-accent text-black font-medium rounded-lg hover:bg-accent-bright transition-colors"
          >
            Start Chatting
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
