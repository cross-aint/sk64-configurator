import { crc16 } from '../protocol/crc16'

// Macros and how they're encoded for the firmware (format from GK6X).
//
// All of a layer's macros go in one block (command 0x25), one 512-byte record per macro:
//   uint16 0x55AA (magic), uint16 CRC of the step data, uint8 step data length in 4-byte words,
//   uint8 macro number, uint8 repeat mode, uint8 repeat count,
//   63 steps × 8 bytes (unused steps are zero).
// GK6X's decoder for the official software's traffic expects exactly 512 bytes per macro. Its
// writer adds a zero byte after each one (513 bytes), which didn't work on an SK64.
// A step is
//   uint8 key code (USB HID usage, or a mouse button bit), uint8 modifier bits,
//   uint8 1 = down / 2 = up, uint8 1 = key / 2 = mouse,
//   then the delay after it: uint16 delay, uint8 0, uint8 3.
// The delay isn't in milliseconds: on an SK64 one unit is about 2.45 ms (500 took ~1.23 s and
// 100 took ~250 ms), so steps here keep milliseconds and are converted when encoded.
// The last step has no delay (its 4 delay bytes are zero and aren't counted in the length)
// unless the macro keeps a delay at the end, e.g. to space out repeats.
//
// A key runs macro n when its key value is 0x0A01000n.

export const MAX_MACRO_STEPS = 63
/** Milliseconds per unit of a step's delay (measured on an SK64, firmware v2.101). */
export const MS_PER_DELAY_UNIT = 2.45
/** Longest delay a step can have, in milliseconds. */
export const MAX_STEP_DELAY_MS = Math.floor(0xffff * MS_PER_DELAY_UNIT)
const STEP_BYTES = 8
const HEADER_BYTES = 8
const RECORD_BYTES = HEADER_BYTES + MAX_MACRO_STEPS * STEP_BYTES
const MAGIC = 0x55aa
const MACRO_KEY = 0x0a010000

/**
 * How a macro repeats:
 *   count     – plays `count` times per press
 *   whileHeld – keeps repeating while the key is held, stops when it's released
 *   toggle    – keeps repeating until the key is pressed again
 */
export type MacroRepeat = 'count' | 'whileHeld' | 'toggle'

const REPEAT_CODE: Record<MacroRepeat, number> = { count: 1, whileHeld: 2, toggle: 3 }

/** USB HID modifier bits, as used in key values and macro steps. */
export const MOD = {
  LCtrl: 0x01,
  LShift: 0x02,
  LAlt: 0x04,
  LWin: 0x08,
  RCtrl: 0x10,
  RShift: 0x20,
  RAlt: 0x40,
  RWin: 0x80,
} as const

/** Mouse button bits. */
export const MOUSE = { left: 0x01, right: 0x02, middle: 0x04, back: 0x08, forward: 0x10 } as const

export type MacroStep = {
  /** A keyboard key (HID usage and/or modifier bits) or a mouse button. */
  input: { kind: 'key'; code: number; mods: number } | { kind: 'mouse'; button: number }
  down: boolean
  /** Milliseconds to wait after this step. */
  delay: number
}

export type Macro = {
  steps: readonly MacroStep[]
  repeat: MacroRepeat
  /** Times to play per press (repeat = 'count'). */
  count: number
  /** Keep the last step's delay, e.g. to space out repeats. */
  trailingDelay: boolean
}

/** The key value that makes a key run macro `index`. */
export function macroKeyValue(index: number): number {
  return (MACRO_KEY | (index & 0xff)) >>> 0
}

/** Which macro a key value runs, or null if it isn't a macro key. */
export function macroIndexOf(value: number): number | null {
  return (value & 0xffffff00) >>> 0 === MACRO_KEY ? value & 0xff : null
}

/** Encodes a layer's macros; each one's number is its position in the list. */
export function encodeMacros(macros: readonly Macro[]): Uint8Array {
  if (macros.length > 0xff) throw new Error('Too many macros.')
  const block = new Uint8Array(macros.length * RECORD_BYTES)
  macros.forEach((macro, index) => {
    if (macro.steps.length === 0) throw new Error(`Macro ${index + 1} has no steps.`)
    if (macro.steps.length > MAX_MACRO_STEPS) {
      throw new Error(`Macro ${index + 1} has ${macro.steps.length} steps; the keyboard allows ${MAX_MACRO_STEPS}.`)
    }
    const at = index * RECORD_BYTES
    const view = new DataView(block.buffer, at, RECORD_BYTES)
    const words = macro.steps.length * 2 - (macro.trailingDelay ? 0 : 1)
    view.setUint16(0, MAGIC, true)
    block[at + 4] = words
    block[at + 5] = index
    block[at + 6] = REPEAT_CODE[macro.repeat]
    block[at + 7] = macro.repeat === 'count' ? Math.min(0xff, Math.max(1, Math.round(macro.count))) : 1
    macro.steps.forEach((step, i) => {
      const s = HEADER_BYTES + i * STEP_BYTES
      if (step.input.kind === 'key') {
        view.setUint8(s, step.input.code & 0xff)
        view.setUint8(s + 1, step.input.mods & 0xff)
      } else {
        view.setUint8(s, step.input.button & 0xff)
      }
      view.setUint8(s + 2, step.down ? 1 : 2)
      view.setUint8(s + 3, step.input.kind === 'key' ? 1 : 2)
      const last = i === macro.steps.length - 1
      if (!last || macro.trailingDelay) {
        view.setUint16(s + 4, Math.min(0xffff, Math.max(0, Math.round(step.delay / MS_PER_DELAY_UNIT))), true)
        view.setUint8(s + 7, 3)
      }
    })
    const dataStart = at + HEADER_BYTES
    view.setUint16(2, crc16(block, dataStart, dataStart + words * 4), true)
  })
  return block
}

// ---- Building steps ----

/** Steps that press and release a key (with optional modifiers held around it). */
export function tap(code: number, mods = 0, delay = 0): MacroStep[] {
  const steps: MacroStep[] = []
  for (const bit of modBits(mods)) steps.push({ input: { kind: 'key', code: 0, mods: bit }, down: true, delay: 0 })
  steps.push({ input: { kind: 'key', code, mods: 0 }, down: true, delay: 0 })
  steps.push({ input: { kind: 'key', code, mods: 0 }, down: false, delay: mods ? 0 : delay })
  const ups = modBits(mods).reverse()
  ups.forEach((bit, i) =>
    steps.push({ input: { kind: 'key', code: 0, mods: bit }, down: false, delay: i === ups.length - 1 ? delay : 0 }),
  )
  return steps
}

function modBits(mods: number): number[] {
  return Object.values(MOD).filter((bit) => mods & bit)
}
