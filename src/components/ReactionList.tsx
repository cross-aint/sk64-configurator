import { useRef } from 'react'
import { useCloseOnOutside } from '../hooks/useCloseOnOutside'
import type { KeyboardLayout } from '../keyboard/layout'
import { describeReaction, REACTION_KINDS, reactionTitle, type Reaction, type ReactionKind } from '../keyboard/reactions'

type Props = {
  layout: KeyboardLayout
  reactions: readonly Reaction[]
  selectedId: string | null
  /** Why new reactions can't be added right now (no slots left, no modes…), or null. */
  addBlocked: string | null
  /** Keyboard slots left for reaction animations. */
  slotsLeft: number
  onSelect: (id: string) => void
  onAdd: (kind: ReactionKind) => void
  onRemove: (id: string) => void
}

/** Key reactions: animations that play when certain keys are pressed. */
export function ReactionList({ layout, reactions, selectedId, addBlocked, slotsLeft, onSelect, onAdd, onRemove }: Props) {
  const addMenu = useRef<HTMLDetailsElement>(null)
  useCloseOnOutside(addMenu)
  const selected = reactions.find((r) => r.id === selectedId)

  return (
    <div className="effects">
      <div className="list-head">
        <span>Key reactions</span>
        <span className="muted">Play when a key is pressed, then the keyboard goes back to mode 1.</span>
      </div>
      <ol className="effect-list" aria-label="Key reactions">
        {reactions.map((reaction) => (
          <li key={reaction.id}>
            <button
              type="button"
              className="effect-chip"
              aria-pressed={reaction.id === selectedId}
              onClick={() => onSelect(reaction.id)}
            >
              <span className="effect-number" aria-hidden>
                ⚡
              </span>
              <span className="effect-chip-text">
                <span className="effect-chip-name">{reactionTitle(reaction)}</span>
                <span className="muted">{describeReaction(layout, reaction)}</span>
              </span>
            </button>
          </li>
        ))}
        <li>
          <details className="add-menu" ref={addMenu}>
            <summary
              className="effect-chip effect-add"
              aria-disabled={addBlocked ? true : undefined}
              title={addBlocked ?? undefined}
              onClick={(e) => {
                if (addBlocked) e.preventDefault()
              }}
            >
              + Add reaction
            </summary>
            {!addBlocked && (
              <div className="add-menu-list" role="menu">
                {REACTION_KINDS.map((k) => (
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
        {selected && (
          <button className="link danger-text" onClick={() => onRemove(selected.id)}>
            Remove reaction
          </button>
        )}
        <span className="spacer" />
        <span className="muted">
          {slotsLeft} keyboard {slotsLeft === 1 ? 'slot' : 'slots'} left for reactions
        </span>
      </div>
    </div>
  )
}
