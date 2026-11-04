import type { LayerOverrides } from './keymap'
import type { KeyboardLayout } from './layout'
import { stepsForText, toFirmwareMacro } from './macroLibrary'
import { encodeMacros, macroKeyValue } from './macros'

// Hardware test: how many macros does the keyboard keep?
//
// Writes one macro per key (every key but Fn, 63 on an SK64) to the Windows layer, and links each
// key to its macro in reading order (Esc, 1, 2, … then the next row). Macro n types its number and
// a space, so pressing keys in order shows where they stop typing: the last number that appears is
// how many macros the keyboard kept. 63 macros make a ~32 KB block, so it checks memory too.

export type MacroLimitTest = {
  /** The macros block for the layer. */
  block: Uint8Array
  /** Normal-table key values: each key runs its macro. */
  keys: LayerOverrides
  count: number
}

/** Bytes per macro in the block (see macros.ts). */
export const MACRO_RECORD_BYTES = 512

export function buildMacroLimitTest(layout: KeyboardLayout): MacroLimitTest {
  const order = layout.keys.filter((k) => k.id !== layout.fnKeyId) // reading order, without Fn
  const macros = order.map((_, i) =>
    toFirmwareMacro({ id: String(i), name: String(i + 1), steps: stepsForText(`${i + 1} `, 10).steps, repeat: 'count', count: 1 }),
  )
  const keys = Object.fromEntries(order.map((k, i) => [k.id, macroKeyValue(i)]))
  return { block: encodeMacros(macros), keys, count: order.length }
}

/** Where each keyboard row starts and ends in the test's numbering, e.g. "1–14: Esc to Backspace". */
export function macroLimitRows(layout: KeyboardLayout): { from: number; to: number; first: string; last: string }[] {
  const order = layout.keys.filter((k) => k.id !== layout.fnKeyId)
  const rows: { from: number; to: number; first: string; last: string }[] = []
  order.forEach((k, i) => {
    const name = k.label || k.name
    const row = rows.at(-1)
    if (row && order[i - 1]?.y === k.y) {
      row.to = i + 1
      row.last = name
    } else rows.push({ from: i + 1, to: i + 1, first: name, last: name })
  })
  return rows
}
