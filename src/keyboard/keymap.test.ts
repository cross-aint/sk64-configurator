import { describe, expect, it } from 'vitest'
import { defaultFunction } from './defaults'
import { BOARD_LAYERS, changedBoardLayers, EMPTY_KEYMAPS, FNX_KEY, hasFnxKey, toSlotTable } from './keymap'
import { SK64_LAYOUT as layout } from './layout'

const key = (id: string) => layout.keys.find((k) => k.id === id)!

describe('SK64 layout', () => {
  it('has 64 keys with unique ids, slots and LEDs inside the keyboard’s tables', () => {
    expect(layout.keys).toHaveLength(64)
    for (const field of ['id', 'slot', 'led'] as const) {
      expect(new Set(layout.keys.map((k) => k[field])).size).toBe(64)
    }
    for (const k of layout.keys) {
      expect(k.slot).toBeLessThan(112)
      expect(k.led).toBeLessThan(176)
    }
  })
})

describe('toSlotTable', () => {
  it('writes overrides at each key’s slot and 0xFFFFFFFF (firmware default) everywhere else', () => {
    const table = toSlotTable(layout, { a: 0x02000500 }, 112)
    expect(table[key('a').slot]).toBe(0x02000500)
    expect(table.filter((v) => v !== 0xffffffff)).toHaveLength(1)
  })

  it('never remaps Fn', () => {
    const table = toSlotTable(layout, { [layout.fnKeyId]: 0x02000400 }, 112)
    expect(table.every((v) => v === 0xffffffff)).toBe(true)
  })
})

describe('keyboard layers', () => {
  it('maps to firmware layers 1–4; only the on-board ones run macros', () => {
    expect(BOARD_LAYERS.map((l) => [l.id, l.firmware, l.macros])).toEqual([
      ['base', 1, false],
      ['windows', 2, true],
      ['mac', 3, true],
      ['fnx', 4, true],
    ])
  })

  it('finds the layers whose keys changed', () => {
    const draft = { ...EMPTY_KEYMAPS, mac: { normal: { a: 0x02000500 }, fn: {} } }
    expect(changedBoardLayers(draft, EMPTY_KEYMAPS)).toEqual(['mac'])
  })

  it('knows when a layer has an FNX key (hold for the FNX layer)', () => {
    expect(FNX_KEY).toBe(0x0a070004)
    expect(hasFnxKey({ normal: { menu: FNX_KEY }, fn: {} })).toBe(true)
    expect(hasFnxKey({ normal: {}, fn: {} })).toBe(false)
  })
})

describe('built-in functions (from the SK64 manual)', () => {
  it('swaps Win and Alt to Option and Command on the macOS layer', () => {
    expect(defaultFunction(key('lwin'), false, 'mac')?.cap).toBe('Opt')
    expect(defaultFunction(key('lalt'), false, 'mac')?.cap).toBe('Cmd')
    expect(defaultFunction(key('lwin'), false, 'windows')?.cap).toBe('Win')
  })

  it('knows the Fn layer: F-keys, ` on Esc, Delete on Backspace, Mac functions on macOS', () => {
    expect(defaultFunction(key('1'), true, 'windows')?.cap).toBe('F1')
    expect(defaultFunction(key('esc'), true, 'base')?.cap).toBe('`')
    expect(defaultFunction(key('backspace'), true, 'base')?.cap).toBe('Del')
    expect(defaultFunction(key('1'), true, 'mac')?.name).toMatch(/brightness/i)
  })

  it('doesn’t guess what untouched FNX-layer keys do', () => {
    expect(defaultFunction(key('a'), false, 'fnx')).toBeNull()
    expect(defaultFunction(key('a'), true, 'fnx')).toBeNull()
  })
})
