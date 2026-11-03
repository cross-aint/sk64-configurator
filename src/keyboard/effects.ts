import type { KeyboardLayout } from './layout'

// Lighting effects and how they're encoded for the firmware (format from GK6X's SetLighting).
//
// A layer's lighting block starts with a table of 32 effect slots, 16 bytes each:
//   int32 data offset, int32 data count, int32 params offset, int32 params count (-1 = empty).
// Fn + ] steps through the filled slots. Effect data follows the table.
//
// Static effect (type 0): one data entry
//   uint16 type, uint16 704, then a uint32 color per LED (176 LEDs).
//
// Animated effect (type 3): one data entry per frame tick, then one param entry per key group
//   frame: uint16 type, uint16 22, 22-byte bit mask of the LEDs that are on (bit n = LED n)
//   param: uint8 color mode, uint8 32 (entry size), 22-byte LED mask, uint32 color,
//          uint16 value 1, uint16 value 2
// Frames only switch LEDs on and off; colors come from the params.
//
// Colors are stored as bytes [R, G, B, A]. Static colors use A = 0xFF for lit; params use A = 0.

export const MAX_EFFECTS = 32
/**
 * Most color groups an animated effect gets. Skyloong's own effects never use more than 30; with
 * more (e.g. one group per color of a colorful painting), keys in the later groups lit up white
 * on an SK64. Effects over the limit get their closest colors merged (see fitGroups).
 */
export const MAX_GROUPS = 30
const SLOT_SIZE = 16
const LED_COUNT = 176
const MASK_BYTES = LED_COUNT / 8
const STATIC_TYPE = 0
const ANIMATED_TYPE = 3
const STATIC_BYTES = LED_COUNT * 4
const PARAM_BYTES = 32

/**
 * How a group of keys is colored in an animated effect. `step` and `hold` are the raw values
 * the keyboard receives (Skyloong's own effects use step 18 for rainbow, 5 / 5 for breathing).
 *   fixed     – one solid color
 *   rainbow   – cycles through the spectrum, starting at `color`; step = hue change per tick
 *   breathing – fades in and out; step = brightness change per tick, hold = ticks held at full
 */
export type ColorMode =
  | { kind: 'fixed'; color: string }
  | { kind: 'rainbow'; color: string; step: number }
  | { kind: 'breathing'; color: string; step: number; hold: number }

export type Frame = {
  /** Keys lit in this frame. */
  keys: readonly string[]
  /** How many ticks the frame is shown (at least 1). */
  hold: number
}

export type Effect =
  | { kind: 'static'; colors: Readonly<Record<string, string>> }
  | { kind: 'animated'; frames: readonly Frame[]; groups: readonly { keys: readonly string[]; mode: ColorMode }[] }

const MODE_CODE = { fixed: 0, rainbow: 1, breathing: 2 } as const

type Group = { keys: readonly string[]; mode: ColorMode }

/**
 * Keeps an animated effect within MAX_GROUPS color groups by repeatedly merging the two closest
 * colors (of the same kind and timing). The merged color is the average, weighted by key count.
 */
export function fitGroups(effect: Effect): Effect {
  if (effect.kind !== 'animated' || effect.groups.length <= MAX_GROUPS) return effect
  const groups: Group[] = effect.groups.map((g) => ({ keys: [...g.keys], mode: g.mode }))
  const sameTiming = (a: ColorMode, b: ColorMode) =>
    a.kind === b.kind &&
    (a.kind === 'fixed' ||
      (a.kind === 'rainbow' && b.kind === 'rainbow' && a.step === b.step) ||
      (a.kind === 'breathing' && b.kind === 'breathing' && a.step === b.step && a.hold === b.hold))
  const rgb = (m: ColorMode) => hexToRgb(m.color) ?? [0, 0, 0]
  while (groups.length > MAX_GROUPS) {
    let best: [number, number] | null = null
    let bestDistance = Infinity
    for (let i = 0; i < groups.length; i++) {
      const a = rgb(groups[i].mode)
      for (let j = i + 1; j < groups.length; j++) {
        if (!sameTiming(groups[i].mode, groups[j].mode)) continue
        const b = rgb(groups[j].mode)
        const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
        if (d < bestDistance) {
          bestDistance = d
          best = [i, j]
        }
      }
    }
    if (!best) break // nothing left that can be merged
    const [i, j] = best
    const [a, b] = [groups[i], groups[j]]
    const wa = a.keys.length || 1
    const wb = b.keys.length || 1
    const [ra, ga, ba] = rgb(a.mode)
    const [rb, gb, bb] = rgb(b.mode)
    const color =
      '#' +
      [(ra * wa + rb * wb) / (wa + wb), (ga * wa + gb * wb) / (wa + wb), (ba * wa + bb * wb) / (wa + wb)]
        .map((v) => Math.round(v).toString(16).padStart(2, '0'))
        .join('')
    groups[i] = { keys: [...a.keys, ...b.keys], mode: { ...a.mode, color } }
    groups.splice(j, 1)
  }
  return { ...effect, groups }
}

