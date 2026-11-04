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

// ---- Keyboard layers ----
//
// The SK64 keeps four sets of keys (from its printed manual):
//   base     "standard mode", the layer it starts on
//   windows  on-board layer 1, switched with Fn + W (the W key lights white)
//   mac      on-board layer 2, switched with Fn + E (the E key lights white); Mac-style defaults
//   fnx      on-board layer 3, the "FNX" layer: not switched to, but active while an FNX key is
//            held, like a second Fn key. FNX keys go on the Windows and macOS layers.
// Each has its own normal and Fn tables. Lighting is shared by all of them (confirmed on an SK64),
// and macros only work on the on-board layers: the base layer rejects them.

export type BoardLayer = 'base' | 'windows' | 'mac' | 'fnx'

export type BoardLayerInfo = {
  id: BoardLayer
  name: string
  /** Layer number in the firmware's commands. */
  firmware: number
  /** How to get to it on the keyboard, e.g. "switch to it with Fn + W". */
  reach: string
  /** Whether keys on this layer can run macros. */
  macros: boolean
  /** Whether keys on this layer can be FNX keys (hold for the FNX layer). */
  fnxKeys: boolean
}

export const BOARD_LAYERS: readonly BoardLayerInfo[] = [
  { id: 'base', name: 'Base', firmware: 1, reach: 'the layer the keyboard starts on', macros: false, fnxKeys: false },
  { id: 'windows', name: 'Windows', firmware: 2, reach: 'switch to it with Fn + W', macros: true, fnxKeys: true },
  { id: 'mac', name: 'macOS', firmware: 3, reach: 'switch to it with Fn + E', macros: true, fnxKeys: true },
  {
    id: 'fnx',
    name: 'FNX',
    firmware: 4,
    reach: 'active while you hold an FNX key on the Windows or macOS layer',
    macros: true,
    fnxKeys: false,
  },
]

/** Key value of an FNX key: hold it for the FNX layer (on-board layer 3). */
export const FNX_KEY = 0x0a070004

export function boardLayerInfo(id: BoardLayer): BoardLayerInfo {
  return BOARD_LAYERS.find((l) => l.id === id) ?? BOARD_LAYERS[0]
}

/** One keymap per keyboard layer. */
export type Keymaps = Readonly<Record<BoardLayer, Keymap>>

export const EMPTY_KEYMAPS: Keymaps = { base: EMPTY_KEYMAP, windows: EMPTY_KEYMAP, mac: EMPTY_KEYMAP, fnx: EMPTY_KEYMAP }

/** Keyboard layers whose keys differ between two sets of keymaps. */
export function changedBoardLayers(a: Keymaps, b: Keymaps): BoardLayer[] {
  return BOARD_LAYERS.map((l) => l.id).filter((id) => countDifferences(a[id], b[id]) > 0)
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

/** Whether any key on this layer (normal or Fn table) is an FNX key. */
export function hasFnxKey(map: Keymap): boolean {
  return [...Object.values(map.normal), ...Object.values(map.fn)].includes(FNX_KEY)
}
