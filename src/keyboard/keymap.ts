import { UNCHANGED_KEY } from '../protocol/device'
import type { KeyboardLayout } from './layout'

// A keymap holds only the keys the user changed. Anything not listed keeps the firmware's
// default, which is also how it's written to the keyboard (0xFFFFFFFF = "default").

export type LayerName = 'normal' | 'fn'

/** key id -> key value */
export type LayerOverrides = Readonly<Record<string, number>>

export type Keymap = Readonly<Record<LayerName, LayerOverrides>>

export const EMPTY_KEYMAP: Keymap = { normal: {}, fn: {} }

export const LAYER_NAMES: LayerName[] = ['normal', 'fn']

export function setOverride(map: Keymap, layer: LayerName, keyId: string, value: number | null): Keymap {
  const next = { ...map[layer] }
  if (value === null) delete next[keyId]
  else next[keyId] = value >>> 0
  return { ...map, [layer]: next }
}

/** Number of keys that differ between two keymaps, across both layers. */
export function countDifferences(a: Keymap, b: Keymap): number {
  let count = 0
  for (const layer of LAYER_NAMES) {
    const ids = new Set([...Object.keys(a[layer]), ...Object.keys(b[layer])])
    for (const id of ids) if (a[layer][id] !== b[layer][id]) count++
  }
  return count
}

/**
 * Builds the full slot table the keyboard expects. Keys that can't be remapped (Fn) and keys
 * missing from the layout are skipped, so they always keep their defaults.
 */
export function toSlotTable(layout: KeyboardLayout, overrides: LayerOverrides, slotCount: number): Uint32Array {
  const table = new Uint32Array(slotCount).fill(UNCHANGED_KEY)
  for (const key of layout.keys) {
    if (key.id === layout.fnKeyId) continue
    const value = overrides[key.id]
    if (value === undefined) continue
    if (key.slot >= slotCount) throw new Error(`Key ${key.name} uses slot ${key.slot}, but the keyboard only has ${slotCount}`)
    table[key.slot] = value
  }
  return table
}
