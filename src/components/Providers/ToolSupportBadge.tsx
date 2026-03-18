interface ToolSupportBadgeProps {
  summary?: ProviderCapabilitySummary | null
  compact?: boolean
  title?: string
}

function getBadgeClasses(toolSupport: ProviderCapabilitySummary['toolSupport']): string {
  switch (toolSupport) {
    case 'supported':
      return 'bg-success/10 text-success border-success/20'
    case 'unsupported':
      return 'bg-warning/10 text-warning border-warning/20'
    default:
      return 'bg-bg-surface text-text-secondary border-border'
  }
}

export function ToolSupportBadge({
  summary,
  compact = false,
  title,
}: ToolSupportBadgeProps) {
  if (!summary) return null

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${getBadgeClasses(summary.toolSupport)}`}
      title={title || summary.note}
    >
      {summary.label}
    </span>
  )
}
