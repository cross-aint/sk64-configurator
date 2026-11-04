import { describe, expect, it } from 'vitest'
import { SK64_LAYOUT as layout } from './layout'
import { buildMacroLimitTest, MACRO_RECORD_BYTES, macroLimitRows } from './macroLimitTest'
import { MAX_MACROS } from './macroLibrary'
import { macroIndexOf } from './macros'

describe('macro limit test', () => {
  const test = buildMacroLimitTest(layout)

  it('writes one macro per key except Fn, linked in reading order', () => {
    expect(test.count).toBe(63)
    expect(test.block.length).toBe(63 * MACRO_RECORD_BYTES)
    expect(test.keys[layout.fnKeyId]).toBeUndefined()
    expect(macroIndexOf(test.keys.esc)).toBe(0)
    expect(macroIndexOf(test.keys['1'])).toBe(1)
    expect(macroIndexOf(test.keys.backspace)).toBe(13)
  })

  it('makes macro n type its number (macro 12: "1", "2", space)', () => {
    const at = 11 * MACRO_RECORD_BYTES
    const keyDowns = [0, 1, 2, 3, 4, 5].map((i) => test.block.slice(at + 8 + i * 8, at + 12 + i * 8)).filter((s) => s[2] === 1)
    expect(keyDowns.map((s) => s[0])).toEqual([0x1e, 0x1f, 0x2c])
    expect(test.block[at + 5]).toBe(11)
  })

  it('matches the app’s limit: an SK64 kept all 63 test macros', () => {
    expect(MAX_MACROS).toBe(test.count)
  })

  it('lists each row’s numbers for counting', () => {
    const rows = macroLimitRows(layout)
    expect(rows[0]).toEqual({ from: 1, to: 14, first: 'Esc', last: 'Backspace' })
    expect(rows.at(-1)?.to).toBe(63)
  })
})
