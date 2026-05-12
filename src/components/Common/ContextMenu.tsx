import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', close)
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed z-[1000] min-w-[12rem] overflow-hidden rounded-lg border border-border bg-bg-elevated py-1 text-sm shadow-xl"
      data-context-menu-surface="true"
      style={{ left: x, top: y }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          disabled={item.disabled}
          className={`block w-full px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            item.danger
              ? 'text-error hover:bg-error/10'
              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
          }`}
          onClick={() => {
            if (item.disabled) return
            item.onClick()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
