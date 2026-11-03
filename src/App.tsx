import { useMemo, useState } from 'react'
import './App.css'
import { ChangesBar, type ApplyState } from './components/ChangesBar'
import { ConnectionBar } from './components/ConnectionBar'
import { DeviceInfo } from './components/DeviceInfo'
import { KeyboardView, type KeyCap } from './components/KeyboardView'
import { LayerTabs } from './components/LayerTabs'
import { PacketLog } from './components/PacketLog'
import { RemapPanel } from './components/RemapPanel'
import { useKeyboardConnection } from './hooks/useKeyboardConnection'
import { useKeymap } from './hooks/useKeymap'
import { useKeyTester } from './hooks/useKeyTester'
import { describe } from './keyboard/actions'
import { defaultValue } from './keyboard/defaults'
import { EMPTY_KEYMAP, exportProfile, importProfile, toSlotTable, type Keymap, type LayerName } from './keyboard/keymap'
import { SK64_LAYOUT, type KeyDef } from './keyboard/layout'

const layout = SK64_LAYOUT

export default function App() {
  const { status, log, connect, disconnect, readInfo, writeBaseLayer } = useKeyboardConnection()
  const keymap = useKeymap()
  const [layer, setLayer] = useState<LayerName>('normal')
  const [selected, setSelected] = useState<KeyDef | null>(null)
  const [testing, setTesting] = useState(false)
  const [applyState, setApplyState] = useState<ApplyState>({ kind: 'idle' })
  const tester = useKeyTester(layout, testing)

  const caps = useMemo(() => buildCaps(keymap.draft, layer), [keymap.draft, layer])
  const counts = { normal: Object.keys(keymap.draft.normal).length, fn: Object.keys(keymap.draft.fn).length }

  const blockedReason =
    status.kind !== 'connected'
      ? 'Connect your keyboard to apply.'
      : !status.info.knownModel
        ? "Writing is only enabled for confirmed SK64 models, and this one isn't confirmed yet."
        : null

  const write = async (target: Keymap, doneMessage: string) => {
    if (status.kind !== 'connected') return
    const slots = status.info.bufferSizeA * status.info.bufferSizeB
    try {
      const tables = { normal: toSlotTable(layout, target.normal, slots), fn: toSlotTable(layout, target.fn, slots) }
      setApplyState({ kind: 'writing', step: 'Starting…' })
      await writeBaseLayer(tables, (step) => setApplyState({ kind: 'writing', step }))
      keymap.markApplied(target)
      setApplyState({ kind: 'done', message: doneMessage })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      setApplyState({
        kind: 'error',
        message: `Writing failed: ${reason} The keyboard may be partly updated, so click Apply again.`,
      })
    }
  }

  const apply = () => write(keymap.draft, 'Saved to the keyboard.')

  const resetKeyboard = async () => {
    await write(EMPTY_KEYMAP, 'Keyboard restored to factory defaults.')
    keymap.replaceDraft(EMPTY_KEYMAP)
  }

  const exportFile = () => {
    const blob = new Blob([exportProfile(layout, keymap.draft, 'My SK64 profile')], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sk64-profile.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importFile = (text: string) => {
    try {
      const { name, keymap: imported } = importProfile(layout, text)
      keymap.replaceDraft(imported)
      setApplyState({ kind: 'done', message: `Loaded "${name}". Review it, then click Apply.` })
    } catch (err) {
      setApplyState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const selectedOverride = selected ? (keymap.draft[layer][selected.id] ?? null) : null

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>SK64 Configurator</h1>
          <span className="tag">Unofficial</span>
        </div>
        <ConnectionBar status={status} onConnect={connect} onDisconnect={disconnect} />
      </header>

      <main className="app-main">
        {status.kind === 'unsupported' && (
          <div className="notice" data-tone="bad">
            <b>This browser can't talk to USB keyboards.</b> Open this page in desktop Chrome or Edge.
          </div>
        )}
        {status.kind === 'disconnected' && (
          <div className="notice">
            Close the official Skyloong software, then click <b>Connect</b> and pick your keyboard. You can plan
            changes and test keys without connecting.
          </div>
        )}
        {status.kind === 'working' && <div className="notice">{status.message}</div>}
        {status.kind === 'error' && (
          <div className="notice" data-tone="bad">
            <b>Something went wrong.</b> {status.message} The packet log at the bottom shows what was sent and received.
          </div>
        )}

        <section className="card">
          <div className="card-head">
            <div className="card-title-row">
              <h2>Keyboard</h2>
              <LayerTabs layer={layer} onChange={setLayer} counts={counts} />
            </div>
            <div className="toolbar">
              {testing && (
                <>
                  <span className="muted test-count">
                    {tester.tested.size} / {tester.testableCount} keys pressed
                  </span>
                  <button className="secondary small" onClick={tester.reset}>Reset</button>
                </>
              )}
              <button
                className={testing ? 'small' : 'secondary small'}
                aria-pressed={testing}
                onClick={() => setTesting((t) => !t)}
              >
                {testing ? 'Stop key test' : 'Test keys'}
              </button>
            </div>
          </div>
          {testing ? (
            <p className="muted hint">
              Press each key on your SK64 to light it up here. To test <b>Fn</b>, hold it and press <b>1</b>.
              Fn on its own doesn't send anything to the computer.
            </p>
          ) : (
            <p className="muted hint">
              {layer === 'normal'
                ? 'Click a key to change what it does.'
                : 'What keys do while Fn is held. Grey keys keep the function built into the keyboard.'}
            </p>
          )}
          <KeyboardView
            layout={layout}
            caps={caps}
            selectedId={selected?.id}
            heldIds={testing ? tester.held : undefined}
            testedIds={testing ? tester.tested : undefined}
            onSelect={(key) => setSelected((cur) => (cur?.id === key.id ? null : key))}
          />
          <ChangesBar
            pendingCount={keymap.pendingCount}
            blockedReason={blockedReason}
            applyState={applyState}
            onApply={apply}
            onDiscard={keymap.discard}
            onResetKeyboard={resetKeyboard}
            onExport={exportFile}
            onImport={importFile}
          />
        </section>

        <div className="columns">
          <section className="card">
            <h2>Selected key</h2>
            {selected ? (
              <RemapPanel
                key={selected.id + layer}
                keyDef={selected}
                layer={layer}
                override={selectedOverride}
                defaultValue={defaultValue(selected, layer === 'fn')}
                locked={selected.id === layout.fnKeyId}
                onChange={(value) => keymap.setKey(layer, selected.id, value)}
              />
            ) : (
              <p className="muted">Click a key on the keyboard to change what it does.</p>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Device</h2>
              {status.kind === 'connected' && (
                <button className="secondary small" onClick={readInfo}>Read again</button>
              )}
            </div>
            {status.kind === 'connected' ? (
              <DeviceInfo info={status.info} />
            ) : (
              <p className="muted">Connect to see your keyboard's model and firmware.</p>
            )}
          </section>
        </div>

        <details className="card developer">
          <summary>Packet log (for troubleshooting)</summary>
          <PacketLog log={log} />
        </details>
      </main>
    </div>
  )
}

/** Keycap legends for the given layer: printed labels, remapped functions, locked Fn. */
function buildCaps(map: Keymap, layer: LayerName): Record<string, KeyCap> {
  const caps: Record<string, KeyCap> = {}
  for (const key of layout.keys) {
    if (key.id === layout.fnKeyId) {
      caps[key.id] = { label: key.label, locked: true, description: "Fn can't be remapped" }
      continue
    }
    const override = map[layer][key.id]
    if (override !== undefined) {
      const d = describe(override)
      caps[key.id] = { label: d.cap, description: d.name, remapped: true }
      continue
    }
    const def = defaultValue(key, layer === 'fn')
    if (layer === 'normal') caps[key.id] = { label: key.label }
    else if (def !== null) caps[key.id] = { label: describe(def).cap, description: describe(def).name }
    else caps[key.id] = { label: key.label, unknown: true, description: 'Built-in Fn function' }
  }
  return caps
}
