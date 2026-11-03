import { useMemo, useState } from 'react'
import './App.css'
import { ChangesBar, type ApplyState } from './components/ChangesBar'
import { ConnectionBar } from './components/ConnectionBar'
import { DeviceInfo } from './components/DeviceInfo'
import { EffectList } from './components/EffectList'
import { EffectSettings } from './components/EffectSettings'
import { HardwareTests } from './components/HardwareTests'
import { KeyPressTestPanel } from './components/KeyPressTestPanel'
import { ImageOverlay } from './components/ImageOverlay'
import { ImageToolbar, type ImageView } from './components/ImageToolbar'
import { KeyboardView, type KeyCap } from './components/KeyboardView'
import { LayerTabs } from './components/LayerTabs'
import { LightingGuide } from './components/LightingGuide'
import { PacketLog } from './components/PacketLog'
import { PaintToolbar, type PaintTool } from './components/PaintToolbar'
import { ReactionList } from './components/ReactionList'
import { ReactionSettings } from './components/ReactionSettings'
import { RemapPanel } from './components/RemapPanel'
import { useEffectPreview } from './hooks/useEffectPreview'
import { useImagePlacement } from './hooks/useImagePlacement'
import { useKeyboardConnection, type BaseLayerWrite } from './hooks/useKeyboardConnection'
import { useKeymap } from './hooks/useKeymap'
import { useKeyTester } from './hooks/useKeyTester'
import { useLighting } from './hooks/useLighting'
import { usePalette } from './hooks/usePalette'
import { describe } from './keyboard/actions'
import { defaultValue } from './keyboard/defaults'
import { encodeEffects, MAX_EFFECTS } from './keyboard/effects'
import { coverTransform, sampleKeyColors } from './keyboard/imageSampling'
import { EMPTY_KEYMAP, toSlotTable, type Keymap, type LayerName } from './keyboard/keymap'
import { SK64_LAYOUT, type KeyDef } from './keyboard/layout'
import { baseColors, BUILTIN_LIGHTING, toKeyPressTable, toLightingBlock, type Lighting } from './keyboard/lighting'
import { MAX_MODES, paintingsOf, slotToEffect, type EffectKind } from './keyboard/presets'
import { buildKeyPressTest } from './keyboard/keyPressTest'
import { buildLimitTest, describeReplies, keyForCount } from './keyboard/limitTest'
import { exportProfile, importProfile } from './keyboard/profile'
import { reactionEffects } from './keyboard/reactions'
import { LIGHTING_SHORTCUTS, SHORTCUT_SOURCE } from './keyboard/shortcuts'

const layout = SK64_LAYOUT
const ISSUES_URL = 'https://github.com/4Redcross/sk64-configurator/issues'

type Mode = 'keys' | 'lighting'

