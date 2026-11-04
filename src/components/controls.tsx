import type { ReactNode } from 'react'
import { rangeFill } from './rangeFill'

// Small building blocks shared by the settings panels.

/** Settings laid out as a table: `columns` settings per row, each label above its control, lined up in columns. */
export function SettingsTable({ columns, children }: { columns: 1 | 2 | 3; children: ReactNode }) {
  return (
    <div className="settings-table" data-columns={columns}>
      {children}
    </div>
  )
}

/** One labelled setting: a cell in a SettingsTable. `span` makes it take 2 columns or the whole row. */
export function Setting({ label, span, children }: { label: string; span?: 2 | 'all'; children: ReactNode }) {
  return (
    <div className="setting" role="group" aria-label={label} data-span={span}>
      <span className="setting-label">{label}</span>
      <div className="setting-control">{children}</div>
    </div>
  )
}

/** The heading line of a settings box: a small label over a large value (e.g. the chosen keys). */
export function SettingsHead({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="settings-head">
      <span className="label">{label}</span>
      <div className="settings-head-value">{children}</div>
    </div>
  )
}

/** A slider with its value shown in a small box beside it, as Carbon's slider does. */
export function Slider({
  label,
  min,
  max,
  step,
  value,
  valueText,
  onChange,
}: {
  /** Accessible name, e.g. "Duration in seconds". */
  label: string
  min: number
  max: number
  step: number
  value: number
  valueText: string
  onChange: (value: number) => void
}) {
  return (
    <span className="slider">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        style={rangeFill(value, min, max)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output className="slider-value">{valueText}</output>
    </span>
  )
}

/**
 * The text of a tab or switch option. The selected one is bold; this keeps room for the bold
 * text at all times, so options don't change width when they're picked.
 */
export function ChoiceLabel({ text }: { text: string }) {
  return (
    <span className="choice-label" data-text={text}>
      {text}
    </span>
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
          <ChoiceLabel text={o.label} />
        </button>
      ))}
    </div>
  )
}
