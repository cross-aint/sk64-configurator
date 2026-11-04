import { useMemo, useState } from 'react'
import './App.css'
import { ChangesBar, type ApplyState } from './components/ChangesBar'
import { ConnectionBar } from './components/ConnectionBar'
import { DeviceInfo } from './components/DeviceInfo'
import { EffectList } from './components/EffectList'
import { EffectSettings } from './components/EffectSettings'
import { HardwareTests } from './components/HardwareTests'
import { KeyPressTestPanel } from './components/KeyPressTestPanel'
import { MacroLimitTestPanel } from './components/MacroLimitTestPanel'
import { buildMacroLimitTest, MACRO_RECORD_BYTES, macroLimitRows } from './keyboard/macroLimitTest'
import { MacroEditor } from './components/MacroEditor'
import { ChangeSheetDialog } from './components/ChangeSheetDialog'
import { buildChangeSheet } from './keyboard/changeSheet'
import { useMacros } from './hooks/useMacros'
import {
  describeWithMacros,
  keymapsWithoutMacro,
  keysUsingMacro,
  macroActions,
  toFirmwareMacro,
  type MacroDef,
} from './keyboard/macroLibrary'
import { ImageOverlay } from './components/ImageOverlay'
import { ImageToolbar, type ImageView } from './components/ImageToolbar'
import { KeyboardView, type KeyCap } from './components/KeyboardView'
import { LayerTabs } from './components/LayerTabs'
import { BoardLayerTabs } from './components/BoardLayerTabs'
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

import { defaultFunction, defaultValue } from './keyboard/defaults'
import { encodeEffects, MAX_EFFECTS } from './keyboard/effects'
import { coverTransform, sampleKeyColors } from './keyboard/imageSampling'
import {
  BOARD_LAYERS,
  boardLayerInfo,
  changedBoardLayers,
  EMPTY_KEYMAPS,
  FNX_KEY,
  hasFnxKey,
  toSlotTable,
  type BoardLayer,
  type Keymap,
  type Keymaps,
  type LayerName,
} from './keyboard/keymap'
import { SK64_LAYOUT, type KeyDef } from './keyboard/layout'
import { baseColors, BUILTIN_LIGHTING, toKeyPressTable, toLightingBlock, type Lighting } from './keyboard/lighting'
import { MAX_MODES, paintingsOf, slotToEffect, type EffectKind } from './keyboard/presets'
import { buildKeyPressTest } from './keyboard/keyPressTest'
import { encodeMacros } from './keyboard/macros'
import { buildLimitTest, describeReplies, keyForCount } from './keyboard/limitTest'
import { exportProfile, importProfile } from './keyboard/profile'
import { reactionEffects } from './keyboard/reactions'
import { LIGHTING_SHORTCUTS, SHORTCUT_SOURCE } from './keyboard/shortcuts'

const layout = SK64_LAYOUT
const ISSUES_URL = 'https://github.com/4Redcross/sk64-configurator/issues'

type Mode = 'keys' | 'lighting' | 'macros'

