import { BOARD_LAYERS, EMPTY_KEYMAPS, type BoardLayer, type Keymap, type Keymaps, type LayerName } from './keymap'
import type { KeyboardLayout } from './layout'
import { parseLighting, type Lighting } from './lighting'
import { parseMacros, type MacroDef } from './macroLibrary'

// Profile files: a readable JSON snapshot of the keymaps and lighting that people can save and share.

const APP_ID = 'sk64-configurator'

// Version 3 stores keys for every keyboard layer (`boards`). Versions 1 and 2 had the base
// layer only (`layers`); they're still read, into the base layer. Version 2 stores lighting as a
// list of effects; version 1 stored one set of per-key colors (`lighting: { kind: 'custom', colors }`).
const VERSION = 3

type KeymapFile = Record<LayerName, Record<string, string>>

type ProfileFile = {
  app: typeof APP_ID
  version: 1 | 2 | 3
  layout: string
  name: string
  /** Versions 1–2: the base layer's keys. */
  layers?: KeymapFile
  /** Version 3: keys per keyboard layer. */
  boards?: Partial<Record<BoardLayer, KeymapFile>>
  /** Optional: the oldest files have no lighting. */
  lighting?: unknown
  /** Optional: files from before macros have none. */
  macros?: unknown
}

export type Profile = { name: string; keymaps: Keymaps; lighting: Lighting; macros: MacroDef[] }

const toHex = (v: number) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0')

const keymapToFile = (keymap: Keymap): KeymapFile => ({
  normal: Object.fromEntries(Object.entries(keymap.normal).map(([id, v]) => [id, toHex(v)])),
  fn: Object.fromEntries(Object.entries(keymap.fn).map(([id, v]) => [id, toHex(v)])),
})

export function exportProfile(layout: KeyboardLayout, profile: Profile): string {
  const { keymaps, lighting } = profile
  const file: ProfileFile = {
    app: APP_ID,
    version: VERSION,
    layout: layout.name,
    name: profile.name,
    boards: Object.fromEntries(BOARD_LAYERS.map((l) => [l.id, keymapToFile(keymaps[l.id])])),
    lighting,
    macros: profile.macros,
  }
  return JSON.stringify(file, null, 2)
}

/** Parses a profile file. Throws with a readable message if it isn't one of ours. */
export function importProfile(layout: KeyboardLayout, text: string): Profile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("This file isn't valid JSON.")
  }
  const file = data as Partial<ProfileFile>
  if (file?.app !== APP_ID) throw new Error("This isn't an SK64 Configurator profile.")
  if (file.version !== 1 && file.version !== 2 && file.version !== 3) {
    throw new Error(`This profile was made by a newer version of the app (format ${String(file.version)}).`)
  }
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

  const parseKeymap = (raw: Partial<KeymapFile> | undefined): Keymap => ({
    normal: parseLayer(raw?.normal),
    fn: parseLayer(raw?.fn),
  })
  const keymaps: Keymaps =
    file.version === 3
      ? (Object.fromEntries(BOARD_LAYERS.map((l) => [l.id, parseKeymap(file.boards?.[l.id])])) as Keymaps)
      : { ...EMPTY_KEYMAPS, base: parseKeymap(file.layers) }

  return {
    name: typeof file.name === 'string' ? file.name : 'Imported profile',
    keymaps,
    lighting: parseLighting(file.lighting, layout),
    macros: parseMacros(file.macros),
  }
}
