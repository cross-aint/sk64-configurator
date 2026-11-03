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

// ---- Profile files (export / import) ----

const APP_ID = 'sk64-configurator'

type ProfileFile = {
  app: typeof APP_ID
  version: 1
  layout: string
  name: string
  layers: Record<LayerName, Record<string, string>>
}

const toHex = (v: number) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0')

export function exportProfile(layout: KeyboardLayout, map: Keymap, name: string): string {
  const file: ProfileFile = {
    app: APP_ID,
    version: 1,
    layout: layout.name,
    name,
    layers: {
      normal: Object.fromEntries(Object.entries(map.normal).map(([id, v]) => [id, toHex(v)])),
      fn: Object.fromEntries(Object.entries(map.fn).map(([id, v]) => [id, toHex(v)])),
    },
  }
  return JSON.stringify(file, null, 2)
}

/** Parses a profile file. Throws with a readable message if it isn't one of ours. */
export function importProfile(layout: KeyboardLayout, text: string): { name: string; keymap: Keymap } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("This file isn't valid JSON.")
  }
  const file = data as Partial<ProfileFile>
  if (file?.app !== APP_ID) throw new Error("This isn't an SK64 Configurator profile.")
  if (file.version !== 1) throw new Error(`Unsupported profile version ${String(file.version)}.`)
  if (file.layout !== layout.name) throw new Error(`This profile is for ${file.layout}, not ${layout.name}.`)

  const validIds = new Set(layout.keys.map((k) => k.id))
  const parseLayer = (raw: unknown): Record<string, number> => {
    const out: Record<string, number> = {}
    if (!raw || typeof raw !== 'object') return out
    for (const [id, hex] of Object.entries(raw as Record<string, unknown>)) {
      if (!validIds.has(id) || id === layout.fnKeyId) continue
      if (typeof hex !== 'string' || !/^0x[0-9a-f]{1,8}$/i.test(hex)) throw new Error(`Invalid value for key "${id}".`)
      out[id] = parseInt(hex, 16) >>> 0
    }
    return out
  }
  return {
    name: typeof file.name === 'string' ? file.name : 'Imported profile',
    keymap: { normal: parseLayer(file.layers?.normal), fn: parseLayer(file.layers?.fn) },
  }
}
