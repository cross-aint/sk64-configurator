import { describe, expect, it } from 'vitest'
import { buildChangeSheet, summarizeSteps } from './changeSheet'
import { EMPTY_KEYMAPS, FNX_KEY } from './keymap'
import { SK64_LAYOUT as layout } from './layout'
import { stepsForText, type MacroDef } from './macroLibrary'
import { macroKeyValue, MOD, tap, type MacroStep } from './macros'

const key = (code: number, down: boolean, delay = 0): MacroStep => ({ input: { kind: 'key', code, mods: 0 }, down, delay })
const mod = (bit: number, down: boolean, delay = 0): MacroStep => ({ input: { kind: 'key', code: 0, mods: bit }, down, delay })

describe('summarizeSteps', () => {
  it('turns typed text back into text', () => {
    expect(summarizeSteps(stepsForText('Hi, World!', 20).steps)).toBe('"Hi, World!"')
  })

  it('names shortcuts with their modifiers', () => {
    expect(summarizeSteps([...tap(0x06, MOD.LCtrl), ...tap(0x19, MOD.LCtrl)])).toBe('Ctrl+C, Ctrl+V')
  })

  it('shows pauses of 100 ms or more, and non-text keys held half a second or more', () => {
    expect(summarizeSteps([...tap(0x04, 0, 500), ...tap(0x05, 0, 30)])).toBe('"a", wait 500 ms, "b"')
    expect(summarizeSteps([key(0x28, true, 600), key(0x28, false)])).toBe('Enter (held 600 ms)')
    expect(summarizeSteps([key(0x28, true, 300), key(0x28, false)])).toBe('Enter')
  })

  it('keeps a recorded shortcut together even when the key was held a while', () => {
    expect(summarizeSteps([mod(MOD.LCtrl, true, 31), key(0x06, true, 124), key(0x06, false, 22), mod(MOD.LCtrl, false)])).toBe(
      'Ctrl+C',
    )
  })

  it('shows a modifier pressed on its own, and keys left held or released', () => {
    expect(summarizeSteps([mod(MOD.LWin, true), mod(MOD.LWin, false)])).toBe('Win')
    expect(summarizeSteps([key(0x04, true)])).toBe('hold A')
    expect(summarizeSteps([key(0x04, false)])).toBe('release A')
  })

  it('names mouse buttons', () => {
    const click: MacroStep[] = [
      { input: { kind: 'mouse', button: 1 }, down: true, delay: 0 },
      { input: { kind: 'mouse', button: 1 }, down: false, delay: 0 },
    ]
    expect(summarizeSteps(click)).toBe('LClick')
  })
})

describe('buildChangeSheet', () => {
  const macros: MacroDef[] = [{ id: 'm', name: 'Greeting', steps: stepsForText('Hi', 0).steps, repeat: 'whileHeld', count: 1 }]
  const keymaps = {
    ...EMPTY_KEYMAPS,
    base: { normal: { caps: 0x02000001 }, fn: {} },
    windows: { normal: { menu: macroKeyValue(0), lwin: FNX_KEY }, fn: { a: 0x02000500 } },
    mac: { normal: { lwin: 0x02000008 }, fn: {} },
  }
  const sheet = buildChangeSheet(layout, keymaps, macros)

  it('has a section for each layer and table with changes, in order', () => {
    expect(sheet.sections.map((s) => s.title)).toEqual([
      'Base layer',
      'Windows layer',
      'Windows layer · Fn held',
      'macOS layer',
    ])
    expect(sheet.sections[1].reach).toBe('Switch to it with Fn + W')
  })

  it('says what each key did and does now', () => {
    expect(sheet.sections[0].changes).toEqual([{ id: 'caps', keyName: 'Caps', cap: 'Ctrl', name: 'Left Ctrl', was: 'Caps Lock' }])
    const windows = Object.fromEntries(sheet.sections[1].changes.map((c) => [c.id, c]))
    expect(windows.menu).toMatchObject({ cap: 'M1', name: 'Macro: Greeting' })
    expect(windows.lwin.cap).toBe('FNX')
    expect(sheet.sections[3].changes[0].was).toBe('Option (Alt)')
  })

  it('leaves out what an FNX-layer key did, since that isn’t documented', () => {
    const fnx = buildChangeSheet(layout, { ...EMPTY_KEYMAPS, fnx: { normal: { '1': 0x030000cd }, fn: {} } }, [])
    expect(fnx.sections[0]).toMatchObject({ title: 'FNX layer', changes: [{ keyName: '1', was: null, name: 'Play / Pause' }] })
  })

  it('lists macros with how they play, their keys and their steps', () => {
    expect(sheet.macros).toEqual([
      { number: 1, name: 'Greeting', plays: 'repeats while held', keys: ['Windows · Menu'], steps: '"Hi"' },
    ])
  })

  it('is empty without remaps or macros', () => {
    expect(buildChangeSheet(layout, EMPTY_KEYMAPS, [])).toEqual({ sections: [], macros: [] })
  })
})
