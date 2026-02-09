/**
 * ClarificationPanel - modal clarification questions
 *
 * App-level overlay with independent scrolling so long question sets
 * never get clipped by chat layout.
 */

import { useEffect, useState } from 'react'
import { ChevronRight, Check, X } from 'lucide-react'
import { useClarificationStore, type ClarificationQuestion } from '../../stores/clarification'
import { useChatStore } from '../../stores/chat'

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
        w-full text-left px-3 py-2 rounded-md mb-1
        transition-colors duration-150 flex items-start gap-3
        ${isSelected
          ? 'bg-accent/10 text-accent'
          : 'hover:bg-bg-hover text-text-primary'
        }
      `}
    >
      {/* Radio or Checkbox */}
      <div className="flex-shrink-0 mt-0.5">
        {isMultiSelect ? (
          <div className={`
            w-4 h-4 rounded border-2 flex items-center justify-center
            ${isSelected ? 'border-accent bg-accent' : 'border-text-muted'}
          `}>
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </div>
        ) : (
          <div className={`
            w-4 h-4 rounded-full border-2 flex items-center justify-center
            ${isSelected ? 'border-accent' : 'border-text-muted'}
          `}>
            {isSelected && <div className="w-2 h-2 rounded-full bg-accent" />}
          </div>
        )}
      </div>

      {/* Label and description */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-text-muted mt-0.5">{description}</div>
        )}
      </div>
    </button>
  )
}

// "Other" option with inline text input
function OtherOption({
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
    <div
      className={`
        px-3 py-2 rounded-md mb-1 transition-colors duration-150
        ${isSelected ? 'bg-accent/10' : 'hover:bg-bg-hover'}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Radio or Checkbox - clickable to select */}
        <button
          onClick={onSelect}
          className="flex-shrink-0 mt-0.5"
        >
          {isMultiSelect ? (
            <div className={`
              w-4 h-4 rounded border-2 flex items-center justify-center
              ${isSelected ? 'border-accent bg-accent' : 'border-text-muted'}
            `}>
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
          ) : (
            <div className={`
              w-4 h-4 rounded-full border-2 flex items-center justify-center
              ${isSelected ? 'border-accent' : 'border-text-muted'}
            `}>
              {isSelected && <div className="w-2 h-2 rounded-full bg-accent" />}
            </div>
          )}
        </button>

        {/* Label and input */}
        <div className="flex-1 min-w-0">
          <button
            onClick={onSelect}
            className={`text-sm font-medium text-left ${isSelected ? 'text-accent' : 'text-text-primary'}`}
          >
            Other
          </button>
          {isSelected && (
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Type your response..."
              autoFocus
              className="
                w-full mt-2 px-2 py-1.5 text-sm
                bg-bg-deep border border-border rounded
                text-text-primary placeholder-text-muted
                focus:outline-none focus:border-accent
              "
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Single question view (for tab content)
function QuestionView({
  question,
  onAnswered,
}: {
  question: ClarificationQuestion
  onAnswered?: () => void
}) {
  const { selectOption, toggleOption, setOtherText } = useClarificationStore()

  const handleSelect = (label: string) => {
    if (question.multiSelect) {
      toggleOption(question.id, label)
      // Don't auto-advance for multi-select (user may want to select more)
    } else {
      selectOption(question.id, label)
      // Auto-advance to next tab for single-select (unless selecting "Other" which needs text input)
      if (label !== 'Other' && onAnswered) {
        // Small delay so user sees the selection feedback
        setTimeout(onAnswered, 150)
      }
    }
  }

  return (
    <div className="py-3 px-3">
      {/* Question text */}
      <div className="text-sm text-text-primary mb-3">
        {question.question}
        {question.multiSelect && (
          <span className="text-text-muted ml-2">(select all that apply)</span>
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

        {/* Other option */}
        <OtherOption
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

// Tab button
function TabButton({
  label,
  isActive,
  hasAnswer,
  onClick,
}: {
  label: string
  isActive: boolean
  hasAnswer: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors
        border-b-2 flex items-center gap-1.5
        ${isActive
          ? 'border-accent text-accent bg-bg-surface'
          : hasAnswer
            ? 'border-transparent text-text-secondary hover:text-text-primary'
            : 'border-transparent text-text-muted hover:text-text-secondary'
        }
      `}
    >
      {label}
      {hasAnswer && <Check className="w-3 h-3" />}
    </button>
  )
}

// Main panel component
export function ClarificationPanel() {
  const {
    activeRequest,
    additionalDetails,
    setAdditionalDetails,
    canSubmit,
    submitAnswers,
    clearForConversation,
  } = useClarificationStore()
  const { isStreaming, activeConversationId, stopStreaming } = useChatStore()
  const [activeTab, setActiveTab] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!activeRequest) return
    setActiveTab(0)
  }, [activeRequest?.id])

  if (!activeRequest) return null

  const questions = activeRequest.questions
  const currentQuestion = questions[activeTab]

  const handleSubmit = async () => {
    if (!canSubmit() || isSubmitting) return
    setIsSubmitting(true)
    try {
      await submitAnswers()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDismiss = async () => {
    if (isSubmitting) return

    // If this clarification belongs to the currently active running stream,
    // stop the stream so the blocked ask_user_question is cancelled cleanly.
    if (isStreaming && activeConversationId === activeRequest.conversationId) {
      await stopStreaming()
    }

    clearForConversation(activeRequest.conversationId)
  }

  const answeredCount = questions.filter(q => q.selectedOptions.length > 0).length
  const allAnswered = answeredCount === questions.length

  // Auto-advance to next unanswered tab when current tab is answered
  const handleQuestionAnswered = () => {
    // If not on last tab, move to next tab
    if (activeTab < questions.length - 1) {
      setActiveTab(activeTab + 1)
    }
    // If on last tab, do nothing (user can click submit)
  }

  return (
    <div className="fixed inset-0 z-[45] flex items-center justify-center bg-bg-void/80 backdrop-blur-sm p-4">
      <div className="bg-bg-surface border border-border rounded-xl shadow-xl max-w-3xl w-full max-h-[88vh] overflow-hidden flex flex-col">
        {/* Header with topic */}
        <div className="px-4 py-3 border-b border-border bg-bg-elevated/50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] text-text-muted uppercase tracking-wide">
                Clarification Required
              </div>
              <div className="text-sm text-text-primary mt-1">
                {activeRequest.subject}
              </div>
              <div className="text-xs text-text-muted mt-1">
                Jelico is paused until you answer these questions.
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isSubmitting}
              className="flex-shrink-0 mt-0.5 p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Close clarification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs - only show if multiple questions */}
        {questions.length > 1 && (
          <div className="flex gap-1 px-2 pt-2 border-b border-border bg-bg-deep/30 overflow-x-auto">
            {questions.map((q, idx) => (
              <TabButton
                key={q.id}
                label={q.header || `Q${idx + 1}`}
                isActive={idx === activeTab}
                hasAnswer={q.selectedOptions.length > 0}
                onClick={() => setActiveTab(idx)}
              />
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Current question */}
          {currentQuestion && (
            <QuestionView
              question={currentQuestion}
              onAnswered={handleQuestionAnswered}
            />
          )}

          {/* Additional details - shared across all tabs */}
          <div className="px-3 pb-3 border-t border-border/50">
            <label className="block text-xs text-text-muted mb-1.5 mt-2">
              Additional details (optional)
            </label>
            <textarea
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              placeholder="Add any extra context..."
              rows={3}
              className="
                w-full px-2 py-1.5 text-sm
                bg-bg-deep border border-border rounded
                text-text-primary placeholder-text-muted
                focus:outline-none focus:border-accent
                resize-vertical min-h-[72px]
              "
            />
          </div>
        </div>

        {/* Footer with progress and submit */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-bg-elevated/30">
          <span className="text-xs text-text-muted font-mono">
            {answeredCount}/{questions.length}
            {allAnswered && ' ✓'}
          </span>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit() || isSubmitting}
            className={`
              flex items-center gap-1.5 px-3 py-1 rounded text-sm font-medium
              transition-colors
              ${canSubmit() && !isSubmitting
                ? 'bg-accent text-white hover:bg-accent-bright'
                : 'bg-bg-elevated text-text-muted cursor-not-allowed'
              }
            `}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
            {!isSubmitting && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
