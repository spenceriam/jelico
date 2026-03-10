import { useState } from 'react'
import { Plus, Edit2, Trash2, Zap, X } from 'lucide-react'
import { useSkillStore, type Skill } from '../../stores/skills'
import type { AgentMode } from '../../lib/modes'

export function SkillManager() {
  const { skills, addSkill, updateSkill, deleteSkill } = useSkillStore()
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const customSkills = skills.filter((s) => !s.isBuiltIn)
  const builtInSkills = skills.filter((s) => s.isBuiltIn)

  const handleSave = (skill: Omit<Skill, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>) => {
    if (editingSkill) {
      updateSkill(editingSkill.id, skill)
    } else {
      addSkill(skill)
    }
    setEditingSkill(null)
    setIsCreating(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-text-primary">Skills</h3>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent text-accent-foreground rounded-lg hover:bg-accent-bright transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Skill
        </button>
      </div>

      <p className="text-sm text-text-secondary">
        Skills are reusable prompts that can be triggered with shortcuts like{' '}
        <code className="px-1 py-0.5 bg-bg-elevated rounded text-accent">!review</code> or{' '}
        <code className="px-1 py-0.5 bg-bg-elevated rounded text-accent">!fix</code>
      </p>

      {/* Custom skills */}
      {customSkills.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-text-secondary">Your Skills</h4>
          {customSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onEdit={() => setEditingSkill(skill)}
              onDelete={() => deleteSkill(skill.id)}
            />
          ))}
        </div>
      )}

      {/* Built-in skills */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-text-secondary">Built-in Skills</h4>
        {builtInSkills.map((skill) => (
          <SkillCard key={skill.id} skill={skill} isBuiltIn />
        ))}
      </div>

      {/* Edit/Create modal */}
      {(isCreating || editingSkill) && (
        <SkillEditor
          skill={editingSkill || undefined}
          onSave={handleSave}
          onCancel={() => {
            setEditingSkill(null)
            setIsCreating(false)
          }}
        />
      )}
    </div>
  )
}

function SkillCard({
  skill,
  isBuiltIn,
  onEdit,
  onDelete,
}: {
  skill: Skill
  isBuiltIn?: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="p-3 bg-bg-elevated rounded-lg border border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent flex-shrink-0" />
            <span className="font-medium text-text-primary">{skill.name}</span>
            {skill.shortcut && (
              <code className="px-1.5 py-0.5 text-xs bg-bg-surface rounded text-accent">
                {skill.shortcut}
              </code>
            )}
            {skill.mode && (
              <span className="text-xs text-text-muted">({skill.mode})</span>
            )}
          </div>
          <p className="text-sm text-text-secondary mt-1">{skill.description}</p>
        </div>

        {!isBuiltIn && (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 text-text-muted hover:text-text-primary rounded"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-text-muted hover:text-error rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SkillEditor({
  skill,
  onSave,
  onCancel,
}: {
  skill?: Skill
  onSave: (skill: Omit<Skill, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(skill?.name || '')
  const [description, setDescription] = useState(skill?.description || '')
  const [shortcut, setShortcut] = useState(skill?.shortcut || '')
  const [mode, setMode] = useState<AgentMode | ''>(skill?.mode || '')
  const [prompt, setPrompt] = useState(
    skill?.prompt || 'Your prompt here...\n\n{{context}}'
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name,
      description,
      shortcut: shortcut || undefined,
      mode: mode || undefined,
      prompt,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-surface rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-medium text-text-primary">
              {skill ? 'Edit Skill' : 'New Skill'}
            </h3>
            <button
              type="button"
              onClick={onCancel}
              className="p-1 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Shortcut (optional)
                </label>
                <input
                  type="text"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value)}
                  placeholder="!myskill"
                  className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Mode (optional)
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as AgentMode | '')}
                  className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Auto-detect</option>
                  <option value="auto">Auto</option>
                  <option value="execute">Full Execute</option>
                  <option value="plan">Plan</option>
                  <option value="explore">Explore</option>
                  <option value="review">Review</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Prompt Template
              </label>
              <p className="text-xs text-text-muted mb-2">
                Use <code className="px-1 bg-bg-elevated rounded">{'{{context}}'}</code> to
                insert user input
              </p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:border-accent"
                required
              />
            </div>
          </div>

          <div className="p-4 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-accent text-accent-foreground rounded-lg hover:bg-accent-bright"
            >
              Save Skill
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
