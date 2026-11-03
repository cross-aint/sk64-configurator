import type { Effect, Frame } from './effects'
import type { KeyboardLayout } from './layout'
import { TICKS_PER_SECOND, type Direction } from './presets'

// Key reactions: lighting that plays when a key is pressed.
//
// How the keyboard does it (confirmed on an SK64): a table with one byte per key slot names an
// entry in the same effect list the Fn + ] modes use, counting from 0 (0xFF = none). Pressing the
// key plays that effect, then the keyboard goes back to the first mode. So reaction animations sit
// after the user's modes in the list, and they also show up (looping) when stepping with Fn + ].
//
// Animations are drawn at fixed keys, so reactions centred on the pressed key (ripple, glow) need
// one effect per trigger key; whole-keyboard ones (flash, sweep) share one effect.
//
// Ending: in testing, reactions that ended on an all-dark frame went back to mode 1 afterwards,
// and ones that didn't kept repeating. So every reaction ends with one closing tick. A fully dark
// tick showed as a brief blank before mode 1 came back, so with the base / cutout styles the
// closing tick lights mode 1's colors (only the keys the reaction used are off).
//
// Styles (each key still has one color per animation):
//   dark   – the reaction in its color, every other key off
//   base   – keys outside the reaction's reach keep mode 1's painted colors (mode 1 must be a
//            Painted colors mode); keys inside its reach are off until the reaction passes
//   cutout – mode 1's painted colors stay lit and the reaction passes through as darkness

export type ReactionKind = 'ripple' | 'glow' | 'flash' | 'sweep'
export type ReactionStyle = 'dark' | 'base' | 'cutout'
/**
 * How a ripple spreads from the pressed key:
 *   circle     – a ring growing outwards
 *   vertical   – two vertical lines (the full height of the keyboard) moving left and right
 *   horizontal – two horizontal lines (whole rows) moving up and down
 *   line       – along the pressed key's row only, moving left and right
 */
export type RippleShape = 'circle' | 'vertical' | 'horizontal' | 'line'

export const RIPPLE_SHAPES: readonly { shape: RippleShape; name: string; description: string }[] = [
  { shape: 'circle', name: 'Circular', description: 'A ring growing outwards from the key' },
  { shape: 'vertical', name: 'Vertical', description: 'Two vertical lines moving apart, left and right' },
  { shape: 'horizontal', name: 'Horizontal', description: 'Two horizontal lines moving apart, up and down' },
  { shape: 'line', name: 'Line', description: 'Spreads left and right along the key’s own row' },
]

export type Reaction = {
  id: string
  kind: ReactionKind
  /** Keys that trigger it. */
  keys: readonly string[]
  color: string
  /** How long the animation lasts. */
  seconds: number
  /** Ripple: how far it spreads, in keys. */
  size: number
  /** Ripple: the shape it spreads in. */
  shape: RippleShape
  /** Sweep: which way it goes. */
  direction: Direction
  style: ReactionStyle
}

export const REACTION_KINDS: readonly { kind: ReactionKind; name: string; description: string; perKey: boolean }[] = [
  { kind: 'ripple', name: 'Ripple', description: 'A ring of light spreading out from the pressed key', perKey: true },
  { kind: 'glow', name: 'Key glow', description: 'The pressed key lights up for a moment', perKey: true },
  { kind: 'flash', name: 'Flash', description: 'The whole keyboard flashes once', perKey: false },
  { kind: 'sweep', name: 'Sweep', description: 'A bar of light sweeps across once', perKey: false },
]

export const REACTION_LIMITS = {
  seconds: { min: 0.2, max: 2 },
  size: { min: 1, max: 8 },
} as const

export function reactionName(kind: ReactionKind): string {
  return REACTION_KINDS.find((k) => k.kind === kind)?.name ?? kind
}

function isPerKey(kind: ReactionKind): boolean {
  return REACTION_KINDS.find((k) => k.kind === kind)?.perKey ?? false
}

