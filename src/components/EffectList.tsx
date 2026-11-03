import { useRef } from 'react'
import type { KeyboardLayout } from '../keyboard/layout'
import { useCloseOnOutside } from '../hooks/useCloseOnOutside'
import { MAX_EFFECTS } from '../keyboard/effects'
import { describeSlot, EFFECT_KINDS, effectName, MAX_MODES, type EffectKind, type EffectSlot } from '../keyboard/presets'

type Props = {
  layout: KeyboardLayout
  slots: readonly EffectSlot[]
  selectedId: string | null
  /** Effect slots used by modes and key reactions together (the keyboard has 32). */
  used: number
  /** Key reactions exist, so mode 1 is the look the keyboard returns to after each one. */
  hasReactions: boolean
  onSelect: (id: string) => void
  onAdd: (kind: EffectKind) => void
  onMove: (id: string, delta: -1 | 1) => void
  onRemove: (id: string) => void
}

/** The custom lighting modes in Fn + ] order, with add / reorder / remove. */
export function EffectList({ layout, slots, selectedId, used, hasReactions, onSelect, onAdd, onMove, onRemove }: Props) {
  const addMenu = useRef<HTMLDetailsElement>(null)

  useCloseOnOutside(addMenu)
  const index = slots.findIndex((s) => s.id === selectedId)
  const full = slots.length >= MAX_MODES || used >= MAX_EFFECTS

  return (
    <div className="effects">
      <div className="list-head">
        <span>Modes</span>
        <span className="muted">Fn + ] on the keyboard steps through these.</span>
      </div>
      <ol className="effect-list" aria-label="Lighting modes, in the order Fn + ] steps through them">
        {slots.map((slot, i) => (
          <li key={slot.id}>
            <button
              type="button"
              className="effect-chip"
              aria-pressed={slot.id === selectedId}
              onClick={() => onSelect(slot.id)}
            >
              <span className="effect-number">{i + 1}</span>
              <span className="effect-chip-text">
                <span className="effect-chip-name">{effectName(slot.kind)}</span>
                <span className="muted">{describeSlot(layout, slot)}</span>
              </span>
              {i === 0 && hasReactions && (
                <span className="effect-base" title="The keyboard shows this mode after each key reaction">
                  Base
                </span>
              )}
            </button>
          </li>
        ))}
        <li>
          <details className="add-menu" ref={addMenu}>
            <summary
              className="effect-chip effect-add"
              aria-disabled={full || undefined}
              title={
                !full
                  ? undefined
                  : slots.length >= MAX_MODES
                    ? `You can have up to ${MAX_MODES} modes. Remove one to add another.`
                    : `The keyboard’s ${MAX_EFFECTS} slots are all used by modes and reactions. Remove a reaction key first.`
              }
              onClick={(e) => {
                if (full) e.preventDefault()
              }}
            >
              + Add mode
            </summary>
            {!full && (
              <div className="add-menu-list" role="menu">
                {EFFECT_KINDS.map((k) => (
                  <button
                    key={k.kind}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onAdd(k.kind)
                      if (addMenu.current) addMenu.current.open = false
                    }}
                  >
                    <b>{k.name}</b>
                    <span className="muted">{k.description}</span>
                  </button>
                ))}
              </div>
            )}
          </details>
        </li>
      </ol>

      <div className="effect-list-actions">
        {index >= 0 && (
          <>
            <button className="link" onClick={() => onMove(slots[index].id, -1)} disabled={index === 0}>
              ← Move earlier
            </button>
            <button className="link" onClick={() => onMove(slots[index].id, 1)} disabled={index === slots.length - 1}>
              Move later →
            </button>
            <button className="link danger-text" onClick={() => onRemove(slots[index].id)}>
              Remove
            </button>
          </>
        )}
        <span className="spacer" />
        <span className="muted">
          {slots.length} of {MAX_MODES} modes
        </span>
      </div>
    </div>
  )
}