export default function App() {
  const { status, log, connect, disconnect, readInfo, writeBaseLayer } = useKeyboardConnection()
  const keymap = useKeymap()
  const lighting = useLighting(layout)
  const palette = usePalette()
  const [mode, setMode] = useState<Mode>('keys')
  const [layer, setLayer] = useState<LayerName>('normal')
  const [selected, setSelected] = useState<KeyDef | null>(null)
  const [testing, setTesting] = useState(false)
  const [paintColor, setPaintColor] = useState('#00c8ff')
  const [tool, setTool] = useState<PaintTool>('paint')
  const [applyState, setApplyState] = useState<ApplyState>({ kind: 'idle' })
  const tester = useKeyTester(layout, testing)
  const placement = useImagePlacement(layout)
  const [imageView, setImageView] = useState<ImageView>('picture')
  /** Id of the mode whose keys are being chosen by clicking the board (resets when another mode is selected). */
  const [choosingFor, setChoosingFor] = useState<string | null>(null)
  /** What the keyboard replied during the last mode limit test. */
  const [limitResult, setLimitResult] = useState<string | null>(null)
  const [keyPressResult, setKeyPressResult] = useState<string | null>(null)
  /** The key-press test's key links are on the keyboard; the next Apply / Reset clears them. */
  const [keyPressDirty, setKeyPressDirtyState] = useState(() => readFlag(KEY_PRESS_FLAG))
  const setKeyPressDirty = (dirty: boolean) => {
    setKeyPressDirtyState(dirty)
    writeFlag(KEY_PRESS_FLAG, dirty)
  }

  const caps = useMemo(() => buildCaps(keymap.draft, layer), [keymap.draft, layer])
  const counts = { normal: Object.keys(keymap.draft.normal).length, fn: Object.keys(keymap.draft.fn).length }
  // A picture is being positioned over the keyboard (Lighting mode only).
  const { image: placedImage, transform: imageTransform } = placement
  const placing = mode === 'lighting' && placedImage && imageTransform ? { image: placedImage, transform: imageTransform } : null
  // "Result" view: the colors the keys would get from the picture as it's placed now.
  const showResult = !!placing && imageView === 'result'
  const sampled = useMemo(
    () =>
      showResult && placedImage && imageTransform
        ? sampleKeyColors(layout, placedImage.element, placedImage.width, placedImage.height, imageTransform)
        : null,
    [showResult, placedImage, imageTransform],
  )
  // The effect being edited: painted colors are painted on the board, others play as a preview.
  const custom = lighting.draft.kind === 'custom'
  const slot = custom ? lighting.selected : null
  const paintSlot = slot?.kind === 'paint' ? slot : null
  const isPlacing = !!placing
  const paintings = useMemo(() => paintingsOf(lighting.slots), [lighting.slots])
  const reaction = custom ? lighting.selectedReaction : null
  const previewEffect = useMemo(() => {
    if (mode !== 'lighting' || isPlacing) return null
    if (reaction) {
      const [effect] = reactionEffects(layout, reaction, baseColors(lighting.draft), reaction.keys[0] ?? 'g')
      return effect
    }
    return slot && slot.kind !== 'paint' ? slotToEffect(layout, slot, paintings) : null
  }, [mode, isPlacing, reaction, slot, paintings, lighting.draft])
  const [reactionNotice, setReactionNotice] = useState<string | null>(null)
  const toggleReactionKey = (key: KeyDef) => {
    if (!reaction) return
    if (key.id === layout.fnKeyId) {
      setReactionNotice('Fn can’t trigger a reaction: the keyboard uses it for its own shortcuts.')
      return
    }
    const result = lighting.toggleReactionKey(reaction.id, key.id)
    setReactionNotice(
      result === 'full'
        ? `The keyboard’s ${MAX_EFFECTS} slots are all in use. Remove a mode or another reaction key first.`
        : null,
    )
  }
  // Between reaction runs, show mode 1 like the keyboard does (dark if mode 1 isn't painted colors).
  const reactionRest = useMemo(
    () => (reaction ? { colors: baseColors(lighting.draft) ?? {}, ticks: 12 } : null),
    [reaction, lighting.draft],
  )
  const previewColors = useEffectPreview(previewEffect, reactionRest)
  // Choosing which keys a wave / rain uses: clicking keys toggles them.
  const areaSlot = slot && (slot.kind === 'wave' || slot.kind === 'rain') && slot.keys ? slot : null
  const choosingKeys = mode === 'lighting' && !isPlacing && !!areaSlot && choosingFor === areaSlot.id
  const chosenKeys = useMemo(
    () =>
      reaction && mode === 'lighting' && !isPlacing
        ? new Set(reaction.keys)
        : choosingKeys && areaSlot?.keys
          ? new Set(areaSlot.keys)
          : undefined,
    [reaction, mode, isPlacing, choosingKeys, areaSlot],
  )
  const paintingOptions = lighting.slots.flatMap((s, i) =>
    s.kind === 'paint' ? [{ id: s.id, label: `${i + 1} · Painted colors (${Object.keys(s.colors).length} keys)` }] : [],
  )
  const toggleChosenKey = (key: KeyDef) => {
    if (!areaSlot) return
    lighting.updateSlot(areaSlot.id, (s) =>
      (s.kind === 'wave' || s.kind === 'rain') && s.keys
        ? { ...s, keys: s.keys.includes(key.id) ? s.keys.filter((k) => k !== key.id) : [...s.keys, key.id] }
        : s,
    )
  }
  // Only custom lighting is drawn; with built-in effects the board keeps its normal look.
  const lightingColors =
    sampled ?? (placing ? {} : mode === 'lighting' && custom ? (paintSlot?.colors ?? previewColors ?? {}) : undefined)

  const pending = describePending(keymap.pendingCount, lighting.changed)

  const blockedReason =
    status.kind !== 'connected'
      ? 'Connect your keyboard to apply.'
      : !status.info.knownModel
        ? "Writing is only enabled for confirmed SK64 models, and this one isn't confirmed yet."
        : null

  /** Writes the given parts to the keyboard and records them as applied. */
  const write = async (target: { keys?: Keymap; lighting?: Lighting }, doneMessage: string) => {
    if (status.kind !== 'connected') return
    const slots = status.info.bufferSizeA * status.info.bufferSizeB
    try {
      const changes: BaseLayerWrite = {}
      if (target.keys) {
        changes.keys = {
          normal: toSlotTable(layout, target.keys.normal, slots),
          fn: toSlotTable(layout, target.keys.fn, slots),
        }
      }
      if (target.lighting) changes.lighting = toLightingBlock(layout, target.lighting)
      // Key reactions go with the lighting; otherwise clear links left by the key-press test.
      if (target.lighting) changes.keyPress = toKeyPressTable(layout, target.lighting, slots)
      else if (keyPressDirty) changes.keyPress = null
      setApplyState({ kind: 'writing', step: 'Starting…' })
      await writeBaseLayer(changes, (step) => setApplyState({ kind: 'writing', step }))
      if (changes.keyPress !== undefined && keyPressDirty) setKeyPressDirty(false)
      if (target.keys) keymap.markApplied(target.keys)
      if (target.lighting) lighting.markApplied(target.lighting)
      setApplyState({ kind: 'done', message: doneMessage })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      setApplyState({
        kind: 'error',
        message: `Writing failed: ${reason} The keyboard may be partly updated, so click Apply again.`,
      })
    }
  }

  const apply = () =>
    write(
      {
        keys: keymap.pendingCount > 0 ? keymap.draft : undefined,
        lighting: lighting.changed ? lighting.draft : undefined,
      },
      'Saved to the keyboard.',
    )

  const resetKeyboard = async () => {
    await write({ keys: EMPTY_KEYMAP, lighting: BUILTIN_LIGHTING }, 'Keyboard restored to factory defaults.')
    keymap.replaceDraft(EMPTY_KEYMAP)
    lighting.replaceDraft(BUILTIN_LIGHTING)
  }

  const discard = () => {
    keymap.discard()
    lighting.discard()
  }

  const exportFile = () => {
    const text = exportProfile(layout, { name: 'My SK64 profile', keymap: keymap.draft, lighting: lighting.draft })
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'sk64-profile.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importFile = (text: string) => {
    try {
      const profile = importProfile(layout, text)
      keymap.replaceDraft(profile.keymap)
      lighting.replaceDraft(profile.lighting)
      setApplyState({ kind: 'done', message: `Loaded "${profile.name}". Review it, then click Apply.` })
    } catch (err) {
      setApplyState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const canPaint = mode === 'lighting' && !!paintSlot && !placing
  const paintKey = (key: KeyDef) => lighting.paint([key.id], tool === 'paint' ? paintColor : null)
  // Eyedropper: take a key's color (an unlit key picks the eraser), then go back to painting.
  const pickKey = (key: KeyDef) => {
    const picked = paintSlot?.colors[key.id]
    if (picked) setPaintColor(picked)
    setTool(picked ? 'paint' : 'erase')
  }

  // Hardware test: write the most modes the table allows and see how many the keyboard keeps.
  const limitTest = useMemo(() => buildLimitTest(layout, MAX_EFFECTS), [])
  // Landmarks for counting: where each keyboard row ends, plus the last test mode.
  const limitLandmarks = [
    ...layout.keys.flatMap((k, i) => (layout.keys[i + 1]?.y !== k.y && i + 1 < MAX_EFFECTS ? [i + 1] : [])),
    MAX_EFFECTS,
  ].map((n) => ({ n, key: keyForCount(layout, n) }))
  const runLimitTest = async () => {
    try {
      setLimitResult(null)
      setApplyState({ kind: 'writing', step: 'Starting…' })
      const block = encodeEffects(layout, limitTest.effects)
      const { lightingReplies } = await writeBaseLayer({ lighting: block }, (step) => setApplyState({ kind: 'writing', step }))
      lighting.markOverwritten()
      setLimitResult(`Wrote ${(block.length / 1024).toFixed(1)} KB. ${describeReplies(lightingReplies, 56)}`)
      setApplyState({ kind: 'done', message: `${MAX_EFFECTS} test modes written. Press Fn + ] to step through them.` })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      setApplyState({ kind: 'error', message: `Writing the test failed: ${reason}` })
      setLimitResult(`The write stopped with an error: ${reason}`)
    }
  }

  // Hardware test: key-press lighting (links Esc / Enter / Space / Q to test animations).
  const runKeyPressTest = async () => {
    if (status.kind !== 'connected') return
    try {
      setKeyPressResult(null)
      setApplyState({ kind: 'writing', step: 'Starting…' })
      const test = buildKeyPressTest(layout, status.info.bufferSizeA * status.info.bufferSizeB)
      const { lightingReplies, keyPressReplies } = await writeBaseLayer(
        { lighting: encodeEffects(layout, test.effects), keyPress: test.table },
        (step) => setApplyState({ kind: 'writing', step }),
      )
      lighting.markOverwritten()
      setKeyPressDirty(true)
      setKeyPressResult(
        `${describeReplies(lightingReplies, 56)} ${describeReplies(keyPressReplies, 56, 'key-press packets')}`,
      )
      setApplyState({ kind: 'done', message: 'Key-press test written. Try Esc, Enter, Space and Q.' })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      setApplyState({ kind: 'error', message: `Writing the test failed: ${reason}` })
      setKeyPressResult(`The write stopped with an error: ${reason}`)
      setKeyPressDirty(true) // it may be partly written; make the next Apply clear it
    }
  }

  const undoKeyPressTest = async () => {
    try {
      setApplyState({ kind: 'writing', step: 'Starting…' })
      await writeBaseLayer({ keyPress: null }, (step) => setApplyState({ kind: 'writing', step }))
      setKeyPressDirty(false)
      setApplyState({ kind: 'done', message: 'Key links cleared. Click Apply to put your own modes back.' })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      setApplyState({ kind: 'error', message: `Clearing the key links failed: ${reason}` })
    }
  }

  const importImage = async (file: File) => {
    try {
      await placement.open(file)
      setImageView('picture')
    } catch (err) {
      setApplyState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const confirmImage = () => {
    const { image, transform } = placement
    if (!image || !transform) return
    const colors = sampleKeyColors(layout, image.element, image.width, image.height, transform)
    lighting.setPaintColors(colors)
    placement.close()
  }

  const selectedOverride = selected ? (keymap.draft[layer][selected.id] ?? null) : null

  const deviceCard = (
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
  )

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
              <div className="segmented" role="tablist" aria-label="What to edit">
                <button type="button" role="tab" aria-selected={mode === 'keys'} onClick={() => setMode('keys')}>
                  Keys
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'lighting'}
                  onClick={() => {
                    setMode('lighting')
                    setTesting(false)
                  }}
                >
                  Lighting
                </button>
              </div>
              {mode === 'keys' && <LayerTabs layer={layer} onChange={setLayer} counts={counts} />}
              {mode === 'lighting' && (
                <div className="segmented" role="radiogroup" aria-label="Lighting">
                  <button type="button" role="radio" aria-checked={!custom} onClick={lighting.setBuiltin}>
                    Built-in modes
                  </button>
                  <button type="button" role="radio" aria-checked={custom} onClick={lighting.setCustom}>
                    Custom modes
                  </button>
                </div>
              )}
            </div>
            {mode === 'keys' && (
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
            )}
          </div>
          {placing && (
            <ImageToolbar
              name={placing.image.name}
              transform={placing.transform}
              fitScale={coverTransform(layout, placing.image.width, placing.image.height).scale}
              view={imageView}
              onViewChange={setImageView}
              onChange={placement.update}
              onFit={placement.fit}
              onCancel={placement.close}
              onConfirm={confirmImage}
            />
          )}
          {mode === 'lighting' && !placing && custom && (
            <EffectList
              layout={layout}
              slots={lighting.slots}
              selectedId={slot?.id ?? null}
              used={lighting.used}
              hasReactions={lighting.reactions.length > 0}
              onSelect={lighting.select}
              onAdd={(kind: EffectKind) => lighting.addSlot(kind)}
              onMove={lighting.moveSlot}
              onRemove={lighting.removeSlot}
            />
          )}
          {mode === 'lighting' && !placing && custom && (
            <ReactionList
              layout={layout}
              reactions={lighting.reactions}
              selectedId={reaction?.id ?? null}
              addBlocked={
                lighting.slots.length === 0
                  ? 'Add a mode first: the keyboard shows mode 1 between reactions.'
                  : lighting.used >= MAX_EFFECTS
                    ? `The keyboard’s ${MAX_EFFECTS} slots are all in use. Remove a mode or a reaction key first.`
                    : null
              }
              slotsLeft={Math.max(0, MAX_EFFECTS - lighting.used)}
              onSelect={(id) => {
                lighting.select(id)
                setReactionNotice(null)
              }}
              onAdd={lighting.addReaction}
              onRemove={lighting.removeReaction}
            />
          )}
          {mode === 'lighting' && !placing && reaction && (
            <ReactionSettings
              layout={layout}
              reaction={reaction}
              notice={reactionNotice}
              hasPaintedBase={baseColors(lighting.draft) !== null}
              onChange={(change) => lighting.updateReaction(reaction.id, change)}
            />
          )}
          {mode === 'lighting' && !placing && paintSlot && (
            <PaintToolbar
              colors={paintSlot.colors}
              keyCount={layout.keys.length}
              color={paintColor}
              tool={tool}
              palette={palette.palette}
              onColorChange={setPaintColor}
              onToolChange={setTool}
              onSwatchChange={palette.setSwatch}
              onAddCustom={palette.addCustom}
              onRestoreDefaults={palette.restoreDefaults}
              onFillAll={() => lighting.paint(layout.keys.map((k) => k.id), paintColor)}
              onClearAll={() => lighting.paint(layout.keys.map((k) => k.id), null)}
              onImportImage={importImage}
            />
          )}
          {mode === 'lighting' && !placing && slot && slot.kind !== 'paint' && (
            <EffectSettings
              layout={layout}
              slot={slot}
              paintings={paintingOptions}
              choosingKeys={choosingKeys}
              onChoosingKeysChange={(choosing) => setChoosingFor(choosing ? slot.id : null)}
              onChange={(change) => lighting.updateSlot(slot.id, change)}
            />
          )}
          <p className="muted hint">
            {placing
              ? imageView === 'picture'
                ? 'Drag to move the picture, scroll or pinch to zoom, Shift + scroll to rotate. Each key takes the average color inside its outline; keys outside the picture turn off.'
                : 'This is how the keys will light up. Switch back to Picture to adjust, or click Use these colors.'
              : reaction
                ? `Preview of the reaction${reaction.keys.length ? '' : ' (on G until you choose keys)'}. Click keys to choose which ones trigger it.`
                : hintText(mode, layer, testing, lighting.draft, tool, slot?.kind ?? null)}
          </p>
          <KeyboardView
            layout={layout}
            caps={mode === 'keys' ? caps : undefined}
            colors={lightingColors}
            selectedId={mode === 'keys' ? selected?.id : null}
            heldIds={testing ? tester.held : undefined}
            testedIds={testing ? tester.tested : undefined}
            markedIds={chosenKeys}
            onSelect={
              mode === 'keys'
                ? (key) => setSelected((cur) => (cur?.id === key.id ? null : key))
                : reaction
                  ? toggleReactionKey
                  : choosingKeys
                    ? toggleChosenKey
                  : canPaint && tool === 'pick'
                    ? pickKey
                    : undefined
            }
            onPaint={canPaint && tool !== 'pick' ? paintKey : undefined}
            overlay={
              placing && imageView === 'picture' ? (
                <ImageOverlay
                  layout={layout}
                  src={placing.image.url}
                  aspect={placing.image.height / placing.image.width}
                  transform={placing.transform}
                  onChange={placement.update}
                />
              ) : undefined
            }
          />
          <ChangesBar
            pending={pending}
            blockedReason={blockedReason}
            applyState={applyState}
            onApply={apply}
            onDiscard={discard}
            onResetKeyboard={resetKeyboard}
            onExport={exportFile}
            onImport={importFile}
          />
        </section>

        {mode === 'keys' ? (
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
            {deviceCard}
          </div>
        ) : (
          <>
            <section className="card">
              <h2>Modes and shortcuts</h2>
              <LightingGuide
                layout={layout}
                shortcuts={LIGHTING_SHORTCUTS}
                source={SHORTCUT_SOURCE}
                issuesUrl={ISSUES_URL}
                maxCustomModes={MAX_MODES}
              />
            </section>
            {deviceCard}
          </>
        )}

        <details className="card developer">
          <summary>Hardware tests (for contributors)</summary>
          <HardwareTests
            count={MAX_EFFECTS}
            landmarks={limitLandmarks}
            blockedReason={blockedReason}
            busy={applyState.kind === 'writing'}
            result={limitResult}
            issuesUrl={ISSUES_URL}
            onRun={runLimitTest}
          />
          <KeyPressTestPanel
            blockedReason={blockedReason}
            busy={applyState.kind === 'writing'}
            active={keyPressDirty}
            result={keyPressResult}
            issuesUrl={ISSUES_URL}
            onRun={runKeyPressTest}
            onUndo={undoKeyPressTest}
          />
        </details>

        <details className="card developer">
          <summary>Packet log (for troubleshooting)</summary>
          <PacketLog log={log} />
        </details>
      </main>
    </div>
  )
}

const KEY_PRESS_FLAG = 'sk64.keypress.dirty.v1'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // Storage unavailable; the flag just won't survive a reload.
  }
}

