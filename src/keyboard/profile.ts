import type { Keymap, LayerName } from './keymap'
import type { KeyboardLayout } from './layout'
import { parseLighting, type Lighting } from './lighting'

// Profile files: a readable JSON snapshot of a keymap and lighting that people can save and share.

const APP_ID = 'sk64-configurator'

// Version 2 stores lighting as a list of effects. Version 1 stored one set of per-key colors
// (`lighting: { kind: 'custom', colors }`) and is still read.
const VERSION = 2

type ProfileFile = {
  app: typeof APP_ID
  version: 1 | 2
  layout: string
  name: string
  layers: Record<LayerName, Record<string, string>>
  /** Optional: the oldest files have no lighting. */
  lighting?: unknown
}

export type Profile = { name: string; keymap: Keymap; lighting: Lighting }

const toHex = (v: number) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0')

export function exportProfile(layout: KeyboardLayout, profile: Profile): string {
  const { keymap, lighting } = profile
  const file: ProfileFile = {
    app: APP_ID,
    version: VERSION,
    layout: layout.name,
    name: profile.name,
    layers: {
      normal: Object.fromEntries(Object.entries(keymap.normal).map(([id, v]) => [id, toHex(v)])),
      fn: Object.fromEntries(Object.entries(keymap.fn).map(([id, v]) => [id, toHex(v)])),
    },
    lighting,
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
  if (file.version !== 1 && file.version !== 2) {
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

  return {
    name: typeof file.name === 'string' ? file.name : 'Imported profile',
    keymap: { normal: parseLayer(file.layers?.normal), fn: parseLayer(file.layers?.fn) },
    lighting: parseLighting(file.lighting, layout),
  }
}
