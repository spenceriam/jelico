import { Check, Palette, Type, Moon, Sun, Monitor, Minus, Plus } from 'lucide-react'
import { useThemeStore, COLOR_THEMES, type ThemeMode } from '../../stores/theme'
import { useUIStore } from '../../stores/ui'

const THEME_MODES: { id: ThemeMode; name: string; icon: typeof Sun }[] = [
  { id: 'dark', name: 'Dark', icon: Moon },
  { id: 'light', name: 'Light', icon: Sun },
  { id: 'system', name: 'System', icon: Monitor },
]

interface FontSizeCardProps {
  title: string
  description: string
  value: number
  decrementTitle: string
  incrementTitle: string
  onDecrement: () => void
  onIncrement: () => void
  onChange: (value: number) => void
  previewPrimary: string
  previewSecondary: string
  previewPrimaryPt: number
  previewSecondaryPt: number
  className?: string
}

function FontSizeCard({
  title,
  description,
  value,
  decrementTitle,
  incrementTitle,
  onDecrement,
  onIncrement,
  onChange,
  previewPrimary,
  previewSecondary,
  previewPrimaryPt,
  previewSecondaryPt,
  className,
}: FontSizeCardProps) {
  return (
    <div className={`p-4 bg-bg-elevated rounded-lg border border-border h-full ${className || ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-text-primary">{title}</div>
          <div className="text-sm text-text-muted">{description}</div>
        </div>
        <div className="text-sm font-mono text-text-secondary whitespace-nowrap">
          {value.toFixed(1)} pt
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onDecrement}
          className="p-2 rounded border border-border text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
          title={decrementTitle}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={8}
            max={20}
            step={0.5}
            value={value}
            onChange={(e) => {
              const next = Number(e.target.value)
              if (Number.isFinite(next)) onChange(next)
            }}
            className="w-20 px-2 py-1.5 bg-bg-deep border border-border rounded text-text-primary text-sm"
          />
          <span className="text-sm text-text-muted">pt</span>
        </div>
        <button
          onClick={onIncrement}
          className="p-2 rounded border border-border text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
          title={incrementTitle}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-3 p-2.5 rounded-md border border-border bg-bg-deep">
        <p className="text-text-primary truncate" style={{ fontSize: `${previewPrimaryPt.toFixed(1)}pt` }}>
          {previewPrimary}
        </p>
        <p className="text-text-muted mt-1 truncate" style={{ fontSize: `${previewSecondaryPt.toFixed(1)}pt` }}>
          {previewSecondary}
        </p>
      </div>
    </div>
  )
}

export function AppearanceSettings() {
  const { mode, colorThemeId, setMode, setColorTheme } = useThemeStore()
  const {
    appFontPt,
    chatFontPt,
    artifactDocumentFontPt,
    setAppFontPt,
    setChatFontPt,
    setArtifactDocumentFontPt,
  } = useUIStore()
  const shortcutMod = navigator.platform.toUpperCase().includes('MAC') ? 'Cmd' : 'Ctrl'

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Theme
        </h3>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="p-4 bg-bg-elevated rounded-lg border border-border lg:col-span-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Theme Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2">
              {THEME_MODES.map((themeMode) => {
                const Icon = themeMode.icon
                return (
                  <button
                    key={themeMode.id}
                    onClick={() => setMode(themeMode.id)}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
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

          <div className="p-4 bg-bg-elevated rounded-lg border border-border lg:col-span-8">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Color Theme
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
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
        </div>
      </section>

      <section>
        <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Type className="w-5 h-5" />
          Typography
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <FontSizeCard
            title="Application Font Size"
            description="Applies across the app (panes, settings, chat chrome, prompt box)"
            value={appFontPt}
            decrementTitle="Decrease app font size"
            incrementTitle="Increase app font size"
            onDecrement={() => setAppFontPt(appFontPt - 0.5)}
            onIncrement={() => setAppFontPt(appFontPt + 0.5)}
            onChange={setAppFontPt}
            previewPrimary="App preview: Sidebar, settings, and prompt text."
            previewSecondary={`Shortcut: press ${shortcutMod}+plus twice or ${shortcutMod}+minus twice quickly.`}
            previewPrimaryPt={appFontPt}
            previewSecondaryPt={Math.max(7, appFontPt - 1)}
          />

          <FontSizeCard
            title="Chat View Font Size"
            description="Applies to messages, tool call rows, and status text in chat view"
            value={chatFontPt}
            decrementTitle="Decrease chat font size"
            incrementTitle="Increase chat font size"
            onDecrement={() => setChatFontPt(chatFontPt - 0.5)}
            onIncrement={() => setChatFontPt(chatFontPt + 0.5)}
            onChange={setChatFontPt}
            previewPrimary="Chat preview: Let's ship this fix."
            previewSecondary="Waiting for sub-agent... (23s)"
            previewPrimaryPt={chatFontPt}
            previewSecondaryPt={Math.max(7, chatFontPt - 1)}
          />

          <FontSizeCard
            title="Artifact Document Font Size"
            description="Applies to markdown/document rendering in Canvas preview"
            value={artifactDocumentFontPt}
            decrementTitle="Decrease artifact font size"
            incrementTitle="Increase artifact font size"
            onDecrement={() => setArtifactDocumentFontPt(artifactDocumentFontPt - 0.5)}
            onIncrement={() => setArtifactDocumentFontPt(artifactDocumentFontPt + 0.5)}
            onChange={setArtifactDocumentFontPt}
            previewPrimary="Artifact Heading"
            previewSecondary="This is a small markdown preview sample."
            previewPrimaryPt={artifactDocumentFontPt * 1.2}
            previewSecondaryPt={artifactDocumentFontPt}
          />
        </div>
      </section>
    </div>
  )
}