/** Encodes up to 32 effects into a layer's lighting block. */
export function encodeEffects(layout: KeyboardLayout, input: readonly Effect[]): Uint8Array {
  const effects = input.map(fitGroups)
  if (effects.length === 0) throw new Error('Nothing to write: add at least one effect.')
  if (effects.length > MAX_EFFECTS) throw new Error(`The keyboard holds at most ${MAX_EFFECTS} effects.`)
  const ledsById = new Map(layout.keys.map((k) => [k.id, [k.led, ...(k.extraLeds ?? [])]]))
  const ledsOf = (keyIds: readonly string[]) => keyIds.flatMap((id) => ledsById.get(id) ?? [])

  const table = new Uint8Array(MAX_EFFECTS * SLOT_SIZE)
  const tableView = new DataView(table.buffer)
  const parts: Uint8Array[] = [table]
  let size = table.length

  const append = (bytes: Uint8Array) => {
    parts.push(bytes)
    size += bytes.length
  }

  for (let slot = 0; slot < MAX_EFFECTS; slot++) {
    const effect = effects[slot]
    let entry = [-1, -1, -1, -1]
    if (effect?.kind === 'static') {
      entry = [size, 1, 0, 0]
      append(staticEntry(layout, effect.colors))
    } else if (effect?.kind === 'animated') {
      const framesAt = size
      let ticks = 0
      for (const frame of effect.frames) {
        const entryBytes = frameEntry(ledsOf(frame.keys))
        for (let i = 0; i < Math.max(1, Math.floor(frame.hold)); i++) {
          append(entryBytes)
          ticks++
        }
      }
      const paramsAt = size
      for (const group of effect.groups) append(paramEntry(ledsOf(group.keys), group.mode))
      entry = [framesAt, ticks, paramsAt, effect.groups.length]
    }
    entry.forEach((v, i) => tableView.setInt32(slot * SLOT_SIZE + i * 4, v, true))
  }

  const block = new Uint8Array(size)
  let at = 0
  for (const part of parts) {
    block.set(part, at)
    at += part.length
  }
  return block
}

function staticEntry(layout: KeyboardLayout, colors: Readonly<Record<string, string>>): Uint8Array {
  const bytes = new Uint8Array(4 + STATIC_BYTES)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, STATIC_TYPE, true)
  view.setUint16(2, STATIC_BYTES, true)
  for (const key of layout.keys) {
    const rgb = hexToRgb(colors[key.id])
    if (!rgb || (rgb[0] === 0 && rgb[1] === 0 && rgb[2] === 0)) continue // black = off
    for (const led of [key.led, ...(key.extraLeds ?? [])]) {
      if (led < LED_COUNT) bytes.set([...rgb, 0xff], 4 + led * 4)
    }
  }
  return bytes
}

function frameEntry(leds: number[]): Uint8Array {
  const bytes = new Uint8Array(4 + MASK_BYTES)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, ANIMATED_TYPE, true)
  view.setUint16(2, MASK_BYTES, true)
  bytes.set(ledMask(leds), 4)
  return bytes
}

function paramEntry(leds: number[], mode: ColorMode): Uint8Array {
  const bytes = new Uint8Array(PARAM_BYTES)
  const view = new DataView(bytes.buffer)
  bytes[0] = MODE_CODE[mode.kind]
  bytes[1] = PARAM_BYTES
  bytes.set(ledMask(leds), 2)
  bytes.set([...(hexToRgb(mode.color) ?? [0, 0, 0]), 0], 2 + MASK_BYTES)
  const value1 = mode.kind === 'fixed' ? 0 : mode.step
  const value2 = mode.kind === 'breathing' ? mode.hold : 0
  view.setUint16(2 + MASK_BYTES + 4, value1, true)
  view.setUint16(2 + MASK_BYTES + 6, value2, true)
  return bytes
}

function ledMask(leds: number[]): Uint8Array {
  const mask = new Uint8Array(MASK_BYTES)
  for (const led of leds) if (led >= 0 && led < LED_COUNT) mask[led >> 3] |= 1 << (led & 7)
  return mask
}

function hexToRgb(color: string | undefined): [number, number, number] | null {
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return null
  const n = parseInt(color.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}
