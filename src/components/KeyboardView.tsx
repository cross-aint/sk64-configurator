import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
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
  /** Call the key out (e.g. a shortcut key in the shortcut map). */
  highlight?: boolean
  /** Fade the key into the background. */
  dimmed?: boolean
}

type Props = {
  layout: KeyboardLayout
  /** Per-key legends. Keys without an entry show their printed label. */
  caps?: Readonly<Record<string, KeyCap>>
  /** Per-key LED colors (#rrggbb). When set, the board is drawn in lighting mode. */
  colors?: Readonly<Record<string, string>>
  selectedId?: string | null
  /** Keys physically held down right now (key tester). */
  heldIds?: ReadonlySet<string>
  /** Keys pressed at least once during the key test. */
  testedIds?: ReadonlySet<string>
  /** Keys marked as part of a set being chosen (e.g. the keys a lighting mode uses). */
  markedIds?: ReadonlySet<string>
  onSelect?: (key: KeyDef) => void
  /** Paint mode: called for the key under the pointer on press and while dragging. Replaces onSelect. */
  onPaint?: (key: KeyDef) => void
  /** Drawn over the plate (e.g. a picture being positioned). Keys can't be clicked while it's shown. */
  overlay?: ReactNode
}

/**
 * Draws the keyboard. Purely presentational: every visual state is exposed as a data
 * attribute on the key (`data-selected`, `data-held`, `data-tested`, `data-wide`,
 * `data-remapped`, `data-locked`, `data-unknown`, `data-highlight`, `data-dimmed`, `data-marked`, `data-lit`)
 * so the look can be changed
 * from CSS alone. Lit keys get their color in the `--key-color` custom property.
 */
export function KeyboardView(props: Props) {
  const { layout, caps, colors, selectedId, heldIds, testedIds, markedIds, onSelect, onPaint, overlay } = props
  const style = { '--kb-cols': layout.width, '--kb-rows': layout.height } as CSSProperties
  // Last pointer position while painting, so fast drags paint every key along the path.
  const painting = useRef<{ x: number; y: number } | null>(null)
  const keysById = new Map(layout.keys.map((k) => [k.id, k]))

  const paintAlong = (x: number, y: number) => {
    const from = painting.current
    if (!from || !onPaint) return
    const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / 6))
    let lastId: string | undefined
    for (let i = 1; i <= steps; i++) {
      const px = from.x + ((x - from.x) * i) / steps
      const py = from.y + ((y - from.y) * i) / steps
      const id = (document.elementFromPoint(px, py)?.closest('[data-key-id]') as HTMLElement | null)?.dataset.keyId
      if (id && id !== lastId) {
        const key = keysById.get(id)
        if (key) onPaint(key)
        lastId = id
      }
    }
    painting.current = { x, y }
  }

  useEffect(() => {
    const stop = () => (painting.current = null)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])

  return (
    <div
      className="kb"
      style={style}
      role="group"
      aria-label={`${layout.name} keyboard`}
      data-mode={colors ? 'lighting' : undefined}
      data-painting={onPaint ? true : undefined}
      data-frozen={overlay ? true : undefined}
    >
      <div
        className="kb-plate"
        onPointerMove={(e) => {
          if (painting.current && e.buttons & 1) paintAlong(e.clientX, e.clientY)
        }}
      >
        {layout.keys.map((key) => {
          const cap = caps?.[key.id]
          const color = colors?.[key.id]
          const keyStyle = { '--x': key.x, '--y': key.y, '--w': key.w, '--key-color': color } as CSSProperties
          const description = cap?.description ? `${key.name}: ${cap.description}` : key.name
          return (
            <button
              key={key.id}
              type="button"
              className="kb-key"
              style={keyStyle}
              title={description}
              aria-label={description}
              aria-pressed={onPaint ? undefined : markedIds ? markedIds.has(key.id) : selectedId === key.id}
              data-selected={selectedId === key.id || undefined}
              data-held={heldIds?.has(key.id) || undefined}
              data-tested={testedIds?.has(key.id) || undefined}
              data-marked={markedIds?.has(key.id) || undefined}
              data-wide={key.w > 1 || undefined}
              data-remapped={cap?.remapped || undefined}
              data-locked={cap?.locked || undefined}
              data-unknown={cap?.unknown || undefined}
              data-highlight={cap?.highlight || undefined}
              data-dimmed={cap?.dimmed || undefined}
              data-lit={color ? true : undefined}
              data-key-id={key.id}
              onPointerDown={(e) => {
                if (!onPaint || e.button !== 0) return
                painting.current = { x: e.clientX, y: e.clientY }
                onPaint(key)
              }}
              onClick={(e) => {
                // In paint mode, pointer presses already painted; only keyboard activation (detail 0) paints here.
                if (onPaint) {
                  if (e.detail === 0) onPaint(key)
                } else onSelect?.(key)
              }}
            >
              <span className="kb-key-cap">{cap ? cap.label : key.label}</span>
              {cap?.remapped && <span className="kb-key-badge" aria-hidden />}
            </button>
          )
        })}
        {overlay}
      </div>
    </div>
  )
}
