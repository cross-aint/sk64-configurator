import { useId, useMemo, useState } from 'react'
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
  /** The category shown in the list. It belongs to the page, so it stays when another key is picked. */
  group: ActionGroup | 'All'
  onGroup: (group: ActionGroup | 'All') => void
}

const COMBO_MODS: { bit: number; label: string }[] = [
  { bit: Modifier.LCtrl, label: 'Ctrl' },
  { bit: Modifier.LShift, label: 'Shift' },
  { bit: Modifier.LAlt, label: 'Alt' },
  { bit: Modifier.LWin, label: 'Win' },
]

/** Groups whose actions can be combined with modifiers (e.g. Ctrl+C). */
const COMBINABLE = new Set<ActionGroup>(['Letters', 'Numbers', 'Symbols', 'Editing', 'Navigation', 'Function keys'])

const LAYER_LABEL: Record<LayerName, string> = { normal: 'Normal', fn: 'Fn held' }

/**
 * Remapping controls for one key: what it does now, then a searchable list of everything it can
 * do. Mount it with `key={keyId + layer}` so its search and modifiers reset with the selection.
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
  group,
  onGroup: setGroup,
}: Props) {
  const id = useId()
  const current = override ?? defaultValue
  const [query, setQuery] = useState('')
  const [mods, setMods] = useState(() => (override !== null ? splitCombo(override).mods : 0))

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...ACTIONS, ...(extraActions ?? [])].filter(
      (a) =>
        (q ? true : group === 'All' || a.group === group) &&
        (!q || a.name.toLowerCase().includes(q) || a.cap.toLowerCase() === q || a.keywords?.includes(q)),
    )
  }, [query, group, extraActions])

  const heading = (
    <div className="remap-head">
      <p>
        <b>Selected key</b>
        <span className="muted">
          {' '}
          · {boardName} layer · {LAYER_LABEL[layer]}
        </span>
      </p>
      <h2 className="remap-key">{keyDef.name}</h2>
    </div>
  )

  if (locked) {
    return (
      <div className="remap">
        {heading}
        <p className="muted">
          Fn switches to the Fn layer inside the keyboard, so it can't be remapped. Use Fn held to change what keys do
          while Fn is held.
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

  const nowText =
    override !== null
      ? describeValue(override).name
      : (defaultName ?? (current === null ? 'Firmware default' : describeValue(current).name))

  return (
    <div className="remap">
      {heading}

      <div className="remap-current inset">
        <div>
          <div className="label">What it does now</div>
          <div className="remap-now">{nowText}</div>
        </div>
        {override !== null && (
          <button type="button" className="ghost small" onClick={() => onChange(null)}>
            Reset to default
          </button>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${id}-q`} className="label">
          Search keys and functions
        </label>
        <input
          id={`${id}-q`}
          type="search"
          placeholder="e.g. Volume up, F13, Ctrl+C"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="remap-filters">
        <div className="field">
          <label htmlFor={`${id}-g`} className="label">
            Category
          </label>
          <select
            id={`${id}-g`}
            value={group}
            disabled={!!query.trim()}
            title={query.trim() ? 'Searching every category' : undefined}
            onChange={(e) => setGroup(e.target.value as ActionGroup | 'All')}
          >
            <option value="All">All</option>
            {ACTION_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="remap-mods">
          <legend className="label">Hold with it</legend>
          <div>
            {COMBO_MODS.map((m) => (
              <label key={m.bit} className="check">
                <input type="checkbox" checked={(mods & m.bit) !== 0} onChange={() => toggleMod(m.bit)} />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <ul className="remap-results" aria-label={query.trim() ? 'Search results' : group}>
        {results.length === 0 && (
          <li className="remap-empty muted">
            {group === 'Macros' && !query ? 'No macros yet. Make one on the Macros page.' : 'No matches.'}
          </li>
        )}
        {results.map((action) => {
          const value = COMBINABLE.has(action.group) && isKeyValue(action.value) ? makeCombo(action.value, mods) : action.value
          const reason = unavailable?.(action) ?? null
          const on = current === value
          return (
            <li key={action.value}>
              <button
                type="button"
                className="action"
                aria-pressed={on}
                title={reason ?? describeValue(value).name}
                disabled={!!reason}
                onClick={() => pick(action)}
              >
                <kbd className="action-cap">{action.cap}</kbd>
                <span className="action-name">{action.name}</span>
                <span className="label">{on ? 'Current' : reason ? 'Not on this layer' : query.trim() ? action.group : ''}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
