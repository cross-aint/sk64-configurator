import { useEffect, useMemo, useRef, useState } from 'react'
import { ACTION_GROUPS, ACTIONS } from '../keyboard/actions'
import type { KeyboardLayout } from '../keyboard/layout'
import {
  inputForCode,
  inputFromValue,
  inputLabel,
  MAX_MACROS,
  stepsForText,
  unreleased,
  type MacroDef,
} from '../keyboard/macroLibrary'
import { MAX_MACRO_STEPS, MAX_STEP_DELAY_MS, type MacroStep } from '../keyboard/macros'
import { ChoiceLabel, Segmented, Setting, SettingsHead, SettingsTable } from './controls'
import { KeyRecorder } from './KeyRecorder'

type Props = {
  layout: KeyboardLayout
  macros: readonly MacroDef[]
  selected: MacroDef | null
  full: boolean
  /** Keys that run the selected macro, e.g. "Windows · Menu". */
  links: string[]
  onSelect: (id: string) => void
  onAdd: () => void
  onUpdate: (id: string, change: (m: MacroDef) => MacroDef) => void
  onRemove: (id: string) => void
}

const clampDelay = (ms: number) => Math.min(MAX_STEP_DELAY_MS, Math.max(0, Math.round(ms)))

/** Keys and mouse buttons a step can press, grouped like the key picker. */
const STEP_CHOICES = ACTION_GROUPS.map((group) => ({
  group,
  actions: ACTIONS.filter((a) => a.group === group && inputFromValue(a.value) !== null),
})).filter((g) => g.actions.length > 0)

function repeatText(m: MacroDef) {
  if (m.repeat === 'whileHeld') return 'repeats while held'
  if (m.repeat === 'toggle') return 'repeats until pressed again'
  return m.count === 1 ? 'plays once' : `plays ${m.count} times`
}

