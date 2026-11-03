import { encodeEffects } from './effects'
import type { KeyboardLayout } from './layout'
import { paintingsOf, parseColors, parseSlots, slotToEffect, type EffectSlot } from './presets'
import { keyPressTable, parseReactions, reactionEffects, reactionSlots as reactionSlotsOf, type Reaction } from './reactions'

// Lighting as the user edits it.
//
// builtin – the keyboard's own factory effects
// custom  – a list of modes (painted colors, waves, rain…) written to the keyboard's effect
//           slots in order (Fn + ] steps through them), plus key reactions: animations that play
//           when certain keys are pressed. Reaction animations go in the slots after the modes.

export type Lighting =
  | { kind: 'builtin' }
  | { kind: 'custom'; slots: readonly EffectSlot[]; reactions: readonly Reaction[] }

export const BUILTIN_LIGHTING: Lighting = { kind: 'builtin' }

const HEX = /^#[0-9a-f]{6}$/i

export function isColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

/**
 * Reads a hex color typed or pasted by the user: "#1e90ff", "1E90FF", "#fff" or "fff",
 * with surrounding spaces ignored. Returns it as "#rrggbb", or null if it isn't one.
 */
export function parseHexColor(text: string): string | null {
  const hex = text.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`
  if (/^[0-9a-f]{3}$/.test(hex)) return `#${[...hex].map((c) => c + c).join('')}`
  return null
}

/**
 * Reads saved lighting (browser storage or a profile file). Also accepts the older format,
 * `{ kind: 'custom', colors }`, which becomes a single painted-colors effect.
 */
export function parseLighting(raw: unknown, layout: KeyboardLayout): Lighting {
  if (!raw || typeof raw !== 'object') return BUILTIN_LIGHTING
  const o = raw as Record<string, unknown>
  if (o.kind !== 'custom') return BUILTIN_LIGHTING
  const validIds = new Set(layout.keys.map((k) => k.id))
  if (!('slots' in o) && 'colors' in o) {
    return {
      kind: 'custom',
      slots: [{ id: 'painted', kind: 'paint', colors: parseColors(o.colors, validIds) }],
      reactions: [],
    }
  }
  return {
    kind: 'custom',
    slots: parseSlots(o.slots, validIds),
    reactions: parseReactions(o.reactions, validIds, layout.fnKeyId),
  }
}

/** Same lighting on the keyboard? Ids are ignored; they only matter to the editor. */
export function sameLighting(a: Lighting, b: Lighting): boolean {
  return canonical(a) === canonical(b)
}

function canonical(lighting: Lighting): string {
  if (lighting.kind === 'builtin') return 'builtin'
  const strip = <T extends { id: string }>(items: readonly T[]) => items.map(({ id: _id, ...rest }) => sortKeys(rest))
  return JSON.stringify({ slots: strip(lighting.slots), reactions: strip(lighting.reactions) })
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, typeof v === 'string' ? v.toLowerCase() : sortKeys(v)]),
    )
  }
  return value
}

/**
 * Builds the lighting block for a layer: the modes, then the reaction animations. Null means the
 * built-in effects (also when there are no modes; reactions need a mode to return to).
 */
export function toLightingBlock(layout: KeyboardLayout, lighting: Lighting): Uint8Array | null {
  if (lighting.kind === 'builtin' || lighting.slots.length === 0) return null
  const paintings = paintingsOf(lighting.slots)
  const base = baseColors(lighting)
  return encodeEffects(layout, [
    ...lighting.slots.map((slot) => slotToEffect(layout, slot, paintings)),
    ...lighting.reactions.flatMap((reaction) => reactionEffects(layout, reaction, base)),
  ])
}

/** Mode 1's colors when it's a Painted colors mode: the base reactions can keep lit. */
export function baseColors(lighting: Lighting): Readonly<Record<string, string>> | null {
  if (lighting.kind !== 'custom') return null
  const first = lighting.slots[0]
  return first?.kind === 'paint' ? first.colors : null
}

/** The key-press table for the reactions, or null when there are none to write. */
export function toKeyPressTable(layout: KeyboardLayout, lighting: Lighting, slotCount: number): Uint8Array | null {
  if (lighting.kind === 'builtin' || lighting.slots.length === 0) return null
  if (!lighting.reactions.some((r) => r.keys.length > 0)) return null
  return keyPressTable(layout, lighting.slots.length, lighting.reactions, slotCount)
}

/** Effect slots used by the modes and reactions together. */
export function slotsUsed(lighting: Lighting): number {
  if (lighting.kind === 'builtin') return 0
  return lighting.slots.length + lighting.reactions.reduce((n, r) => n + reactionSlotsOf(r), 0)
}
