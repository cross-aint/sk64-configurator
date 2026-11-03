import type { CSSProperties } from 'react'
import type { KeyboardLayout, KeyDef } from '../keyboard/layout'
import './KeyboardView.css'

/** What to print on a keycap and how to mark it. */
export type KeyCap = {
  label: string
  /** Longer description for the tooltip / screen readers. */
  description?: string
  /** The key does something other than its default. */
  remapped?: boolean
  /** The key can't be changed (Fn). */
  locked?: boolean
  /** We don't know what this key does here (e.g. untouched Fn-layer keys). */
  unknown?: boolean
}

type Props = {
  layout: KeyboardLayout
  /** Per-key legends. Keys without an entry show their printed label. */
  caps?: Readonly<Record<string, KeyCap>>
  selectedId?: string | null
  /** Keys physically held down right now (key tester). */
  heldIds?: ReadonlySet<string>
  /** Keys pressed at least once during the key test. */
  testedIds?: ReadonlySet<string>
  onSelect?: (key: KeyDef) => void
}

/**
 * Draws the keyboard. Purely presentational: every visual state is exposed as a data
 * attribute on the key (`data-selected`, `data-held`, `data-tested`, `data-wide`,
 * `data-remapped`, `data-locked`, `data-unknown`) so the look can be changed from CSS alone.
 */
export function KeyboardView({ layout, caps, selectedId, heldIds, testedIds, onSelect }: Props) {
  const style = { '--kb-cols': layout.width, '--kb-rows': layout.height } as CSSProperties

  return (
    <div className="kb" style={style} role="group" aria-label={`${layout.name} keyboard`}>
      <div className="kb-plate">
        {layout.keys.map((key) => {
          const cap = caps?.[key.id]
          const keyStyle = { '--x': key.x, '--y': key.y, '--w': key.w } as CSSProperties
          const description = cap?.description ? `${key.name}: ${cap.description}` : key.name
          return (
            <button
              key={key.id}
              type="button"
              className="kb-key"
              style={keyStyle}
              title={description}
              aria-label={description}
              aria-pressed={selectedId === key.id}
              data-selected={selectedId === key.id || undefined}
              data-held={heldIds?.has(key.id) || undefined}
              data-tested={testedIds?.has(key.id) || undefined}
              data-wide={key.w > 1 || undefined}
              data-remapped={cap?.remapped || undefined}
              data-locked={cap?.locked || undefined}
              data-unknown={cap?.unknown || undefined}
              onClick={() => onSelect?.(key)}
            >
              <span className="kb-key-cap">{cap ? cap.label : key.label}</span>
              {cap?.remapped && <span className="kb-key-badge" aria-hidden />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
