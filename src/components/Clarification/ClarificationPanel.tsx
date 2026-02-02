/**
 * ClarificationPanel - Inline clarification questions
 *
 * Displays when AI needs user input before proceeding.
 * TodoPanel-style collapsible with scrollable content.
 */

import { useState, useMemo } from 'react'
import { HelpCircle, ChevronRight, ChevronDown, Check } from 'lucide-react'
import { useClarificationStore, type ClarificationQuestion } from '../../stores/clarification'

// Single option row
function OptionRow({
  label,
  description,
  isSelected,
  isMultiSelect,
  onSelect,
}: {
  label: string
  description?: string
  isSelected: boolean
  isMultiSelect: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full text-left px-4 py-2.5 border-b border-[var(--border)] last:border-b-0
        transition-colors duration-150
        ${isSelected
          ? 'bg-[var(--accent-glow)] border-l-[3px] border-l-[var(--accent)]'
          : 'hover:bg-[var(--bg-hover)]'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Radio or Checkbox */}
        <div className="flex-shrink-0 mt-0.5">
          {isMultiSelect ? (
            <div className={`
              w-4 h-4 rounded border-2 flex items-center justify-center
              ${isSelected
                ? 'border-[var(--accent)] bg-[var(--accent)]'
                : 'border-[var(--text-muted)]'
              }
            `}>
              {isSelected && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          ) : (
            <div className={`
              w-4 h-4 rounded-full border-2 flex items-center justify-center
              ${isSelected
                ? 'border-[var(--accent)]'
                : 'border-[var(--text-muted)]'
              }
            `}>
              {isSelected && (
                <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              )}
            </div>
          )}
        </div>

        {/* Label and description */}
        <div className="flex-1 min-w-0">
          <div className={`
            text-sm font-medium
            ${isSelected ? 'text-[var(--accent-bright)]' : 'text-[var(--text-primary)]'}
          `}>
            {label}
          </div>
          {description && (
            <div className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
              {description}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

// "Other" text input that expands when selected
function OtherInput({
  isSelected,
  value,
  onChange,
  onSelect,
  isMultiSelect,
}: {
  isSelected: boolean
  value: string
  onChange: (text: string) => void
  onSelect: () => void
  isMultiSelect: boolean
}) {
  return (
    <div className={`
      px-4 py-2.5 border-b border-[var(--border)] last:border-b-0
      transition-colors duration-150
      ${isSelected
        ? 'bg-[var(--accent-glow)] border-l-[3px] border-l-[var(--accent)]'
        : ''
      }
    `}>
      <button
        onClick={onSelect}
        className="w-full text-left"
      >
        <div className="flex items-start gap-3">
          {/* Radio or Checkbox */}
          <div className="flex-shrink-0 mt-0.5">
            {isMultiSelect ? (
              <div className={`
                w-4 h-4 rounded border-2 flex items-center justify-center
                ${isSelected
                  ? 'border-[var(--accent)] bg-[var(--accent)]'
                  : 'border-[var(--text-muted)]'
                }
              `}>
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            ) : (
              <div className={`
                w-4 h-4 rounded-full border-2 flex items-center justify-center
                ${isSelected
                  ? 'border-[var(--accent)]'
                  : 'border-[var(--text-muted)]'
                }
              `}>
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                )}
              </div>
            )}
          </div>

          <div className={`
            text-sm font-medium
            ${isSelected ? 'text-[var(--accent-bright)]' : 'text-[var(--text-primary)]'}
          `}>
            Other...
          </div>
        </div>
      </button>

      {/* Expanded text input */}
      {isSelected && (
        <div className="mt-2 ml-7">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your alternative..."
            autoFocus
            className="
              w-full px-3 py-2 text-sm
              bg-[var(--bg-deep)] border border-[var(--border)] rounded-md
              text-[var(--text-primary)] placeholder-[var(--text-muted)]
              focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]
            "
          />
        </div>
      )}
    </div>
  )
}

// Single question block
function QuestionBlock({ question }: { question: ClarificationQuestion }) {
  const { selectOption, toggleOption, setOtherText } = useClarificationStore()

  const handleSelect = (label: string) => {
    if (question.multiSelect) {
      toggleOption(question.id, label)
    } else {
      selectOption(question.id, label)
    }
  }

  const hasAnswer = question.selectedOptions.length > 0

  return (
    <div className="py-2">
      {/* Question text with answer indicator */}
      <div className="px-4 pb-2 flex items-start gap-2">
        <div className="flex-1 text-sm font-medium text-[var(--text-primary)]">
          {question.question}
          {question.multiSelect && (
            <span className="text-[var(--text-muted)] font-normal ml-2">
              (Select all that apply)
            </span>
          )}
        </div>
        {hasAnswer && (
          <Check className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
        )}
      </div>

      {/* Options */}
      <div>
        {question.options.map((option) => (
          <OptionRow
            key={option.label}
            label={option.label}
            description={option.description}
            isSelected={question.selectedOptions.includes(option.label)}
            isMultiSelect={question.multiSelect}
            onSelect={() => handleSelect(option.label)}
          />
        ))}

        {/* Other option - always last */}
        <OtherInput
          isSelected={question.selectedOptions.includes('Other')}
          value={question.otherText}
          onChange={(text) => setOtherText(question.id, text)}
          onSelect={() => handleSelect('Other')}
          isMultiSelect={question.multiSelect}
        />
      </div>
    </div>
  )
}

// Main panel component
export function ClarificationPanel() {
  const { activeRequest, canSubmit, submitAnswers } = useClarificationStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Default expanded for 1-2 questions, collapsed for 3+
  const [isExpanded, setIsExpanded] = useState(() => {
    return !activeRequest || activeRequest.questions.length <= 2
  })

  // Calculate progress
  const progress = useMemo(() => {
    if (!activeRequest) return { answered: 0, total: 0 }
    const answered = activeRequest.questions.filter(q => q.selectedOptions.length > 0).length
    return { answered, total: activeRequest.questions.length }
  }, [activeRequest])

  if (!activeRequest) return null

  const handleSubmit = async () => {
    if (!canSubmit() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await submitAnswers()
    } finally {
      setIsSubmitting(false)
    }
  }

  const allAnswered = progress.answered === progress.total

  return (
    <div
      className="
        rounded-lg overflow-hidden mb-4
        border-2 border-[var(--accent)]
        bg-[var(--bg-surface)]
      "
      style={{
        boxShadow: '0 0 15px var(--accent-glow)',
      }}
    >
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--bg-hover)]/50 transition-colors text-left"
        style={{
          background: isExpanded
            ? 'linear-gradient(135deg, var(--accent-glow) 0%, transparent 100%)'
            : undefined,
        }}
      >
        {/* Expand/Collapse icon */}
        <span className="text-[var(--accent)]">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>

        {/* Icon */}
        <HelpCircle className="w-4 h-4 text-[var(--accent-bright)]" />

        {/* Title - show different content based on expanded state */}
        {isExpanded ? (
          <span className="flex-1 text-sm font-semibold text-[var(--accent-bright)] truncate">
            {activeRequest.subject}
          </span>
        ) : (
          <span className="flex-1 text-sm text-[var(--text-primary)]">
            {progress.total} question{progress.total !== 1 ? 's' : ''} need{progress.total === 1 ? 's' : ''} answers
          </span>
        )}

        {/* Progress indicator */}
        <span className={`
          text-xs font-mono px-2 py-0.5 rounded
          ${allAnswered
            ? 'bg-[var(--accent)]/20 text-[var(--accent-bright)]'
            : 'text-[var(--text-muted)]'
          }
        `}>
          {progress.answered}/{progress.total}
          {allAnswered && ' ✓'}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <>
          {/* Scrollable questions area */}
          <div
            className="divide-y divide-[var(--border)] overflow-y-auto"
            style={{ maxHeight: '300px' }}
          >
            {activeRequest.questions.map((question) => (
              <QuestionBlock key={question.id} question={question} />
            ))}
          </div>

          {/* Footer with Submit button - always visible outside scroll */}
          <div className="px-3 py-2.5 border-t border-[var(--border)] flex items-center justify-between bg-[var(--bg-surface)]">
            <span className="text-xs text-[var(--text-muted)]">
              {allAnswered ? 'Ready to submit' : `Answer all ${progress.total} questions to continue`}
            </span>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit() || isSubmitting}
              className={`
                flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium
                transition-colors duration-150
                ${canSubmit() && !isSubmitting
                  ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-bright)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-not-allowed'
                }
              `}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
              {!isSubmitting && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