function describePending(keyChanges: number, lightingChanged: boolean): string | null {
  const parts: string[] = []
  if (keyChanges > 0) parts.push(`${keyChanges} key ${keyChanges === 1 ? 'change' : 'changes'}`)
  if (lightingChanged) parts.push('new lighting')
  return parts.length ? parts.join(' and ') : null
}

function hintText(
  mode: Mode,
  layer: LayerName,
  testing: boolean,
  lighting: Lighting,
  tool: PaintTool,
  slotKind: EffectKind | null,
): string {
  if (mode === 'lighting') {
    if (lighting.kind !== 'custom') {
      return 'The keyboard is playing its own lighting modes (see below for what they are and how to switch them). Choose Custom modes to make your own.'
    }
    if (!slotKind) return 'Add a mode to get started. With no custom modes, the keyboard goes back to its built-in ones.'
    if (slotKind !== 'paint') {
      return 'Preview of the selected mode. After applying, press Fn + ] on the keyboard to step through your modes.'
    }
    if (tool === 'pick') return 'Click a key to use its color.'
    if (tool === 'erase') return 'Click or drag across keys to turn their lights off.'
    return 'Pick a color, then click or drag across keys to paint them.'
  }
  if (testing) return 'Press each key on your SK64 to light it up here. To test Fn, hold it and press 1. Fn on its own doesn’t send anything to the computer.'
  return layer === 'normal'
    ? 'Click a key to change what it does.'
    : 'What keys do while Fn is held. Grey keys keep the function built into the keyboard.'
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
