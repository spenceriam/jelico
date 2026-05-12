import type { ModelToolCapability } from '../../lib/modelToolCapabilities'

interface ModelToolCapabilityBadgeProps {
  capability: ModelToolCapability
  compact?: boolean
}

export function ModelToolCapabilityBadge({ capability, compact = false }: ModelToolCapabilityBadgeProps) {
  const className =
    capability.support === 'tools_supported'
      ? 'border-success/40 bg-success/10 text-success'
      : capability.support === 'chat_only'
        ? 'border-warning/50 bg-warning/10 text-warning'
        : 'border-border-subtle bg-bg-surface text-text-muted'

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border font-medium leading-none ${className} ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
      }`}
      title={capability.reason}
    >
      {capability.label}
    </span>
  )
}
