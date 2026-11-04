import { useMemo, useState } from 'react'
import type { KeyboardLayout } from '../keyboard/layout'
import type { LayerShortcut, Shortcut } from '../keyboard/shortcuts'
import { KeyboardView, type KeyCap } from './KeyboardView'

type Props = {
  layout: KeyboardLayout
  layers: readonly LayerShortcut[]
  shortcuts: readonly Shortcut[]
  source: { name: string; url: string }
  issuesUrl: string
  /** Most custom modes the keyboard's effect table holds. */
  maxCustomModes: number
}

/** The keyboard's own Fn shortcuts: switching layers, then lighting, with a map and how the modes work. */
export function ShortcutGuide({ layout, layers, shortcuts, source, issuesUrl, maxCustomModes }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const keysById = useMemo(() => new Map(layout.keys.map((k) => [k.id, k])), [layout])

  const caps = useMemo(() => {
    const byKey = new Map<string, { cap: string; label: string }>()
    for (const l of layers) if (l.fnKeyId) byKey.set(l.fnKeyId, { cap: l.cap, label: l.name })
    for (const s of shortcuts) byKey.set(s.keyId, { cap: s.cap, label: s.label })
    const result: Record<string, KeyCap> = {}
    for (const key of layout.keys) {
      const s = byKey.get(key.id)
      if (s) result[key.id] = { label: s.cap, description: `Fn + ${key.name}: ${s.label}`, highlight: true }
      else if (key.id === layout.fnKeyId) result[key.id] = { label: 'Fn', description: 'Hold Fn', highlight: true }
      else result[key.id] = { label: key.label, dimmed: true }
    }
    return result
  }, [layout, layers, shortcuts])

  const rowProps = (keyId: string | null) =>
    keyId
      ? {
          'data-active': active === keyId || undefined,
          onMouseEnter: () => setActive(keyId),
          onMouseLeave: () => setActive(null),
        }
      : {}

  return (
    <div className="guide">
      <div className="guide-map">
        <p className="muted">Hold Fn and press a highlighted key. Click a key here to find it in the lists below.</p>
        <KeyboardView
          layout={layout}
          caps={caps}
          selectedId={active}
          onSelect={(key) => setActive((cur) => (cur === key.id ? null : key.id))}
        />
      </div>

      <div className="guide-cols">
        <div className="guide-list">
          <h3>Layers</h3>
          <p className="muted">Skyloong’s manual numbers them in a hexagon.</p>
          <ul className="shortcut-list">
            {layers.map((l) => (
              <li key={l.mode} {...rowProps(l.fnKeyId)}>
                <span className="shortcut-keys">
                  {l.fnKeyId ? (
                    <>
                      <kbd>Fn</kbd> + <kbd>{keysById.get(l.fnKeyId)?.label}</kbd>
                    </>
                  ) : (
                    <>
                      Hold <kbd>FNX</kbd>
                    </>
                  )}
                </span>
                <span>
                  <span className="shortcut-name">
                    <Hexagon n={l.mode} />
                    {l.name}
                  </span>
                  <span className="muted shortcut-detail">{l.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          <h3>Lighting</h3>
          <ul className="shortcut-list">
            {shortcuts.map((s) => (
              <li key={s.keyId} {...rowProps(s.keyId)}>
                <span className="shortcut-keys">
                  <kbd>Fn</kbd> + <kbd>{keysById.get(s.keyId)?.label}</kbd>
                </span>
                <span>
                  <span className="shortcut-name">{s.label}</span>
                  {s.detail && <span className="muted shortcut-detail">{s.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="small-print muted">
            Lighting shortcuts from{' '}
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.name}
            </a>
            . The GK64 shares the SK64’s layout. If a shortcut does something else on your keyboard,{' '}
            <a href={issuesUrl} target="_blank" rel="noreferrer">
              please report it
            </a>
            .
          </p>
        </div>

        <div className="guide-about">
          <h3>How the lighting modes work</h3>
          <p>
            The keyboard plays one lighting mode at a time, by itself, with no software running. Lighting is the same on
            every layer. Its modes come in two groups:
          </p>
          <dl className="guide-groups">
            <dt>
              Custom modes 1–{maxCustomModes} <kbd>Fn</kbd> + <kbd>]</kbd>
            </dt>
            <dd>
              The modes you make here, in the order of your list. <kbd>Fn</kbd> + <kbd>]</kbd> steps to the next one and
              wraps around after the last. You can add up to {maxCustomModes}. With <b>Built-in modes</b> selected (or
              after <b>Reset keyboard</b>), this group holds the keyboard’s 5 factory modes instead. Applying either
              replaces what was here before, including modes set in Skyloong’s own software.
            </dd>
            <dt>
              Built-in modes 1–4 <kbd>Fn</kbd> + <kbd>[</kbd>
            </dt>
            <dd>
              Four factory modes that can’t be changed. Some light up keys as you type, and Skyloong says the
              music-reactive one is the fourth.
            </dd>
          </dl>
          <p>
            Brightness, speed and pause work on whichever mode is playing. Skyloong’s chart numbers these groups
            differently, as modes 1–5 and 6–9.
          </p>
          <p className="muted">
            Skyloong doesn’t publish what each built-in mode looks like, and the keyboard doesn’t report it, so they
            aren’t named here yet. If you cycle through them, you can{' '}
            <a href={issuesUrl} target="_blank" rel="noreferrer">
              tell us what each one does
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

/** A number in a hexagon, the way Skyloong's manual marks the layers. */
export function Hexagon({ n }: { n: number }) {
  return (
    <svg className="hexagon" viewBox="0 0 20 22" role="img" aria-label={`Mode ${n}`}>
      <path d="M10 1.5 18.5 6.25v9.5L10 20.5 1.5 15.75v-9.5z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x="10" y="11" textAnchor="middle" dominantBaseline="central" fill="currentColor">
        {n}
      </text>
    </svg>
  )
}