export default function App() {
  const { status, log, connect, disconnect, readInfo, writeLayer, writeBaseLayer } = useKeyboardConnection()
  const keymap = useKeymap()
  const lighting = useLighting(layout)
  const macros = useMacros()
  const [showSheet, setShowSheet] = useState(false)
  const sheet = useMemo(
    () => (showSheet ? buildChangeSheet(layout, keymap.draft, macros.draft) : null),
    [showSheet, keymap.draft, macros.draft],
  )
  const palette = usePalette()
  const [mode, setMode] = useState<Mode>('keys')
  const [layer, setLayer] = useState<LayerName>('normal')
  /** Which keyboard layer the Keys view shows and edits. */
  const [board, setBoard] = useState<BoardLayer>('base')
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
  const [macroLimitResult, setMacroLimitResult] = useState<string | null>(null)
  /** The macro limit test is on the Windows layer; Undo, Apply or Reset puts the user's back. */
  const [macroLimitDirty, setMacroLimitDirtyState] = useState(() => readFlag(MACRO_LIMIT_FLAG))
  const setMacroLimitDirty = (dirty: boolean) => {
    setMacroLimitDirtyState(dirty)
    writeFlag(MACRO_LIMIT_FLAG, dirty)
  }

  const boardKeys = keymap.draft[board]
  const caps = useMemo(() => buildCaps(boardKeys, layer, board, macros.draft), [boardKeys, layer, board, macros.draft])
  const pickerMacros = useMemo(() => macroActions(macros.draft), [macros.draft])
  const macroIndex = macros.selected ? macros.draft.findIndex((m) => m.id === macros.selected?.id) : -1
  const macroLinks = useMemo(
    () =>
      macroIndex < 0
        ? []
        : keysUsingMacro(keymap.draft, macroIndex).map(({ board: b, keyId, fn }) => {
            const k = layout.keys.find((key) => key.id === keyId)
            return `${b} · ${fn ? 'Fn + ' : ''}${k?.label || k?.name || keyId}`
          }),
    [keymap.draft, macroIndex],
  )
  const removeMacro = (id: string) => {
    const i = macros.draft.findIndex((m) => m.id === id)
    if (i < 0) return
    keymap.replaceDraft(keymapsWithoutMacro(keymap.draft, i))
    macros.remove(id)
  }
  const noFnxKey = board === 'fnx' && !hasFnxKey(keymap.draft.windows) && !hasFnxKey(keymap.draft.mac)
  const counts = { normal: Object.keys(boardKeys.normal).length, fn: Object.keys(boardKeys.fn).length }
  const boardCounts = Object.fromEntries(
    BOARD_LAYERS.map((l) => [l.id, Object.keys(keymap.draft[l.id].normal).length + Object.keys(keymap.draft[l.id].fn).length]),
  ) as Record<BoardLayer, number>
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

  const pending = describePending(keymap.pendingCount, lighting.changed, macros.changed, macroLimitDirty)

  const blockedReason =
    status.kind !== 'connected'
      ? 'Connect your keyboard to apply.'
      : !status.info.knownModel
        ? "Writing is only enabled for confirmed SK64 models, and this one isn't confirmed yet."
        : null

  /**
   * Writes the given parts to the keyboard and records them as applied: the on-board layers' keys
   * first, then the base layer with lighting. Afterwards the keyboard is put on `finishOn`.
   */
  const write = async (
    target: {
      keys?: Partial<Keymaps>
      lighting?: Lighting
      /** The macro list for the Windows, macOS and FNX layers (empty clears them). */
      macros?: MacroDef[]
      clearMacros?: boolean
      finishOn?: BoardLayer
    },
    doneMessage: string,
  ) => {
    if (status.kind !== 'connected') return
    const slots = status.info.bufferSizeA * status.info.bufferSizeB
    const tables = (k: Keymap) => ({ normal: toSlotTable(layout, k.normal, slots), fn: toSlotTable(layout, k.fn, slots) })
    // The FNX layer only works while an FNX key is held, so stay on a layer that has one.
    const fnxHome: BoardLayer = hasFnxKey(keymap.draft.windows) || !hasFnxKey(keymap.draft.mac) ? 'windows' : 'mac'
    const finishOn = target.finishOn ?? (board === 'fnx' ? fnxHome : board)
    try {
      const empty = target.macros?.find((m) => m.steps.length === 0)
      if (empty) throw new Error(`Macro “${empty.name}” has no steps yet: add some, or remove it.`)
      const macroBlock =
        target.macros !== undefined
          ? target.macros.length
            ? encodeMacros(target.macros.map(toFirmwareMacro))
            : null
          : target.clearMacros
            ? null
            : undefined
      setApplyState({ kind: 'writing', step: 'Starting…' })
      const keys: Partial<Record<BoardLayer, Keymap>> = { ...target.keys }

      for (const info of BOARD_LAYERS) {
        if (info.id === 'base') continue
        const k = keys[info.id]
        if (!k && macroBlock === undefined) continue
        await writeLayer(
          info.firmware,
          { keys: k ? tables(k) : undefined, macros: macroBlock },
          (step) => setApplyState({ kind: 'writing', step: `${info.name} layer: ${step}` }),
        )
      }

      const changes: BaseLayerWrite = {}
      if (keys.base) changes.keys = tables(keys.base)
      if (target.lighting) changes.lighting = toLightingBlock(layout, target.lighting)
      // Key reactions go with the lighting; otherwise clear links left by the key-press test.
      if (target.lighting) changes.keyPress = toKeyPressTable(layout, target.lighting, slots)
      else if (keyPressDirty) changes.keyPress = null
      if (Object.keys(changes).length > 0 || finishOn === 'base') {
        await writeBaseLayer(changes, (step) => setApplyState({ kind: 'writing', step: `Base layer: ${step}` }))
      }
      // Writing selects each layer in turn; end on the one asked for.
      if (finishOn !== 'base') {
        await writeLayer(boardLayerInfo(finishOn).firmware, {}, (step) => setApplyState({ kind: 'writing', step }))
      }

      if (changes.keyPress !== undefined && keyPressDirty) setKeyPressDirty(false)
      if (target.keys) keymap.markApplied(target.keys)
      if (target.lighting) lighting.markApplied(target.lighting)
      if (target.macros) macros.markApplied(target.macros)
      // The macro limit test is gone once the Windows layer's keys and macros are rewritten.
      if (macroLimitDirty && target.keys?.windows && target.macros !== undefined) setMacroLimitDirty(false)
      const where = finishOn === 'base' ? '' : ` The keyboard is now on the ${boardLayerInfo(finishOn).name} layer.`
      setApplyState({ kind: 'done', message: doneMessage + where })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      setApplyState({
        kind: 'error',
        message: `Writing failed: ${reason} The keyboard may be partly updated, so click Apply again.`,
      })
    }
  }

  const apply = () => {
    const changed = changedBoardLayers(keymap.draft, keymap.applied)
    // The macro limit test replaced the Windows layer's keys and every macro; put them back too.
    if (macroLimitDirty && !changed.includes('windows')) changed.push('windows')
    return write(
      {
        keys: changed.length ? Object.fromEntries(changed.map((id) => [id, keymap.draft[id]])) : undefined,
        lighting: lighting.changed ? lighting.draft : undefined,
        macros: macros.changed || macroLimitDirty ? macros.draft : undefined,
      },
      'Saved to the keyboard.',
    )
  }

  const resetKeyboard = async () => {
    await write(
      { keys: EMPTY_KEYMAPS, lighting: BUILTIN_LIGHTING, macros: [], clearMacros: true, finishOn: 'base' },
      'Keyboard restored to factory defaults.',
    )
    keymap.replaceDraft(EMPTY_KEYMAPS)
    lighting.replaceDraft(BUILTIN_LIGHTING)
    macros.replaceDraft([])
  }

  const discard = () => {
    keymap.discard()
    lighting.discard()
    macros.discard()
  }

  const exportFile = () => {
    const text = exportProfile(layout, {
      name: 'My SK64 profile',
      keymaps: keymap.draft,
      lighting: lighting.draft,
      macros: macros.draft,
    })
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
      keymap.replaceDraft(profile.keymaps)
      lighting.replaceDraft(profile.lighting)
      macros.replaceDraft(profile.macros)
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

  // Hardware test: how many macros the keyboard keeps (one per key, on the Windows layer).
  const macroLimit = useMemo(() => buildMacroLimitTest(layout), [])
  const runMacroLimitTest = async () => {
    if (status.kind !== 'connected') return
    const slots = status.info.bufferSizeA * status.info.bufferSizeB
    try {
      setMacroLimitResult(null)
      setApplyState({ kind: 'writing', step: 'Starting…' })
      setMacroLimitDirty(true) // set first: a partial write also needs undoing
      const { macroReplies } = await writeLayer(
        boardLayerInfo('windows').firmware,
        { macros: macroLimit.block, keys: { normal: toSlotTable(layout, macroLimit.keys, slots) } },
        (step) => setApplyState({ kind: 'writing', step }),
      )
      const firstOdd = macroReplies.findIndex((s) => s !== macroReplies[0])
      const where =
        firstOdd > 0 ? ` That change came in macro ${Math.floor((firstOdd * 56) / MACRO_RECORD_BYTES) + 1}.` : ''
      setMacroLimitResult(
        `Wrote ${(macroLimit.block.length / 1024).toFixed(1)} KB. ${describeReplies(macroReplies, 56, 'macro packets')}${where}`,
      )
      setApplyState({
        kind: 'done',
        message: `${macroLimit.count} test macros written; the keyboard is on the Windows layer. Press keys in the test box.`,
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      setApplyState({ kind: 'error', message: `Writing the test failed: ${reason}` })
      setMacroLimitResult(`The write stopped with an error: ${reason}`)
    }
  }

  const undoMacroLimitTest = async () => {
    if (status.kind !== 'connected') return
    const slots = status.info.bufferSizeA * status.info.bufferSizeB
    const onStep = (step: string) => setApplyState({ kind: 'writing', step })
    try {
      setApplyState({ kind: 'writing', step: 'Starting…' })
      const own = macros.applied
      await writeLayer(
        boardLayerInfo('windows').firmware,
        {
          macros: own.length ? encodeMacros(own.map(toFirmwareMacro)) : null,
          keys: { normal: toSlotTable(layout, keymap.applied.windows.normal, slots) },
        },
        onStep,
      )
      await writeBaseLayer({}, onStep) // back to the base layer
      setMacroLimitDirty(false)
      setApplyState({ kind: 'done', message: 'Macro test removed. Your macros and Windows-layer keys are back.' })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      setApplyState({ kind: 'error', message: `Removing the macro test failed: ${reason}` })
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

  const selectedOverride = selected ? (boardKeys[layer][selected.id] ?? null) : null

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
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'macros'}
                  onClick={() => {
                    setMode('macros')
                    setTesting(false)
                  }}
                >
                  Macros
                  {macros.draft.length > 0 && <span className="count">{macros.draft.length}</span>}
                </button>
              </div>
              {mode === 'keys' && <BoardLayerTabs board={board} onChange={setBoard} counts={boardCounts} />}
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
          {mode === 'macros' && (
            <MacroEditor
              layout={layout}
              macros={macros.draft}
              selected={macros.selected}
              full={macros.full}
              links={macroLinks}
              onSelect={macros.select}
              onAdd={() => macros.add()}
              onUpdate={macros.update}
              onRemove={removeMacro}
            />
          )}
          {mode !== 'macros' && (
            <>
              <p className="muted hint">
                {placing
                  ? imageView === 'picture'
                    ? 'Drag to move the picture, scroll or pinch to zoom, Shift + scroll to rotate. Each key takes the average color inside its outline; keys outside the picture turn off.'
                    : 'This is how the keys will light up. Switch back to Picture to adjust, or click Use these colors.'
                  : reaction
                    ? `Preview of the reaction${reaction.keys.length ? '' : ' (on G until you choose keys)'}. Click keys to choose which ones trigger it.`
                    : hintText(mode, board, layer, testing, lighting.draft, tool, slot?.kind ?? null, noFnxKey)}
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
            </>
          )}
          <ChangesBar
            pending={pending}
            blockedReason={blockedReason}
            applyState={applyState}
            onApply={apply}
            onDiscard={discard}
            onResetKeyboard={resetKeyboard}
            onExport={exportFile}
            onImport={importFile}
            onPicture={() => setShowSheet(true)}
          />
          {sheet && <ChangeSheetDialog layout={layout} sheet={sheet} onClose={() => setShowSheet(false)} />}
        </section>

        {mode === 'keys' ? (
          <div className="columns">
            <section className="card">
              <h2>Selected key</h2>
              {selected ? (
                <RemapPanel
                  key={selected.id + board + layer}
                  keyDef={selected}
                  boardName={boardLayerInfo(board).name}
                  layer={layer}
                  override={selectedOverride}
                  defaultValue={defaultValue(selected, layer === 'fn', board)}
                  defaultName={defaultFunction(selected, layer === 'fn', board)?.name ?? null}
                  unavailable={(action) =>
                    action.value === FNX_KEY && !boardLayerInfo(board).fnxKeys
                      ? 'FNX keys go on the Windows or macOS layer'
                      : action.group === 'Macros' && !boardLayerInfo(board).macros
                        ? 'The base layer can’t run macros: use the Windows, macOS or FNX layer'
                        : null
                  }
                  extraActions={pickerMacros}
                  describeValue={(value) => describeWithMacros(value, macros.draft)}
                  locked={selected.id === layout.fnKeyId}
                  onChange={(value) => keymap.setKey(board, layer, selected.id, value)}
                />
              ) : (
                <p className="muted">Click a key on the keyboard to change what it does.</p>
              )}
            </section>
            {deviceCard}
          </div>
        ) : mode === 'macros' ? (
          deviceCard
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
          <MacroLimitTestPanel
            count={macroLimit.count}
            rows={macroLimitRows(layout)}
            blockedReason={blockedReason}
            busy={applyState.kind === 'writing'}
            active={macroLimitDirty}
            result={macroLimitResult}
            issuesUrl={ISSUES_URL}
            onRun={runMacroLimitTest}
            onUndo={undoMacroLimitTest}
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
const MACRO_LIMIT_FLAG = 'sk64.macrolimit.dirty.v1'
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

function describePending(
  keyChanges: number,
  lightingChanged: boolean,
  macrosChanged: boolean,
  macroLimitTest: boolean,
): string | null {
  const parts: string[] = []
  // The macro limit test replaced the Windows layer's keys and the macros; Apply puts them back.
  if (macroLimitTest) parts.push('your Windows-layer keys and macros (replaced by the macro test)')
  if (keyChanges > 0) parts.push(`${keyChanges} key ${keyChanges === 1 ? 'change' : 'changes'}`)
  if (lightingChanged) parts.push('new lighting')
  if (macrosChanged) parts.push('macro changes')
  return parts.length ? parts.slice(0, -1).join(', ') + (parts.length > 1 ? ' and ' : '') + parts.at(-1) : null
}

function hintText(
  mode: Mode,
  board: BoardLayer,
  layer: LayerName,
  testing: boolean,
  lighting: Lighting,
  tool: PaintTool,
  slotKind: EffectKind | null,
  noFnxKey: boolean,
): string {
  if (mode === 'lighting') {
    if (lighting.kind !== 'custom') {
      return 'The keyboard is playing its own lighting modes (see below for what they are and how to switch them). Choose Custom modes to make your own. Lighting is shared by all keyboard layers.'
    }
    if (!slotKind) return 'Add a mode to get started. With no custom modes, the keyboard goes back to its built-in ones.'
    if (slotKind !== 'paint') {
      return 'Preview of the selected mode. After applying, press Fn + ] on the keyboard to step through your modes (on any keyboard layer).'
    }
    if (tool === 'pick') return 'Click a key to use its color.'
    if (tool === 'erase') return 'Click or drag across keys to turn their lights off.'
    return 'Pick a color, then click or drag across keys to paint them.'
  }
  if (testing) return 'Press each key on your SK64 to light it up here. To test Fn, hold it and press 1. Fn on its own doesn’t send anything to the computer.'
  const info = boardLayerInfo(board)
  if (board === 'fnx') {
    const start = noFnxKey
      ? 'No key holds the FNX layer yet: on the Windows or macOS tab, set a key to “FNX key” (under Special). '
      : 'The FNX layer is active while you hold an FNX key on the Windows or macOS layer. '
    return (
      start +
      (layer === 'normal'
        ? 'Click a key to set what FNX + that key does. Grey keys keep their built-in function, which isn’t documented.'
        : 'What keys do while both FNX and Fn are held. Grey keys keep their built-in function, which isn’t documented.')
    )
  }
  const where = board === 'base' ? '' : ` on the ${info.name} layer (${info.reach} on the keyboard)`
  return layer === 'normal'
    ? `Click a key to change what it does${where}.`
    : `What keys do while Fn is held${where}. Grey keys keep the function built into the keyboard.`
}

/** Keycap legends for the given layer: printed labels, remapped functions, locked Fn. */
function buildCaps(map: Keymap, layer: LayerName, board: BoardLayer, macros: readonly MacroDef[]): Record<string, KeyCap> {
  const caps: Record<string, KeyCap> = {}
  for (const key of layout.keys) {
    if (key.id === layout.fnKeyId) {
      caps[key.id] = { label: key.label, locked: true, description: "Fn can't be remapped" }
      continue
    }
    const override = map[layer][key.id]
    if (override !== undefined) {
      const d = describeWithMacros(override, macros)
      caps[key.id] = { label: d.cap, description: d.name, remapped: true }
      continue
    }
    const def = defaultFunction(key, layer === 'fn', board)
    if (layer === 'normal' && board !== 'fnx') {
      // Printed label, unless this layer's default differs (e.g. Option on the macOS layer's Win key).
      const plain = defaultValue(key, false)
      caps[key.id] = def && def.value !== plain ? { label: def.cap, description: def.name } : { label: key.label }
    } else if (def) caps[key.id] = { label: def.cap, description: def.name }
    else {
      const description = board === 'fnx' ? 'Built-in FNX function (not documented)' : 'Built-in Fn function'
      caps[key.id] = { label: key.label, unknown: true, description }
    }
  }
  return caps
}