export function newReaction(kind: ReactionKind, id: string): Reaction {
  return {
    id,
    kind,
    keys: [],
    color: { ripple: '#00c8ff', glow: '#ffffff', flash: '#ffffff', sweep: '#ff2fa0' }[kind],
    seconds: kind === 'glow' ? 0.4 : 0.6,
    size: 4,
    shape: 'circle',
    direction: 'right',
    style: 'dark',
  }
}

/** Whether a style can be used: base / cutout need mode 1 to be painted; base needs a reaction that leaves keys free. */
export function styleAvailable(kind: ReactionKind, style: ReactionStyle, hasPaintedBase: boolean): boolean {
  if (style === 'dark') return true
  if (!hasPaintedBase) return false
  return style === 'cutout' || kind === 'ripple' || kind === 'glow'
}

/** Effect slots a reaction takes: one per trigger key for ripple / glow, one in total otherwise. */
export function reactionSlots(reaction: Reaction): number {
  if (reaction.keys.length === 0) return 0
  return isPerKey(reaction.kind) ? reaction.keys.length : 1
}

/** The list name, e.g. "Ripple" or "Ripple · Vertical". */
export function reactionTitle(reaction: Reaction): string {
  if (reaction.kind !== 'ripple' || reaction.shape === 'circle') return reactionName(reaction.kind)
  return `${reactionName(reaction.kind)} · ${RIPPLE_SHAPES.find((s) => s.shape === reaction.shape)?.name ?? reaction.shape}`
}

/** Short summary for the list, e.g. "Enter, Space" or "26 keys". */
export function describeReaction(layout: KeyboardLayout, reaction: Reaction): string {
  if (reaction.keys.length === 0) return 'No keys yet'
  if (reaction.keys.length > 3) return `${reaction.keys.length} keys`
  return reaction.keys.map((id) => keyLabel(layout, id)).join(', ')
}

function keyLabel(layout: KeyboardLayout, id: string): string {
  const key = layout.keys.find((k) => k.id === id)
  return key ? key.label || key.name : id
}

const ticks = (seconds: number, steps: number) => Math.max(1, Math.round((seconds * TICKS_PER_SECOND) / steps))

/** Ends every reaction: one tick with only `keys` lit (see the note at the top). */
const endFrame = (keys: readonly string[] = []): Frame => ({ keys, hold: 1 })

/**
 * The animations for one reaction. Per-key reactions return one effect per trigger key (in the
 * order of `reaction.keys`); others return a single effect. `base` is mode 1's painted colors, used
 * by the base / cutout styles (without it they fall back to dark). `previewKey` draws a per-key
 * reaction around that key instead (for the on-screen preview before any key is chosen).
 */
export function reactionEffects(
  layout: KeyboardLayout,
  reaction: Reaction,
  base: Readonly<Record<string, string>> | null = null,
  previewKey?: string,
): Effect[] {
  const origins = isPerKey(reaction.kind) ? (previewKey ? [previewKey] : reaction.keys) : [null]
  return origins.map((origin) => styled(layout, reaction, movingFrames(layout, reaction, origin), base))
}

/** The reaction's own frames: which keys it lights at each step. */
function movingFrames(layout: KeyboardLayout, reaction: Reaction, origin: string | null): Frame[] {
  const all = layout.keys.map((k) => k.id)
  switch (reaction.kind) {
    case 'ripple':
      return ripple(layout, origin ?? 'g', reaction)
    case 'glow':
      return [{ keys: [origin ?? 'g'], hold: ticks(reaction.seconds, 1) }]
    case 'flash':
      return [{ keys: all, hold: ticks(reaction.seconds, 1) }]
    case 'sweep':
      return sweep(layout, reaction)
  }
}

