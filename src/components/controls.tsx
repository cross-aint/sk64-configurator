import type { ReactNode } from 'react'

// Small building blocks shared by the settings panels.

/** A labelled row of controls. */
export function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="image-control" role="group" aria-label={label}>
      <span className="muted">{label}</span>
      {children}
    </div>
  )
}

/** A row of mutually exclusive options (radio buttons styled as a segmented control). */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
  disabledTitle,
}: {
  label: string
  options: { value: T; label: string; title?: string; ariaLabel?: string; disabled?: boolean }[]
  value: T
  onChange: (value: T) => void
  /** Disables the whole group (e.g. a setting that doesn't apply right now). */
  disabled?: boolean
  disabledTitle?: string
}) {
  return (
    <div
      className="segmented"
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      title={disabled ? disabledTitle : undefined}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.ariaLabel}
          title={disabled ? undefined : o.title}
          disabled={disabled || o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
