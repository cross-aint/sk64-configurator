import { describe, isKeyValue, type Action } from './actions'
import { defaultValue } from './defaults'
import { BOARD_LAYERS, type Keymap, type Keymaps } from './keymap'
import type { KeyboardLayout } from './layout'
import {
  macroIndexOf,
  macroKeyValue,
  MAX_MACRO_STEPS,
  MAX_STEP_DELAY_MS,
  MOD,
  type Macro,
  type MacroRepeat,
  type MacroStep,
} from './macros'

// The user's macros, as the editor keeps them. One list is shared by every layer: keys on the
// Windows, macOS and FNX layers link to a macro by its position (key value 0x0A01000n), and each
// of those layers gets the whole list when it's written. The base layer can't run macros.

/**
 * Most macros the app allows. An SK64 (firmware v2.101) kept all 63 in the macro limit test, about
 * 32 KB per layer; 63 is also the most that test can check (one macro per key).
 */
export const MAX_MACROS = 63

export type MacroInput = MacroStep['input']

export type MacroDef = {
  id: string
  name: string
  /** Key / mouse button presses and releases, each followed by a delay in milliseconds. */
  steps: MacroStep[]
  repeat: MacroRepeat
  /** Times it plays per press (repeat = 'count'). */
  count: number
}

export function newMacro(id: string, number: number): MacroDef {
  return { id, name: `Macro ${number}`, steps: [], repeat: 'count', count: 1 }
}

/** What the encoder needs. A delay after the last step is kept, e.g. to space out repeats. */
export function toFirmwareMacro(def: MacroDef): Macro {
  const last = def.steps.at(-1)
  return { steps: def.steps, repeat: def.repeat, count: def.count, trailingDelay: !!last && last.delay > 0 }
}

// ---- Inputs ----

const KEY = 0x02000000
const MOUSE_VALUE = 0x01010000

/** A key or mouse button from a key value (plain keys, modifiers and mouse buttons only). */
export function inputFromValue(value: number): MacroInput | null {
  if (isKeyValue(value)) {
    const code = (value >> 8) & 0xff
    const mods = value & 0xff
    // A step is either a key or a modifier, not a combination.
    if (code && mods) return null
    if (!code && !mods) return null
    return { kind: 'key', code, mods }
  }
  if (value >>> 16 === MOUSE_VALUE >>> 16 && (value & 0xff) !== 0) return { kind: 'mouse', button: value & 0xff }
  return null
}

function valueOfInput(input: MacroInput): number {
  return input.kind === 'key' ? (KEY | (input.code << 8) | input.mods) >>> 0 : (MOUSE_VALUE | input.button) >>> 0
}

export function inputLabel(input: MacroInput): { name: string; cap: string } {
  return describe(valueOfInput(input))
}

const sameInput = (a: MacroInput, b: MacroInput) =>
  a.kind === 'key' && b.kind === 'key' ? a.code === b.code && a.mods === b.mods : a.kind === 'mouse' && b.kind === 'mouse' && a.button === b.button

/** Keys or buttons the macro presses but never releases (they'd stay held down). */
export function unreleased(steps: readonly MacroStep[]): MacroInput[] {
  const held: MacroInput[] = []
  for (const step of steps) {
    const i = held.findIndex((h) => sameInput(h, step.input))
    if (step.down && i < 0) held.push(step.input)
    if (!step.down && i >= 0) held.splice(i, 1)
  }
  return held
}

// ---- Recording ----

const hid = (code: number): MacroInput => ({ kind: 'key', code, mods: 0 })
const mod = (bit: number): MacroInput => ({ kind: 'key', code: 0, mods: bit })

/** Keys the SK64 can't produce without Fn or a remap, plus right-hand modifiers. */
const EXTRA_CODES: Record<string, MacroInput> = {
  Backquote: hid(0x35),
  Insert: hid(0x49),
  Home: hid(0x4a),
  End: hid(0x4d),
  PageUp: hid(0x4b),
  PageDown: hid(0x4e),
  PrintScreen: hid(0x46),
  ScrollLock: hid(0x47),
  Pause: hid(0x48),
  IntlBackslash: hid(0x64),
  ControlRight: mod(MOD.RCtrl),
  ShiftRight: mod(MOD.RShift),
  AltRight: mod(MOD.RAlt),
  MetaRight: mod(MOD.RWin),
}
for (let i = 1; i <= 12; i++) EXTRA_CODES[`F${i}`] = hid(0x39 + i)
for (let i = 13; i <= 24; i++) EXTRA_CODES[`F${i}`] = hid(0x5b + i)

/** The key or modifier for a browser KeyboardEvent.code, or null if a macro can't type it. */
export function inputForCode(layout: KeyboardLayout, code: string): MacroInput | null {
  const key = layout.keys.find((k) => k.code === code)
  const value = key ? defaultValue(key, false) : null
  return (value !== null ? inputFromValue(value) : null) ?? EXTRA_CODES[code] ?? null
}

// ---- Typing text ----

// US layout: character -> [HID usage, needs Shift].
const CHARS: Record<string, [number, boolean]> = { ' ': [0x2c, false], '\n': [0x28, false], '\t': [0x2b, false] }
for (let i = 0; i < 26; i++) {
  CHARS[String.fromCharCode(97 + i)] = [0x04 + i, false]
  CHARS[String.fromCharCode(65 + i)] = [0x04 + i, true]
}
'1234567890'.split('').forEach((c, i) => (CHARS[c] = [0x1e + i, false]))
'!@#$%^&*()'.split('').forEach((c, i) => (CHARS[c] = [0x1e + i, true]))
for (const [usage, plain, shifted] of [
  [0x2d, '-', '_'],
  [0x2e, '=', '+'],
  [0x2f, '[', '{'],
  [0x30, ']', '}'],
  [0x31, '\\', '|'],
  [0x33, ';', ':'],
  [0x34, "'", '"'],
  [0x35, '`', '~'],
  [0x36, ',', '<'],
  [0x37, '.', '>'],
  [0x38, '/', '?'],
] as const) {
  CHARS[plain] = [usage, false]
  CHARS[shifted] = [usage, true]
}