/** The macro list and the editor for the selected macro. */
export function MacroEditor({ layout, macros, selected, full, links, onSelect, onAdd, onUpdate, onRemove }: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const index = selected ? macros.findIndex((m) => m.id === selected.id) : -1

  return (
    <div className="workspace macros">
      <section className="tile side macro-list" aria-labelledby="macro-list-title">
        <div className="tile-title">
          <h2 id="macro-list-title">Macros</h2>
          <p className="muted">Link them to keys on the Windows, macOS or FNX layer. The base layer can’t run macros.</p>
        </div>
        <ol className="effect-list" aria-label="Macros">
          {macros.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                className="effect-chip"
                aria-pressed={m.id === selected?.id}
                onClick={() => {
                  onSelect(m.id)
                  setConfirmRemove(false)
                }}
              >
                <span className="effect-number">M{i + 1}</span>
                <span className="effect-chip-text">
                  <span className="effect-chip-name">{m.name}</span>
                  <span className="muted">
                    {m.steps.length} {m.steps.length === 1 ? 'step' : 'steps'} · {repeatText(m)}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="effect-chip effect-add"
              disabled={full}
              title={full ? `You can have up to ${MAX_MACROS} macros.` : undefined}
              onClick={onAdd}
            >
              + New macro
            </button>
          </li>
        </ol>
        <div className="effect-list-actions">
          {selected &&
            (confirmRemove ? (
              <>
                <span>
                  Remove {selected.name}?{' '}
                  {links.length > 0 &&
                    `${links.length} ${links.length === 1 ? 'key goes' : 'keys go'} back to ${links.length === 1 ? 'its' : 'their'} default.`}
                </span>
                <button
                  className="link danger-text"
                  onClick={() => {
                    onRemove(selected.id)
                    setConfirmRemove(false)
                  }}
                >
                  Yes, remove
                </button>
                <button className="link" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="link danger-text" onClick={() => setConfirmRemove(true)}>
                Remove macro
              </button>
            ))}
          <span className="spacer" />
          <span className="label">
            {macros.length} of {MAX_MACROS} macros
          </span>
        </div>
      </section>

      {selected ? (
        <MacroDetails
          key={selected.id}
          layout={layout}
          macro={selected}
          number={index + 1}
          links={links}
          onChange={(change) => onUpdate(selected.id, change)}
        />
      ) : (
        <section className="tile kb-tile empty-state">
          <h2>No macro selected</h2>
          <p className="muted">
            A macro types a sequence of keys (or clicks mouse buttons) when you press one key. Click <b>New macro</b> to
            make one.
          </p>
        </section>
      )}
    </div>
  )
}

function MacroDetails({
  layout,
  macro,
  number,
  links,
  onChange,
}: {
  layout: KeyboardLayout
  macro: MacroDef
  number: number
  links: string[]
  onChange: (change: (m: MacroDef) => MacroDef) => void
}) {
  const room = MAX_MACRO_STEPS - macro.steps.length
  const [adder, setAdder] = useState<'record' | 'text' | 'key'>('record')
  const stuck = useMemo(() => unreleased(macro.steps), [macro.steps])
  const setSteps = (steps: MacroStep[]) => onChange((m) => ({ ...m, steps: steps.slice(0, MAX_MACRO_STEPS) }))
  const append = (steps: MacroStep[]) => onChange((m) => ({ ...m, steps: [...m.steps, ...steps].slice(0, MAX_MACRO_STEPS) }))

  return (
    <section className="tile kb-tile macro-details" aria-label={`Edit macro M${number}`}>
      <div className="settings-box">
        <SettingsHead label="Keys">
          {links.length > 0 ? (
            <span className="settings-keys">{links.join(', ')}</span>
          ) : (
            <span className="muted">
              Not on any key yet. On the Keys page, pick the Windows, macOS or FNX layer, click a key and choose this
              macro under Macros.
            </span>
          )}
        </SettingsHead>
        <SettingsTable columns={1}>
          <Setting label="Name">
            <input
              className="macro-name"
              type="text"
              maxLength={40}
              value={macro.name}
              onChange={(e) => onChange((m) => ({ ...m, name: e.target.value }))}
              onBlur={() => onChange((m) => ({ ...m, name: m.name.trim() || `Macro ${number}` }))}
            />
          </Setting>
          <Setting label="Plays">
            <div className="macro-plays">
              <Segmented
                label="How the macro repeats"
                options={[
                  { value: 'count', label: 'A set number of times', title: 'Plays this many times per press' },
                  { value: 'whileHeld', label: 'While held', title: 'Repeats while the key is held, stops when you let go' },
                  { value: 'toggle', label: 'Until pressed again', title: 'Repeats until you press the key again' },
                ]}
                value={macro.repeat}
                onChange={(repeat) => onChange((m) => ({ ...m, repeat }))}
              />
              {macro.repeat === 'count' && (
                <label className="macro-count">
                  <input
                    type="number"
                    min={1}
                    max={255}
                    value={macro.count}
                    aria-label="Times to play"
                    onChange={(e) => onChange((m) => ({ ...m, count: Math.min(255, Math.max(1, Number(e.target.value) || 1)) }))}
                  />
                  {macro.count === 1 ? 'time per press' : 'times per press'}
                </label>
              )}
            </div>
          </Setting>
        </SettingsTable>
      </div>

      <div className="list-head">
        <h3>Steps</h3>
        <span className="label">
          {macro.steps.length} of {MAX_MACRO_STEPS} · each step presses or releases a key, then waits
        </span>
      </div>
      {macro.steps.length === 0 ? (
        <p className="muted">No steps yet. Record them, type some text, or add keys one at a time below.</p>
      ) : (
        <ol className="macro-steps" aria-label="Steps">
          {macro.steps.map((step, i) => (
            <StepRow
              key={i}
              step={step}
              number={i + 1}
              first={i === 0}
              last={i === macro.steps.length - 1}
              onDelay={(delay) => setSteps(macro.steps.map((s, j) => (j === i ? { ...s, delay: clampDelay(delay) } : s)))}
              onMove={(delta) => {
                const next = [...macro.steps]
                ;[next[i], next[i + delta]] = [next[i + delta], next[i]]
                setSteps(next)
              }}
              onRemove={() => setSteps(macro.steps.filter((_, j) => j !== i))}
            />
          ))}
        </ol>
      )}
      {stuck.length > 0 && (
        <p className="effect-note reaction-notice">
          {stuck.map((s) => inputLabel(s).name).join(', ')} {stuck.length === 1 ? 'is' : 'are'} pressed but never released,
          so {stuck.length === 1 ? 'it' : 'they'} would stay held down after the macro. Add a release step.
        </p>
      )}
      {macro.steps.length > 0 && (
        <div className="effect-list-actions">
          <button className="link danger-text" onClick={() => setSteps([])}>
            Clear all steps
          </button>
        </div>
      )}

      <h3 className="macro-subhead">Add steps</h3>
      <div className="line-tabs" role="tablist" aria-label="Add steps by">
        {(
          [
            ['record', 'Record'],
            ['text', 'Type text'],
            ['key', 'Add a key'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={adder === id} onClick={() => setAdder(id)}>
            <ChoiceLabel text={label} />
          </button>
        ))}
      </div>
      {adder === 'record' && <Recorder layout={layout} steps={macro.steps} onSteps={setSteps} room={room} />}
      {adder === 'text' && <TextAdder room={room} onAdd={append} />}
      {adder === 'key' && <KeyAdder room={room} onAdd={append} />}

      <div className="inset try-it">
        <h3>Try it</h3>
        <p className="muted">
          After you click <b>Apply to keyboard</b>, switch the keyboard to a layer where a key runs this macro, click in
          the box and press that key. Each key the macro types is listed with the time before it.
        </p>
        <KeyRecorder label="Typing area for trying a macro" placeholder="Click here, then press the macro’s key" />
      </div>
    </section>
  )
}

function StepRow({
  step,
  number,
  first,
  last,
  onDelay,
  onMove,
  onRemove,
}: {
  step: MacroStep
  number: number
  first: boolean
  last: boolean
  onDelay: (ms: number) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}) {
  const label = inputLabel(step.input)
  return (
    <li className="macro-step" data-down={step.down || undefined}>
      <span className="muted macro-step-number">{number}</span>
      <span className="macro-step-action">{step.down ? '↓ Press' : '↑ Release'}</span>
      <kbd title={label.name}>{label.cap}</kbd>
      <label className="macro-step-delay">
        <span className="muted">then wait</span>
        <input
          type="number"
          min={0}
          max={MAX_STEP_DELAY_MS}
          step={10}
          value={step.delay}
          aria-label={`Milliseconds to wait after step ${number}`}
          onChange={(e) => onDelay(Number(e.target.value) || 0)}
        />
        <span className="muted">ms</span>
      </label>
      <span className="macro-step-buttons">
        <button className="link" disabled={first} onClick={() => onMove(-1)} aria-label={`Move step ${number} up`}>
          ↑
        </button>
        <button className="link" disabled={last} onClick={() => onMove(1)} aria-label={`Move step ${number} down`}>
          ↓
        </button>
        <button className="link danger-text" onClick={onRemove} aria-label={`Remove step ${number}`}>
          ×
        </button>
      </span>
    </li>
  )
}

/** Records key presses and releases (with the pauses between them) from the computer's keyboard. */
function Recorder({
  layout,
  steps,
  onSteps,
  room,
}: {
  layout: KeyboardLayout
  steps: MacroStep[]
  onSteps: (steps: MacroStep[]) => void
  room: number
}) {
  const [recording, setRecording] = useState(false)
  const [keepPauses, setKeepPauses] = useState(true)
  const [skipped, setSkipped] = useState<string[]>([])
  const session = useRef<{ base: MacroStep[]; recorded: MacroStep[]; last: number | null; held: Set<string> } | null>(null)
  const latest = useRef({ onSteps, layout, keepPauses })
  useEffect(() => {
    latest.current = { onSteps, layout, keepPauses }
  })

  const stop = () => {
    const s = session.current
    if (s) {
      // Release anything still held, so the macro doesn't leave keys down.
      for (const code of s.held) {
        const input = inputForCode(latest.current.layout, code)
        if (input && s.base.length + s.recorded.length < MAX_MACRO_STEPS) s.recorded.push({ input, down: false, delay: 0 })
      }
      latest.current.onSteps([...s.base, ...s.recorded])
    }
    session.current = null
    setRecording(false)
  }

  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      const s = session.current
      if (!s) return
      e.preventDefault()
      e.stopPropagation()
      const down = e.type === 'keydown'
      if (down && e.repeat) return
      if (!down && !s.held.has(e.code)) return // released a key pressed before recording started
      const input = inputForCode(latest.current.layout, e.code)
      if (!input) {
        if (down) setSkipped((list) => (list.includes(e.code) ? list : [...list, e.code]))
        return
      }
      if (down) s.held.add(e.code)
      else s.held.delete(e.code)
      const prev = s.recorded.at(-1)
      if (prev && s.last !== null && latest.current.keepPauses) prev.delay = clampDelay(e.timeStamp - s.last)
      s.last = e.timeStamp
      s.recorded.push({ input, down, delay: 0 })
      latest.current.onSteps([...s.base, ...s.recorded])
      if (s.base.length + s.recorded.length >= MAX_MACRO_STEPS) {
        session.current = null
        setRecording(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKey, true)
    }
  }, [recording])

  return (
    <div className="macro-adder">
      <div className="effect-test-actions">
        {recording ? (
          <button className="small danger" onClick={stop}>
            ■ Stop recording
          </button>
        ) : (
          <button
            className="small"
            disabled={room <= 0}
            onClick={() => {
              session.current = { base: steps, recorded: [], last: null, held: new Set() }
              setSkipped([])
              setRecording(true)
            }}
          >
            ● Record
          </button>
        )}
        <label className="macro-check">
          <input type="checkbox" checked={keepPauses} onChange={(e) => setKeepPauses(e.target.checked)} />
          Keep the pauses between keys
        </label>
      </div>
      <p className="muted">
        {recording
          ? 'Recording: type on your keyboard, then click Stop. Each press and release becomes a step.'
          : 'Records what you type on your keyboard, including Shift, Ctrl and the other modifiers. Fn can’t be recorded, and the Win key may also open the Start menu.'}
      </p>
      {skipped.length > 0 && <p className="muted">Skipped (a macro can’t type these): {skipped.join(', ')}</p>}
    </div>
  )
}

