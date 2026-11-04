import { describe, expect, it } from 'vitest'
import { crc16 } from '../protocol/crc16'
import { EMPTY_KEYMAPS } from './keymap'
import { SK64_LAYOUT as layout } from './layout'
import {
  describeWithMacros,
  inputForCode,
  inputFromValue,
  keymapsWithoutMacro,
  parseMacros,
  stepsForText,
  unreleased,
} from './macroLibrary'
import {
  encodeMacros,
  macroIndexOf,
  macroKeyValue,
  MAX_MACRO_STEPS,
  MOD,
  MS_PER_DELAY_UNIT,
  tap,
  type Macro,
  type MacroStep,
} from './macros'

const A = 0x04
const press = (code: number, delay = 0): MacroStep[] => [
  { input: { kind: 'key', code, mods: 0 }, down: true, delay: 0 },
  { input: { kind: 'key', code, mods: 0 }, down: false, delay },
]
const macro = (steps: MacroStep[], patch: Partial<Macro> = {}): Macro => ({ steps, repeat: 'count', count: 1, trailingDelay: false, ...patch })

describe('encodeMacros', () => {
  it('writes one 512-byte record per macro (513 bytes, as GK6X writes them, did nothing on an SK64)', () => {
    expect(encodeMacros([macro(press(A)), macro(press(A))]).length).toBe(1024)
  })

  it('starts each record with 0x55AA, the CRC, the length in words, its number, repeat mode and count', () => {
    const block = encodeMacros([macro(press(A)), macro(press(A), { repeat: 'count', count: 3 })])
    const view = new DataView(block.buffer)
    const words = 2 * 2 - 1 // two steps, no delay after the last
    expect(view.getUint16(512, true)).toBe(0x55aa)
    expect([block[512 + 4], block[512 + 5], block[512 + 6], block[512 + 7]]).toEqual([words, 1, 1, 3])
    expect(view.getUint16(512 + 2, true)).toBe(crc16(block, 512 + 8, 512 + 8 + words * 4))
  })

  it('encodes steps as key, modifiers, down/up, key/mouse, then the delay', () => {
    const block = encodeMacros([
      macro([
        { input: { kind: 'key', code: 0, mods: MOD.LShift }, down: true, delay: 0 },
        { input: { kind: 'mouse', button: 2 }, down: false, delay: 0 },
      ]),
    ])
    expect([...block.slice(8, 16)]).toEqual([0, MOD.LShift, 1, 1, 0, 0, 0, 3])
    expect([...block.slice(16, 20)]).toEqual([2, 0, 2, 2])
  })

  it('converts delays from milliseconds to the keyboard’s ~2.45 ms units', () => {
    const block = encodeMacros([macro([...press(A, 500), ...press(A)])])
    const view = new DataView(block.buffer)
    expect(view.getUint16(8 + 8 + 4, true)).toBe(Math.round(500 / MS_PER_DELAY_UNIT))
    expect(Math.round(500 / MS_PER_DELAY_UNIT)).toBe(204)
  })

  it('only keeps a delay after the last step when asked to (spacing out repeats)', () => {
    const without = encodeMacros([macro(press(A, 100))])
    const withDelay = encodeMacros([macro(press(A, 100), { repeat: 'whileHeld', trailingDelay: true })])
    expect(without[4]).toBe(3)
    expect([...without.slice(8 + 8 + 4, 8 + 16)]).toEqual([0, 0, 0, 0])
    expect(withDelay[4]).toBe(4)
    expect(new DataView(withDelay.buffer).getUint16(8 + 8 + 4, true)).toBe(Math.round(100 / MS_PER_DELAY_UNIT))
    expect(withDelay[6]).toBe(2)
  })

  it('refuses empty macros and more than 63 steps', () => {
    expect(() => encodeMacros([macro([])])).toThrow()
    expect(() => encodeMacros([macro(Array(MAX_MACRO_STEPS + 1).fill(press(A)[0]))])).toThrow()
  })
})

describe('macro key values', () => {
  it('are 0x0A01000n for macro n', () => {
    expect(macroKeyValue(0)).toBe(0x0a010000)
    expect(macroIndexOf(0x0a01000f)).toBe(15)
    expect(macroIndexOf(0x0a070004)).toBeNull()
    expect(macroIndexOf(0x02000400)).toBeNull()
  })
})

