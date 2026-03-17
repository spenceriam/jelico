import { useMemo, useState } from 'react'
import { Plus, Edit2, Trash2, Zap, X } from 'lucide-react'
import { useSkillStore } from '../../stores/skills'

function splitTags(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

export function SkillManager() {
  const { skills, addSkill, updateSkill, deleteSkill } = useSkillStore()
  const [editingSkill, setEditingSkill] = useState<AppSkill | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const builtInSkills = useMemo(
    () => skills.filter((skill) => skill.source === 'builtin').sort((a, b) => a.name.localeCompare(b.name)),
    [skills]
  )
  const customSkills = useMemo(
    () => skills.filter((skill) => skill.source === 'custom').sort((a, b) => b.updatedAt - a.updatedAt),
    [skills]
  )

  const handleSave = async (draft: AppSkillDraft) => {
    if (editingSkill) {
      await updateSkill(editingSkill.id, draft)
    } else {
      await addSkill(draft)
    }

    setEditingSkill(null)
    setIsCreating(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-text-primary">Skills</h3>
        <p className="text-sm text-text-secondary max-w-3xl">
          Skills are internal workflows Jelico can apply when your request matches. Built-in skills are available automatically,
          and custom skills use the same Claude Code-style <code className="px-1 py-0.5 bg-bg-elevated rounded text-accent">SKILL.md</code>{' '}
          structure so the assistant can reason about them consistently.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-text-primary">Built-in Skills</h4>
            <p className="text-xs text-text-muted">Applied contextually by the main assistant when they fit the task.</p>
          </div>
          <span className="text-xs text-text-muted">Claude Code format</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {builtInSkills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-text-primary">Custom Skills</h4>
            <p className="text-xs text-text-muted">Create reusable workflows Jelico can pick up for your projects and habits.</p>
          </div>
          {customSkills.length > 0 && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent text-accent-foreground rounded-lg hover:bg-accent-bright transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Skill
            </button>
          )}
        </div>

        {customSkills.length > 0 ? (
          <div className="space-y-3">
            {customSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onEdit={() => setEditingSkill(skill)}
                onDelete={() => { void deleteSkill(skill.id) }}
              />
            ))}
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full rounded-xl border border-dashed border-border bg-bg-elevated/60 px-4 py-6 text-left hover:bg-bg-hover transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-accent/10 p-2">
                <Plus className="w-4 h-4 text-accent" />
              </div>
              <div className="space-y-1">
                <div className="font-medium text-text-primary">Create your first custom skill</div>
                <p className="text-sm text-text-secondary">
                  Define when Jelico should use it, add the workflow instructions, and it will be stored in the same standardized format as the built-ins.
                </p>
              </div>
            </div>
          </button>
        )}
      </section>

      {(isCreating || editingSkill) && (
        <SkillEditor
          skill={editingSkill || undefined}
          onSave={(draft) => { void handleSave(draft) }}
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
  onEdit,
  onDelete,
}: {
  skill: AppSkill
  onEdit?: () => void
  onDelete?: () => void
}) {
  const isBuiltIn = skill.source === 'builtin'

  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 shrink-0 text-accent" />
            <span className="font-medium text-text-primary">{skill.name}</span>
            <span className="rounded-full bg-bg-surface px-2 py-0.5 text-[11px] uppercase tracking-wide text-text-muted">
              {isBuiltIn ? 'Automatic' : 'Custom'}
            </span>
            {skill.suggestedMode && (
              <span className="text-xs text-text-muted">Mode: {skill.suggestedMode}</span>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-text-secondary">{skill.description}</p>
            <p className="text-xs text-text-muted">
              <span className="font-medium text-text-secondary">Use when:</span> {skill.whenToUse}
            </p>
          </div>

          {skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {skill.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {!isBuiltIn && (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded p-1.5 text-text-muted hover:text-text-primary"
              title="Edit skill"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="rounded p-1.5 text-text-muted hover:text-error"
              title="Delete skill"
            >
              <Trash2 className="h-4 w-4" />
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
  skill?: AppSkill
  onSave: (draft: AppSkillDraft) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(skill?.name || '')
  const [description, setDescription] = useState(skill?.description || '')
  const [whenToUse, setWhenToUse] = useState(skill?.whenToUse || '')
  const [tags, setTags] = useState(skill?.tags.join(', ') || '')
  const [suggestedMode, setSuggestedMode] = useState<AppSkillMode | ''>(skill?.suggestedMode || '')
  const [instructions, setInstructions] = useState(skill?.instructions || '')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSave({
      name,
      description,
      whenToUse,
      tags: splitTags(tags),
      suggestedMode: suggestedMode || undefined,
      instructions,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-bg-surface shadow-xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-lg font-medium text-text-primary">
                {skill ? 'Edit Custom Skill' : 'New Custom Skill'}
              </h3>
              <p className="text-sm text-text-muted">Stored in Claude Code-style SKILL.md format.</p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded p-1 text-text-muted hover:text-text-primary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div>
              <label className="mb-1 block text-sm text-text-secondary">Name</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-text-secondary">Description</label>
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
                placeholder="What this skill helps Jelico do"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-text-secondary">When to use</label>
              <textarea
                value={whenToUse}
                onChange={(event) => setWhenToUse(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
                placeholder="Describe the kinds of requests where this skill should activate."
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Tags</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
                  placeholder="review, react, refactor"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">Suggested mode</label>
                <select
                  value={suggestedMode}
                  onChange={(event) => setSuggestedMode(event.target.value as AppSkillMode | '')}
                  className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text-primary focus:border-accent focus:outline-none"
                >
                  <option value="">No preference</option>
                  <option value="auto">Auto</option>
                  <option value="execute">Full Execute</option>
                  <option value="plan">Plan</option>
                  <option value="explore">Explore</option>
                  <option value="review">Review</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-text-secondary">Instructions</label>
              <p className="mb-2 text-xs text-text-muted">
                These become the main body of the skill. Write the workflow Jelico should follow when this skill is relevant.
              </p>
              <textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                rows={10}
                className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 font-mono text-sm text-text-primary focus:border-accent focus:outline-none"
                placeholder="List the steps, checks, or constraints for the skill."
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm text-accent-foreground hover:bg-accent-bright"
            >
              Save Skill
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
