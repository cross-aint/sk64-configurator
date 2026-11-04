import { defaultFunction } from './defaults'
import { BOARD_LAYERS, type BoardLayer, type Keymaps, type LayerName } from './keymap'
import type { KeyboardLayout } from './layout'
import { charFor, describeWithMacros, inputLabel, keysUsingMacro, type MacroDef } from './macroLibrary'
import { MOD, type MacroStep } from './macros'

// What goes in the picture of a setup: every remapped key, layer by layer, and every macro.
// Lighting isn't included. Drawing it is up to the UI (see components/changeSheetImage.ts).

export type SheetKey = {
  id: string
  /** The key's printed name, e.g. "Caps". */
  keyName: string
  /** Short text for the keycap, e.g. "Ctrl" or "M1". */
  cap: string
  /** What it does now, e.g. "Left Ctrl" or "Macro: Greeting". */
  name: string
  /** What it did before, e.g. "Caps Lock", or null when that isn't known (most of the FNX layer). */
  was: string | null
}

export type SheetSection = {
  board: BoardLayer
  table: LayerName
  /** e.g. "Windows layer", "Windows layer · Fn held". */
  title: string
  /** How to reach it, e.g. "Switch to it with Fn + W". */
  reach: string
  changes: SheetKey[]
}

export type SheetMacro = {
  number: number
  name: string
  /** e.g. "plays once", "repeats while held". */
  plays: string
  /** Keys that run it, e.g. "Windows · Menu". */
  keys: string[]
  /** Readable steps, e.g. `"Hi!", Ctrl+C, wait 200 ms`. */
  steps: string
}

export type ChangeSheet = { sections: SheetSection[]; macros: SheetMacro[] }

/** Pauses shorter than this are left out of step summaries. */
const SHOWN_PAUSE_MS = 100
/** Key presses held at least this long are shown as held (shorter ones are just typing). */
const SHOWN_HOLD_MS = 500

export function buildChangeSheet(layout: KeyboardLayout, keymaps: Keymaps, macros: readonly MacroDef[]): ChangeSheet {
  const sections: SheetSection[] = []
  for (const info of BOARD_LAYERS) {
    for (const table of ['normal', 'fn'] as const) {
      const overrides = keymaps[info.id][table]
      const changes = layout.keys
        .filter((k) => overrides[k.id] !== undefined)
        .map((k): SheetKey => {
          const now = describeWithMacros(overrides[k.id], macros)
          const before = defaultFunction(k, table === 'fn', info.id)
          return {
            id: k.id,
            keyName: k.label || k.name,
            cap: now.cap,
            name: now.name,
            was: before?.name ?? (table === 'normal' && info.id !== 'fnx' ? k.name : null),
          }
        })
      if (changes.length === 0) continue
      const held = table === 'fn' ? (info.id === 'fnx' ? ' · FNX + Fn held' : ' · Fn held') : ''
      sections.push({
        board: info.id,
        table,
        title: `${info.name} layer${held}`,
        reach: info.reach[0].toUpperCase() + info.reach.slice(1),
        changes,
      })
    }
  }

  const sheetMacros = macros.map((m, i): SheetMacro => ({
    number: i + 1,
    name: m.name,
    plays:
      m.repeat === 'whileHeld'
        ? 'repeats while held'
        : m.repeat === 'toggle'
          ? 'repeats until pressed again'
          : m.count === 1
            ? 'plays once'
            : `plays ${m.count} times`,
    keys: keysUsingMacro(keymaps, i).map(({ board, keyId, fn }) => {
      const k = layout.keys.find((key) => key.id === keyId)
      return `${board} · ${fn ? 'Fn + ' : ''}${k?.label || k?.name || keyId}`
    }),
    steps: summarizeSteps(m.steps),
  }))

  return { sections, macros: sheetMacros }
}

const MOD_NAMES: [bits: number, name: string][] = [
  [MOD.LCtrl | MOD.RCtrl, 'Ctrl'],
  [MOD.LShift | MOD.RShift, 'Shift'],
  [MOD.LAlt | MOD.RAlt, 'Alt'],
  [MOD.LWin | MOD.RWin, 'Win'],
]
const SHIFT = MOD.LShift | MOD.RShift
const isMod = (s: MacroStep) => s.input.kind === 'key' && s.input.code === 0
const modPrefix = (mods: number) =>
  MOD_NAMES.filter(([bits]) => mods & bits)
    .map(([, name]) => `${name}+`)
    .join('')

/**
 * Steps as a short readable line: runs of typed characters become "text", other presses become
 * key names with their modifiers (Ctrl+C), pauses of 100 ms or more are shown, and so are
 * non-text keys held half a second or more.
 */
export function summarizeSteps(steps: readonly MacroStep[]): string {
  const parts: string[] = []
  let text = ''
  const flushText = () => {
    if (text) parts.push(`"${text}"`)
    text = ''
  }
  const push = (part: string) => {
    flushText()
    parts.push(part)
  }
  let mods = 0 // modifiers held right now
  let usedMods = 0 // held modifiers that went with a key press (so their release says nothing)

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const label = inputLabel(step.input).cap
    if (isMod(step) && step.input.kind === 'key') {
      const bit = step.input.mods
      if (step.down) mods |= bit
      else {
        // A modifier pressed and released on its own is a tap.
        if (!(usedMods & bit)) push(inputLabel(step.input).cap)
        mods &= ~bit
        usedMods &= ~bit
      }
    } else {
      const next = steps[i + 1]
      const tapped = step.down && next && !next.down && JSON.stringify(next.input) === JSON.stringify(step.input)
      if (tapped) {
        usedMods |= mods
        const ch = step.input.kind === 'key' && !(mods & ~SHIFT) ? charFor(step.input.code, (mods & SHIFT) !== 0) : null
        if (ch !== null && ch !== '\n' && ch !== '\t') text += ch
        else push(`${modPrefix(mods)}${label}${step.delay >= SHOWN_HOLD_MS ? ` (held ${step.delay} ms)` : ''}`)
        i++ // the release
        const pause = next.delay
        if (pause >= SHOWN_PAUSE_MS) push(`wait ${pause} ms`)
        continue
      }
      usedMods |= mods
      push(`${step.down ? 'hold' : 'release'} ${modPrefix(step.down ? mods : 0)}${label}`)
    }
    if (step.delay >= SHOWN_PAUSE_MS) push(`wait ${step.delay} ms`)
  }
  flushText()
  return parts.join(', ')
}