describe('tap', () => {
  it('holds modifiers around the key and puts the delay at the very end', () => {
    const steps = tap(A, MOD.LCtrl, 50)
    expect(steps.map((s) => [s.input.kind === 'key' && (s.input.code || s.input.mods), s.down, s.delay])).toEqual([
      [MOD.LCtrl, true, 0],
      [A, true, 0],
      [A, false, 0],
      [MOD.LCtrl, false, 50],
    ])
  })
})

describe('stepsForText', () => {
  it('types US-layout text, holding Shift across capitals and symbols', () => {
    const { steps, skipped } = stepsForText('aB!c', 20)
    const shift = (down: boolean) => ({ input: { kind: 'key', code: 0, mods: MOD.LShift }, down, delay: 0 })
    expect(steps).toEqual([
      ...press(A, 20),
      shift(true),
      ...press(0x05, 20), // B
      ...press(0x1e, 20), // ! (Shift + 1)
      shift(false),
      ...press(0x06, 20), // c
    ])
    expect(skipped).toEqual([])
  })

  it('reports characters it can’t type', () => {
    expect(stepsForText('é€é', 0)).toEqual({ steps: [], skipped: ['é', '€'] })
  })
})

describe('unreleased', () => {
  it('finds keys pressed but never released', () => {
    const steps: MacroStep[] = [{ input: { kind: 'key', code: 0, mods: MOD.LShift }, down: true, delay: 0 }, ...press(A)]
    expect(unreleased(steps)).toEqual([{ kind: 'key', code: 0, mods: MOD.LShift }])
    expect(unreleased(press(A))).toEqual([])
  })
})

describe('recording and picking keys', () => {
  it('maps browser key codes to keys, including ones the SK64 has no key for', () => {
    expect(inputForCode(layout, 'KeyA')).toEqual({ kind: 'key', code: A, mods: 0 })
    expect(inputForCode(layout, 'ShiftLeft')).toEqual({ kind: 'key', code: 0, mods: MOD.LShift })
    expect(inputForCode(layout, 'F5')).toEqual({ kind: 'key', code: 0x3e, mods: 0 })
    expect(inputForCode(layout, 'NumpadEnter')).toBeNull()
  })

  it('accepts plain keys, modifiers and mouse buttons, not combinations or media keys', () => {
    expect(inputFromValue(0x02000400)).toEqual({ kind: 'key', code: A, mods: 0 })
    expect(inputFromValue(0x02000401)).toBeNull() // Ctrl+A
    expect(inputFromValue(0x01010002)).toEqual({ kind: 'mouse', button: 2 })
    expect(inputFromValue(0x030000cd)).toBeNull()
  })
})

describe('linking keys to macros', () => {
  const macros = parseMacros([{ name: 'One', steps: press(A) }, { name: 'Two', steps: press(A) }])

  it('names macro keys after the macro', () => {
    expect(describeWithMacros(macroKeyValue(1), macros)).toEqual({ name: 'Macro: Two', cap: 'M2' })
    expect(describeWithMacros(macroKeyValue(5), macros).name).toMatch(/deleted/)
  })

  it('drops links to a deleted macro and moves later ones down', () => {
    const maps = {
      ...EMPTY_KEYMAPS,
      windows: { normal: { a: macroKeyValue(0), b: macroKeyValue(1), c: macroKeyValue(2), d: 0x02000400 }, fn: {} },
      fnx: { normal: {}, fn: { e: macroKeyValue(2) } },
    }
    const after = keymapsWithoutMacro(maps, 1)
    expect(after.windows.normal).toEqual({ a: macroKeyValue(0), c: macroKeyValue(1), d: 0x02000400 })
    expect(after.fnx.fn).toEqual({ e: macroKeyValue(1) })
  })
})

describe('parseMacros', () => {
  it('keeps valid macros and clamps bad values', () => {
    const [m] = parseMacros([
      {
        id: 'x',
        name: '  Hi  ',
        repeat: 'nonsense',
        count: 999,
        steps: [...press(A, -5), { input: { kind: 'key', code: 0, mods: 0 } }, { junk: true }],
      },
    ])
    expect(m).toMatchObject({ id: 'x', name: 'Hi', repeat: 'count', count: 255 })
    expect(m.steps).toEqual(press(A, 0))
  })

  it('returns nothing for anything that isn’t a list', () => {
    expect(parseMacros({})).toEqual([])
    expect(parseMacros(null)).toEqual([])
  })
})