/** Applies the style (dark / over base / cut out of base) and the closing tick. */
function styled(
  layout: KeyboardLayout,
  reaction: Reaction,
  frames: Frame[],
  base: Readonly<Record<string, string>> | null,
): Effect {
  const painted = base ? Object.keys(base).filter((id) => base[id].toLowerCase() !== '#000000') : []
  const style = base && styleAvailable(reaction.kind, reaction.style, true) ? reaction.style : 'dark'
  const baseGroups = (keys: readonly string[]) => {
    const byColor = new Map<string, string[]>()
    for (const id of keys) {
      const color = base?.[id]?.toLowerCase()
      if (color) byColor.set(color, [...(byColor.get(color) ?? []), id])
    }
    return [...byColor.entries()].map(([color, ids]) => ({ keys: ids, mode: { kind: 'fixed' as const, color } }))
  }
  const own = (keys: readonly string[]) => [{ keys: [...keys], mode: { kind: 'fixed' as const, color: reaction.color } }]

  if (style === 'cutout') {
    // Base stays lit; the reaction's keys go dark as it passes.
    const cut = frames.map((f) => {
      const off = new Set(f.keys)
      return { keys: painted.filter((id) => !off.has(id)), hold: f.hold }
    })
    return { kind: 'animated', frames: [...cut, endFrame(painted)], groups: baseGroups(painted) }
  }
  if (style === 'base') {
    // Keys the reaction ever reaches use its color; the rest keep the base colors throughout.
    const reach = new Set(frames.flatMap((f) => f.keys))
    const background = painted.filter((id) => !reach.has(id))
    return {
      kind: 'animated',
      frames: [...frames.map((f) => ({ keys: [...f.keys, ...background], hold: f.hold })), endFrame(background)],
      groups: [...own([...reach]), ...baseGroups(background)],
    }
  }
  return { kind: 'animated', frames: [...frames, endFrame()], groups: own(layout.keys.map((k) => k.id)) }
}

/**
 * The ripple's frames: keys lit at each step as it spreads from the origin, one key-width (or row)
 * per step, in the ripple's shape.
 */
function ripple(layout: KeyboardLayout, origin: string, reaction: Reaction): Frame[] {
  const from = layout.keys.find((k) => k.id === origin) ?? layout.keys[0]
  const steps: string[][] =
    reaction.shape === 'circle' ? circleRings(layout, from, reaction.size) : lineSteps(layout, from, reaction)
  // Drop empty steps at the end (e.g. a horizontal ripple can only travel a few rows).
  while (steps.length > 1 && steps[steps.length - 1].length === 0) steps.pop()
  const hold = ticks(reaction.seconds, steps.length)
  return steps.map((keys) => ({ keys, hold }))
}

type LayoutKey = KeyboardLayout['keys'][number]

/** Rings of keys around the origin, one key-width apart, growing outwards. */
function circleRings(layout: KeyboardLayout, from: LayoutKey, size: number): string[][] {
  const o = { x: from.x + from.w / 2, y: from.y }
  const rings: string[][] = Array.from({ length: size }, () => [])
  for (const k of layout.keys) {
    // Distance to the nearest point of the key, so wide keys join the ring as soon as it reaches them.
    const dx = Math.max(0, Math.abs(k.x + k.w / 2 - o.x) - k.w / 2)
    const dy = Math.max(0, Math.abs(k.y - o.y) - 0.5)
    const ring = k.id === from.id ? 0 : Math.ceil(Math.hypot(dx, dy) + 0.01)
    if (ring < rings.length) rings[ring].push(k.id)
  }
  return rings
}

/**
 * Vertical / horizontal / line ripples: lines moving apart from the origin. Each step lights the
 * keys under the lines, so a wide key (like Space) stays lit while a line crosses it.
 */
