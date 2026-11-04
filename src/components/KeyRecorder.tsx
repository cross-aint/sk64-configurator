import { useRef, useState, type KeyboardEvent } from 'react'

type Props = {
  /** Accessible name of the typing box. */
  label: string
  placeholder: string
}

type Typed = { key: string; gap: number | null }

/**
 * A typing box that lists each key it receives and the milliseconds before it, to check what a
 * macro types and how fast.
 */
export function KeyRecorder({ label, placeholder }: Props) {
  const [typed, setTyped] = useState<Typed[]>([])
  const last = useRef<number | null>(null)

  const record = (e: KeyboardEvent) => {
    if (e.repeat || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return
    const now = e.timeStamp
    const gap = last.current === null ? null : Math.round(now - last.current)
    last.current = now
    setTyped((t) => [...t, { key: e.key === ' ' ? 'Space' : e.key, gap }])
  }
  const clear = () => {
    setTyped([])
    last.current = null
  }

  return (
    <>
      <div className="macro-recorder">
        <textarea
          aria-label={label}
          placeholder={placeholder}
          rows={2}
          value={typed.map((t) => (t.key === 'Space' ? ' ' : t.key.length === 1 ? t.key : '')).join('')}
          onKeyDown={record}
          onChange={() => {}}
        />
        <button className="secondary small" onClick={clear} disabled={typed.length === 0}>
          Clear
        </button>
      </div>
      {typed.length > 0 && (
        <ol className="macro-timeline" aria-label="Keys typed, with the time before each">
          {typed.map((t, i) => (
            <li key={i}>
              <kbd>{t.key}</kbd>
              <span className="muted">{t.gap === null ? 'first' : `+${t.gap} ms`}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