const CHAR_BY_KEY = new Map(Object.entries(CHARS).map(([ch, [usage, shift]]) => [`${usage}:${shift}`, ch]))

/** The character a key types (US layout), with or without Shift, or null (e.g. arrows, F-keys). */
export function charFor(usage: number, shift: boolean): string | null {
  return CHAR_BY_KEY.get(`${usage}:${shift}`) ?? null
}

/**
 * Steps that type `text` (US layout), waiting `gap` ms after each character. Shift stays held
 * across runs of capitals and symbols to save steps. Characters it can't type are returned.
 */
export function stepsForText(text: string, gap: number): { steps: MacroStep[]; skipped: string[] } {
  const steps: MacroStep[] = []
  const skipped: string[] = []
  let shift = false
  const shiftStep = (down: boolean) => steps.push({ input: mod(MOD.LShift), down, delay: 0 })
  for (const ch of text.replace(/\r\n?/g, '\n')) {
    const entry = CHARS[ch]
    if (!entry) {
      if (!skipped.includes(ch)) skipped.push(ch)
      continue
    }
    const [usage, needsShift] = entry
    if (needsShift !== shift) {
      shiftStep(needsShift)
      shift = needsShift
    }
    steps.push({ input: hid(usage), down: true, delay: 0 })
    steps.push({ input: hid(usage), down: false, delay: gap })
  }
  if (shift) shiftStep(false)
  return { steps, skipped }
}

// ---- Linking keys ----

/** Picker entries for linking a key to a macro. */
export function macroActions(macros: readonly MacroDef[]): Action[] {
  return macros.map((m, i) => ({
    value: macroKeyValue(i),
    name: m.name,
    cap: `M${i + 1}`,
    group: 'Macros',
    keywords: 'macro',
  }))
}

/** Name and keycap text for a key value, knowing the macros. */
export function describeWithMacros(value: number, macros: readonly MacroDef[]): { name: string; cap: string } {
  const index = macroIndexOf(value)
  if (index === null) return describe(value)
  const macro = macros[index]
  return { name: macro ? `Macro: ${macro.name}` : `Macro ${index + 1} (deleted)`, cap: `M${index + 1}` }
}

/** Keys (by layer) that run the macro at `index`. */
export function keysUsingMacro(keymaps: Keymaps, index: number): { board: string; keyId: string; fn: boolean }[] {
  const value = macroKeyValue(index)
  return BOARD_LAYERS.flatMap((l) =>
    (['normal', 'fn'] as const).flatMap((table) =>
      Object.entries(keymaps[l.id][table])
        .filter(([, v]) => v === value)
        .map(([keyId]) => ({ board: l.name, keyId, fn: table === 'fn' })),
    ),
  )
}

/**
 * Keymaps after deleting the macro at `index`: keys that ran it go back to their defaults, and
 * keys linked to later macros follow them down one place.
 */
export function keymapsWithoutMacro(keymaps: Keymaps, index: number): Keymaps {
  const fix = (table: Readonly<Record<string, number>>) => {
    const next: Record<string, number> = {}
    for (const [id, v] of Object.entries(table)) {
      const i = macroIndexOf(v)
      if (i === index) continue
      next[id] = i !== null && i > index ? macroKeyValue(i - 1) : v
    }
    return next
  }
  const fixMap = (map: Keymap): Keymap => ({ normal: fix(map.normal), fn: fix(map.fn) })
  return Object.fromEntries(BOARD_LAYERS.map((l) => [l.id, fixMap(keymaps[l.id])])) as Keymaps
}

// ---- Reading saved macros ----

const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback

function parseStep(raw: unknown): MacroStep | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const input = o.input as Record<string, unknown> | undefined
  if (!input || typeof input !== 'object') return null
  const parsed: MacroInput | null =
    input.kind === 'key'
      ? { kind: 'key', code: clamp(input.code, 0, 0xff, 0), mods: clamp(input.mods, 0, 0xff, 0) }
      : input.kind === 'mouse'
        ? { kind: 'mouse', button: clamp(input.button, 1, 0xff, 1) }
        : null
  if (!parsed || (parsed.kind === 'key' && !parsed.code && !parsed.mods)) return null
  return { input: parsed, down: o.down !== false, delay: clamp(o.delay, 0, MAX_STEP_DELAY_MS, 0) }
}

export function parseMacros(raw: unknown): MacroDef[] {
  if (!Array.isArray(raw)) return []
  const out: MacroDef[] = []
  for (const item of raw.slice(0, MAX_MACROS)) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const steps = (Array.isArray(o.steps) ? o.steps : []).map(parseStep).filter((s): s is MacroStep => s !== null)
    out.push({
      id: typeof o.id === 'string' && o.id ? o.id : Math.random().toString(36).slice(2, 10),
      name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 40) : `Macro ${out.length + 1}`,
      steps: steps.slice(0, MAX_MACRO_STEPS),
      repeat: (['count', 'whileHeld', 'toggle'] as const).find((r) => r === o.repeat) ?? 'count',
      count: clamp(o.count, 1, 255, 1),
    })
  }
  return out
}
