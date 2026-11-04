import { useMemo, useState } from 'react'
import {
  ACTION_GROUPS,
  ACTIONS,
  describe,
  isKeyValue,
  makeCombo,
  Modifier,
  splitCombo,
  type Action,
  type ActionGroup,
} from '../keyboard/actions'
import type { LayerName } from '../keyboard/keymap'
import type { KeyDef } from '../keyboard/layout'

type Props = {
  keyDef: KeyDef
  /** Name of the keyboard layer being edited (Base, Windows…). */
  boardName: string
  layer: LayerName
  /** The user's override on this layer, or null if the key is at its default. */
  override: number | null
  /** The key's default function on this layer, if its key code is known. */
  defaultValue: number | null
  /** What the key does by default, when known (also when its key code isn't). */
  defaultName: string | null
  /** Why an action can't be picked on this layer, or null if it can. */
  unavailable?: (action: Action) => string | null
  /** More choices, e.g. the user's macros. */
  extraActions?: readonly Action[]
  /** Names values, including extra ones (defaults to the key catalog). */
  describeValue?: (value: number) => { name: string; cap: string }
  locked: boolean
  onChange: (value: number | null) => void
}

const COMBO_MODS: { bit: number; label: string }[] = [
  { bit: Modifier.LCtrl, label: 'Ctrl' },
  { bit: Modifier.LShift, label: 'Shift' },
  { bit: Modifier.LAlt, label: 'Alt' },
  { bit: Modifier.LWin, label: 'Win' },
]

/** Groups whose actions can be combined with modifiers (e.g. Ctrl+C). */
const COMBINABLE = new Set<ActionGroup>(['Letters', 'Numbers', 'Symbols', 'Editing', 'Navigation', 'Function keys'])

const LAYER_LABEL: Record<LayerName, string> = { normal: 'Normal', fn: 'Fn layer' }

/**
 * Remapping controls for one key. Mount it with `key={keyId + layer}` so its search and
 * modifier state reset when the selection changes.
 */
export function RemapPanel({
  keyDef,
  boardName,
  layer,
  override,
  defaultValue,
  defaultName,
  unavailable,
  extraActions,
  describeValue = describe,
  locked,
  onChange,
}: Props) {
  const current = override ?? defaultValue
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<ActionGroup | 'All'>('All')
  const [mods, setMods] = useState(() => (override !== null ? splitCombo(override).mods : 0))

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...ACTIONS, ...(extraActions ?? [])].filter(
      (a) =>
        (group === 'All' || a.group === group) &&
        (!q || a.name.toLowerCase().includes(q) || a.cap.toLowerCase() === q || a.keywords?.includes(q)),
    )
  }, [query, group, extraActions])

  if (locked) {
    return (
      <div className="remap">
        <RemapHeading keyDef={keyDef} boardName={boardName} layer={layer} />
        <p className="muted">
          Fn switches to the Fn layer inside the keyboard, so it can't be remapped. Use the Fn layer tab to change
          what keys do while Fn is held.
        </p>
      </div>
    )
  }

  const pick = (action: Action) => {
    const value = COMBINABLE.has(action.group) && isKeyValue(action.value) ? makeCombo(action.value, mods) : action.value
    onChange(value === defaultValue ? null : value)
  }

  const toggleMod = (bit: number) => {
    const next = mods ^ bit
    setMods(next)
    // Apply to the current key right away if it's a plain key, so toggling feels direct.
    if (current !== null && isKeyValue(current)) {
      const { base } = splitCombo(current)
      const action = ACTIONS.find((a) => a.value === base)
      if (action && COMBINABLE.has(action.group)) {
        const value = makeCombo(base, next)
        onChange(value === defaultValue ? null : value)
      }
    }
  }

  const currentText =
    override !== null
      ? describeValue(override).name
      : (defaultName ?? (current === null ? 'Firmware default' : describeValue(current).name))

  return (
    <div className="remap">
      <RemapHeading keyDef={keyDef} boardName={boardName} layer={layer} />

      <div className="remap-current">
        <div>
          <span className="muted">Currently</span>
          <strong>{currentText}</strong>
          <span className="remap-status" data-changed={override !== null || undefined}>
            {override !== null ? 'Changed' : 'Default'}
          </span>
        </div>
        {override !== null && (
          <button className="secondary small" onClick={() => onChange(null)}>
            Reset to default
          </button>
        )}
      </div>

      <div className="remap-mods" role="group" aria-label="Hold modifiers with the key">
        <span className="muted">Combine with</span>
        {COMBO_MODS.map((m) => (
          <button
            key={m.bit}
            type="button"
            className="chip"
            aria-pressed={(mods & m.bit) !== 0}
            onClick={() => toggleMod(m.bit)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <input
        className="remap-search"
        type="search"
        placeholder="Search keys and functions…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search keys and functions"
      />

      <div className="remap-groups" role="tablist" aria-label="Categories">
        {(['All', ...ACTION_GROUPS] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            className="chip"
            aria-selected={group === g}
            onClick={() => setGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="remap-results">
        {results.length === 0 && (
          <p className="muted">
            {group === 'Macros' && !query ? 'No macros yet. Make one on the Macros tab.' : 'No matches.'}
          </p>
        )}
        {results.map((action) => {
          const value = COMBINABLE.has(action.group) && isKeyValue(action.value) ? makeCombo(action.value, mods) : action.value
          const reason = unavailable?.(action) ?? null
          return (
            <button
              key={action.value}
              type="button"
              className="action"
              aria-pressed={current === value}
              title={reason ?? describeValue(value).name}
              disabled={!!reason}
              onClick={() => pick(action)}
            >
              <span className="action-cap">{action.cap}</span>
              <span className="action-name">{action.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RemapHeading({ keyDef, boardName, layer }: { keyDef: KeyDef; boardName: string; layer: LayerName }) {
  return (
    <h3 className="remap-title">
      {keyDef.name}{' '}
      <span className="muted">
        · {boardName} layer · {LAYER_LABEL[layer]}
      </span>
    </h3>
  )
}
