import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search,
  MessageSquare,
  Settings,
  FolderOpen,
  Zap,
  Bot,
  GitBranch,
  PanelRight,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { useChatStore } from '../../stores/chat'
import { useWorkspaceStore } from '../../stores/workspaces'
import { useArtifactStore } from '../../stores/artifacts'
import { useSkillStore } from '../../stores/skills'
import { useUIStore } from '../../stores/ui'
import { usePermissionStore } from '../../stores/permissions'
import { modes } from '../../lib/modes'

interface Command {
  id: string
  name: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  keywords?: string[]
  category: 'permissions' | 'chat' | 'workspace' | 'mode' | 'skill' | 'navigation' | 'action'
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Stores
  const { setActiveConversation, conversations, setMode } = useChatStore()
  const { workspaces, selectFolder, setActiveWorkspace } = useWorkspaceStore()
  const { toggleCanvas, canvasOpen } = useArtifactStore()
  const { skills } = useSkillStore()
  const { openSettings, openProviderSetup } = useUIStore()
  const { allowAllSession, setAllowAllSession, loadAllowAllSession } = usePermissionStore()

  useEffect(() => {
    loadAllowAllSession()
  }, [loadAllowAllSession])

  // Build commands list
  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = []

    // Permission commands - keep first so this section appears at the top.
    cmds.push({
      id: 'permissions-allow-all-session',
      name: allowAllSession ? 'Disable Allow All Permissions' : 'Enable Allow All Permissions',
      description: allowAllSession
        ? 'All tools currently require normal permission checks'
        : 'Allow all tools for this session (same as Settings > Permissions)',
      icon: ShieldCheck,
      category: 'permissions',
      keywords: ['permission', 'allow all', 'session', 'security'],
      action: () => {
        void setAllowAllSession(!allowAllSession)
      },
    })

    // Chat commands
    cmds.push({
      id: 'new-chat',
      name: 'New Chat',
      description: 'Start a new conversation',
      icon: Plus,
      category: 'chat',
      keywords: ['conversation', 'message', 'create'],
      action: () => {
        setActiveConversation(null)
      },
    })

    // Recent conversations
    conversations.slice(0, 5).forEach((conv) => {
      cmds.push({
        id: `conv-${conv.id}`,
        name: conv.title,
        description: 'Open conversation',
        icon: MessageSquare,
        category: 'chat',
        action: () => setActiveConversation(conv.id),
      })
    })

    // Mode commands
    Object.values(modes).forEach((mode) => {
      cmds.push({
        id: `mode-${mode.id}`,
        name: `Mode: ${mode.name}`,
        description: mode.description,
        icon: Bot,
        category: 'mode',
        keywords: [mode.shortcut],
        action: () => setMode(mode.id),
      })
    })

    // Skill commands
    skills.forEach((skill) => {
      cmds.push({
        id: `skill-${skill.id}`,
        name: skill.name,
        description: skill.description,
        icon: Zap,
        category: 'skill',
        keywords: skill.shortcut ? [skill.shortcut] : undefined,
        action: () => {
          // Focus the chat input and insert skill shortcut
          const input = document.querySelector('textarea')
          if (input && skill.shortcut) {
            ;(input as HTMLTextAreaElement).value = skill.shortcut + ' '
            ;(input as HTMLTextAreaElement).focus()
          }
        },
      })
    })

    // Workspace commands
    cmds.push({
      id: 'open-folder',
      name: 'Open Folder',
      description: 'Select a workspace folder',
      icon: FolderOpen,
      category: 'workspace',
      keywords: ['directory', 'project'],
      action: selectFolder,
    })

    workspaces.forEach((ws) => {
      cmds.push({
        id: `workspace-${ws.id}`,
        name: ws.name,
        description: ws.path,
        icon: ws.isGit ? GitBranch : FolderOpen,
        category: 'workspace',
        action: () => setActiveWorkspace(ws.id),
      })
    })

    // Navigation commands
    cmds.push({
      id: 'settings',
      name: 'Settings',
      description: 'Open settings',
      icon: Settings,
      category: 'navigation',
      keywords: ['preferences', 'config'],
      action: () => openSettings(),
    })

    cmds.push({
      id: 'settings-providers',
      name: 'Manage Providers',
      description: 'Configure AI providers',
      icon: Settings,
      category: 'navigation',
      action: () => openSettings('providers'),
    })

    cmds.push({
      id: 'settings-skills',
      name: 'Manage Skills',
      description: 'Configure AI skills',
      icon: Zap,
      category: 'navigation',
      action: () => openSettings('skills'),
    })

    cmds.push({
      id: 'add-provider',
      name: 'Add Provider',
      description: 'Add a new AI provider',
      icon: Plus,
      category: 'action',
      action: openProviderSetup,
    })

    cmds.push({
      id: 'toggle-canvas',
      name: canvasOpen ? 'Hide Canvas' : 'Show Canvas',
      description: 'Toggle the artifacts canvas panel',
      icon: PanelRight,
      category: 'action',
      keywords: ['artifacts', 'panel'],
      action: toggleCanvas,
    })

    return cmds
  }, [
    allowAllSession,
    conversations,
    skills,
    workspaces,
    canvasOpen,
    setActiveConversation,
    setMode,
    selectFolder,
    setActiveWorkspace,
    openSettings,
    openProviderSetup,
    setAllowAllSession,
    toggleCanvas,
  ])

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands

    const lower = query.toLowerCase()
    return commands.filter((cmd) => {
      if (cmd.name.toLowerCase().includes(lower)) return true
      if (cmd.description?.toLowerCase().includes(lower)) return true
      if (cmd.keywords?.some((k) => k.toLowerCase().includes(lower))) return true
      return false
    })
  }, [commands, query])

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {}
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = []
      }
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  const categoryLabels: Record<string, string> = {
    permissions: 'Permissions',
    chat: 'Chat',
    mode: 'Modes',
    skill: 'Skills',
    workspace: 'Workspaces',
    navigation: 'Navigation',
    action: 'Actions',
  }

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action()
            onClose()
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [isOpen, filteredCommands, selectedIndex, onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  let currentIndex = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50">
      <div className="w-full max-w-lg bg-bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none"
            autoFocus
          />
          <kbd className="px-2 py-0.5 text-xs text-text-muted bg-bg-elevated rounded">
            esc
          </kbd>
        </div>

        {/* Commands list */}
        <div className="max-h-[60vh] overflow-y-auto">
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category}>
              <div className="px-4 py-2 text-xs text-text-muted uppercase tracking-wider bg-bg-deep">
                {categoryLabels[category] || category}
              </div>
              {cmds.map((cmd) => {
                const index = currentIndex++
                const isSelected = index === selectedIndex
                const Icon = cmd.icon

                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      cmd.action()
                      onClose()
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`
                      w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors
                      ${isSelected ? 'bg-bg-hover' : 'hover:bg-bg-hover'}
                    `}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isSelected ? 'text-accent' : 'text-text-muted'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm ${
                          isSelected ? 'text-text-primary' : 'text-text-secondary'
                        }`}
                      >
                        {cmd.name}
                      </div>
                      {cmd.description && (
                        <div className="text-xs text-text-muted truncate">
                          {cmd.description}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}

          {filteredCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-text-muted">
              No commands found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-bg-elevated rounded mr-1">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-bg-elevated rounded">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-bg-elevated rounded">↵</kbd> to select
            </span>
          </div>
          <span>{filteredCommands.length} commands</span>
        </div>
      </div>
    </div>
  )
}

// Hook to manage command palette state
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  }
}