/** Adds steps that type a piece of text. */
function TextAdder({ room, onAdd }: { room: number; onAdd: (steps: MacroStep[]) => void }) {
  const [text, setText] = useState('')
  const [gap, setGap] = useState(20)
  const result = useMemo(() => stepsForText(text, gap), [text, gap])
  const tooLong = result.steps.length > room

  return (
    <div className="macro-adder">
      <div className="effect-test-actions">
        <input
          className="macro-text"
          type="text"
          placeholder="Type text, e.g. Hello!"
          aria-label="Text the macro types"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <label className="macro-count">
          <input
            type="number"
            min={0}
            max={1000}
            step={10}
            value={gap}
            aria-label="Milliseconds between characters"
            onChange={(e) => setGap(clampDelay(Number(e.target.value) || 0))}
          />
          ms between characters
        </label>
        <button
          className="small secondary"
          disabled={result.steps.length === 0 || tooLong}
          onClick={() => {
            onAdd(result.steps)
            setText('')
          }}
        >
          Add text
        </button>
      </div>
      {text && (
        <p className="muted">
          {tooLong
            ? `That needs ${result.steps.length} steps, but only ${room} are left.`
            : `${result.steps.length} steps.`}
          {result.skipped.length > 0 && ` Can’t type: ${result.skipped.join(' ')} (US layout characters only).`}
        </p>
      )}
    </div>
  )
}

/** Adds a single press, hold or release of a chosen key or mouse button. */
function KeyAdder({ room, onAdd }: { room: number; onAdd: (steps: MacroStep[]) => void }) {
  const [value, setValue] = useState(STEP_CHOICES[0].actions[0].value)
  const input = inputFromValue(value)
  if (!input) return null
  const add = (steps: MacroStep[]) => onAdd(steps)

  return (
    <div className="macro-adder">
      <div className="effect-test-actions">
        <select aria-label="Key or mouse button" value={value} onChange={(e) => setValue(Number(e.target.value))}>
          {STEP_CHOICES.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.actions.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          className="small secondary"
          disabled={room < 2}
          title="Press and release"
          onClick={() =>
            add([
              { input, down: true, delay: 0 },
              { input, down: false, delay: 20 },
            ])
          }
        >
          Add press
        </button>
        <button className="small secondary" disabled={room < 1} title="Press and keep it held" onClick={() => add([{ input, down: true, delay: 0 }])}>
          Add hold
        </button>
        <button className="small secondary" disabled={room < 1} onClick={() => add([{ input, down: false, delay: 0 }])}>
          Add release
        </button>
      </div>
    </div>
  )
}