function lineSteps(layout: KeyboardLayout, from: LayoutKey, reaction: Reaction): string[][] {
  // Horizontal positions (in key widths) the lines are at: first the middle of each 1u cell of
  // the origin key, then one cell further out on each side per step.
  const columnsAt = (step: number): number[] => {
    if (step === 0) return Array.from({ length: Math.max(1, Math.round(from.w)) }, (_, i) => from.x + 0.5 + i)
    return [from.x + 0.5 - step, from.x + from.w - 0.5 + step]
  }
  const under = (k: LayoutKey, columns: number[]) => columns.some((p) => k.x <= p && p < k.x + k.w)
  if (reaction.shape === 'line') {
    // Along the row: one key further out on each side per step, whatever the key widths.
    const row = layout.keys.filter((k) => k.y === from.y).sort((a, b) => a.x - b.x)
    const at = row.findIndex((k) => k.id === from.id)
    return Array.from({ length: reaction.size }, (_, step) =>
      (step === 0 ? [row[at]] : [row[at - step], row[at + step]]).filter((k) => k !== undefined).map((k) => k.id),
    )
  }
  return Array.from({ length: reaction.size }, (_, step) => {
    const keys = layout.keys.filter((k) =>
      reaction.shape === 'horizontal' ? Math.abs(k.y - from.y) === step : k.id === from.id ? step === 0 : under(k, columnsAt(step)),
    )
    return keys.map((k) => k.id)
  })
}

/** A one-key-wide bar crossing the keyboard once. */
function sweep(layout: KeyboardLayout, reaction: Reaction): Frame[] {
  const horizontal = reaction.direction === 'right' || reaction.direction === 'left'
  const reversed = reaction.direction === 'left' || reaction.direction === 'up'
  const steps = horizontal ? layout.width : layout.height
  const hold = ticks(reaction.seconds, steps)
  return Array.from({ length: steps }, (_, i) => {
    const p = reversed ? steps - 1 - i : i
    const keys = layout.keys.filter((k) => (horizontal ? k.x < p + 1 && k.x + k.w > p : k.y === p)).map((k) => k.id)
    return { keys, hold }
  })
}

/**
 * The key-press table: one byte per key slot naming the effect (0-based, counting the modes
 * first) to play when the key is pressed, 0xFF = none.
 */
export function keyPressTable(
  layout: KeyboardLayout,
  firstEffect: number,
  reactions: readonly Reaction[],
  slotCount: number,
): Uint8Array {
  const table = new Uint8Array(slotCount).fill(0xff)
  let next = firstEffect
  for (const reaction of reactions) {
    if (reaction.keys.length === 0) continue
    const perKey = isPerKey(reaction.kind)
    reaction.keys.forEach((id, i) => {
      const key = layout.keys.find((k) => k.id === id)
      if (key && key.slot < slotCount) table[key.slot] = perKey ? next + i : next
    })
    next += reactionSlots(reaction)
  }
  return table
}

// ---- Reading saved reactions ----

const HEX = /^#[0-9a-f]{6}$/i
const clamp = (v: unknown, r: { min: number; max: number }, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(r.max, Math.max(r.min, v)) : fallback

export function parseReactions(raw: unknown, validKeyIds: ReadonlySet<string>, fnKeyId: string): Reaction[] {
  if (!Array.isArray(raw)) return []
  const used = new Set<string>()
  const out: Reaction[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const kind = REACTION_KINDS.find((k) => k.kind === o.kind)?.kind
    if (!kind) continue
    const base = newReaction(kind, typeof o.id === 'string' && o.id ? o.id : Math.random().toString(36).slice(2, 10))
    // Each key can trigger only one reaction; Fn can't trigger any.
    const keys = (Array.isArray(o.keys) ? o.keys : []).filter(
      (k): k is string => typeof k === 'string' && validKeyIds.has(k) && k !== fnKeyId && !used.has(k),
    )
    keys.forEach((k) => used.add(k))
    out.push({
      ...base,
      keys,
      color: typeof o.color === 'string' && HEX.test(o.color) ? o.color.toLowerCase() : base.color,
      seconds: clamp(o.seconds, REACTION_LIMITS.seconds, base.seconds),
      size: Math.round(clamp(o.size, REACTION_LIMITS.size, base.size)),
      shape: RIPPLE_SHAPES.find((sh) => sh.shape === o.shape)?.shape ?? base.shape,
      direction: (['right', 'left', 'down', 'up'] as const).find((d) => d === o.direction) ?? base.direction,
      style: (['dark', 'base', 'cutout'] as const).find((st) => st === o.style) ?? base.style,
    })
  }
  return out
}
