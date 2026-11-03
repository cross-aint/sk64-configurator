import type { ColorMode, Effect, Frame } from './effects'
import type { KeyboardLayout } from './layout'

// The lighting modes a user can add, described at the level they edit them (direction, speed,
// color style…), and the generators that turn each one into frames and color groups.
//
// Timing: at the keyboard's default speed it plays about 15 ticks per second (measured on an
// SK64). Fn + ← / → on the keyboard then makes every mode slower or faster.
//
// Limits of the format: each key has one color for the whole mode, and frames only switch keys on
// and off. So a moving bar can't change a key's color; instead, modes can borrow per-key colors
// from a Painted colors mode (spotlight, dark bar, painted rain, breathing painting) and keep
// other keys lit as a painted background.

export const TICKS_PER_SECOND = 15
/**
 * Most modes the app lets you add, to keep Fn + ] easy to step through. Key reactions don't count
 * toward it; they use the rest of the keyboard's 32 effect slots (tested on an SK64 with firmware
 * v2.101, about 23 KB).
 */
export const MAX_MODES = 10

export type Direction = 'right' | 'left' | 'down' | 'up'
/**
 * solid     – one color
 * spectrum  – a rainbow spread across the keyboard, left to right
 * rainbow   – every key cycles through the rainbow over time
 * breathing – one color fading in and out
 * painted   – each key's color from a Painted colors mode
 */
export type ColorStyle = 'solid' | 'spectrum' | 'rainbow' | 'breathing' | 'painted'
export type Speed = 'slow' | 'normal' | 'fast'

type Base = { id: string }

/** Which keys an animated mode moves over, and what the rest do. */
type AreaOptions = {
  /** Keys the animation uses; null = all keys. */
  keys: readonly string[] | null
  /** Painted colors mode to borrow colors from (for the painted style and the background). */
  paintFrom: string | null
  /** Keep keys outside the area lit with their painted colors (only with chosen keys). */
  background: boolean
}

export type PaintSlot = Base & { kind: 'paint'; colors: Readonly<Record<string, string>> }
export type WaveSlot = Base &
  AreaOptions & {
    kind: 'wave'
    direction: Direction
    /** Bar thickness in keys. */
    width: number
    /** Time for one sweep at the keyboard's default speed. */
    seconds: number
    style: ColorStyle
    color: string
    /** The bar turns keys off instead of on. */
    dark: boolean
  }
export type RainSlot = Base &
  AreaOptions & {
    kind: 'rain'
    dropsPerSecond: number
    /** Time for a drop to fall from the top row to the bottom. */
    seconds: number
    style: ColorStyle
    color: string
    /** Seeds the random drop pattern, so the same settings always give the same rain. */
    seed: number
    /** Drops turn keys off instead of on. */
    dark: boolean
  }
export type BreathingSlot = Base & {
  kind: 'breathing'
  style: 'solid' | 'painted'
  color: string
  paintFrom: string | null
  speed: Speed
}
export type RainbowSlot = Base & { kind: 'rainbow'; speed: Speed }
export type EffectSlot = PaintSlot | WaveSlot | RainSlot | BreathingSlot | RainbowSlot
export type EffectKind = EffectSlot['kind']

/** Painted colors modes by id, in list order (the first one is the default to borrow from). */
export type Paintings = ReadonlyMap<string, Readonly<Record<string, string>>>

export const EFFECT_KINDS: readonly { kind: EffectKind; name: string; description: string }[] = [
  { kind: 'paint', name: 'Painted colors', description: 'Your own color on each key' },
  { kind: 'wave', name: 'Wave', description: 'A bar of light sweeping across the keys' },
  { kind: 'rain', name: 'Rain', description: 'Drops of light falling down the keys' },
  { kind: 'breathing', name: 'Breathing', description: 'Keys slowly fading in and out' },
  { kind: 'rainbow', name: 'Rainbow', description: 'Every key cycling through the rainbow' },
]

export const LIMITS = {
  waveWidth: { min: 1, max: 4 },
  waveSeconds: { min: 0.3, max: 6 },
  rainSeconds: { min: 0.3, max: 3 },
  dropsPerSecond: { min: 1, max: 20 },
} as const

// Raw values the keyboard receives for rainbow / breathing. "normal" matches Skyloong's own modes.
const RAINBOW_STEP: Record<Speed, number> = { slow: 6, normal: 18, fast: 36 }
const BREATHING_STEP: Record<Speed, number> = { slow: 2, normal: 5, fast: 10 }
const BREATHING_HOLD = 5
/** Rain repeats after this long, at least one drop's fall. */
const RAIN_LOOP_SECONDS = 4

export function effectName(kind: EffectKind): string {
  return EFFECT_KINDS.find((k) => k.kind === kind)?.name ?? kind
}

export function newSlotId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const NO_AREA: AreaOptions = { keys: null, paintFrom: null, background: false }

export function newSlot(kind: EffectKind, id = newSlotId()): EffectSlot {
  switch (kind) {
    case 'paint':
      return { id, kind, colors: {} }
    case 'wave':
      return { id, kind, ...NO_AREA, direction: 'right', width: 1, seconds: 1, style: 'spectrum', color: '#00c8ff', dark: false }
    case 'rain':
      return { id, kind, ...NO_AREA, dropsPerSecond: 6, seconds: 0.8, style: 'solid', color: '#00c8ff', seed: randomSeed(), dark: false }
    case 'breathing':
      return { id, kind, style: 'solid', color: '#00c8ff', paintFrom: null, speed: 'normal' }
    case 'rainbow':
      return { id, kind, speed: 'normal' }
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}

/** The Painted colors modes in a list, by id. */
export function paintingsOf(slots: readonly EffectSlot[]): Paintings {
  return new Map(slots.flatMap((s) => (s.kind === 'paint' ? [[s.id, s.colors] as const] : [])))
}

/** Short summary for the mode list, e.g. "→ · 1.0 s · dark". */
export function describeSlot(layout: KeyboardLayout, slot: EffectSlot): string {
  const arrows: Record<Direction, string> = { right: '→', left: '←', down: '↓', up: '↑' }
  switch (slot.kind) {
    case 'paint':
      return `${Object.keys(slot.colors).length} keys lit`
    case 'wave':
      return [arrows[slot.direction], `${actualSeconds(layout, slot).toFixed(1)} s`, slot.dark ? 'dark' : null]
        .filter(Boolean)
        .join(' · ')
    case 'rain':
      return [`${slot.dropsPerSecond} drops/s`, slot.dark ? 'dark' : null].filter(Boolean).join(' · ')
    case 'breathing':
      return [speedName(slot.speed), slot.style === 'painted' ? 'painted' : null].filter(Boolean).join(' · ')
    case 'rainbow':
      return speedName(slot.speed)
  }
}

export function speedName(speed: Speed): string {
  return { slow: 'Slow', normal: 'Normal', fast: 'Fast' }[speed]
}

/** The sweep/fall time the keyboard will actually use (frames are whole ticks). */
export function actualSeconds(layout: KeyboardLayout, slot: WaveSlot | RainSlot): number {
  if (slot.kind === 'wave') {
    const steps = slot.direction === 'right' || slot.direction === 'left' ? layout.width : layout.height
    return (steps * holdFor(slot.seconds, steps)) / TICKS_PER_SECOND
  }
  return (rowTicks(layout, slot.seconds) * layout.height) / TICKS_PER_SECOND
}

function holdFor(seconds: number, steps: number): number {
  return Math.max(1, Math.round((seconds * TICKS_PER_SECOND) / steps))
}

function rowTicks(layout: KeyboardLayout, seconds: number): number {
  return Math.max(1, Math.round((seconds * TICKS_PER_SECOND) / layout.height))
}

// ---- Generators ----

type Group = { keys: string[]; mode: ColorMode }

/** The painting a mode borrows from: the chosen one, else the first in the list, else none. */
function paintingFor(paintFrom: string | null, paintings: Paintings): Readonly<Record<string, string>> {
  return (paintFrom ? paintings.get(paintFrom) : undefined) ?? paintings.values().next().value ?? {}
}

/** Keys with a visible painted color (black counts as off). */
function paintedKeys(painting: Readonly<Record<string, string>>): string[] {
  return Object.entries(painting)
    .filter(([, c]) => c.toLowerCase() !== '#000000')
    .map(([id]) => id)
}

/** One group per distinct color, so each key keeps its own painted color. */
function groupsByColor(keys: readonly string[], painting: Readonly<Record<string, string>>, mode: (c: string) => ColorMode) {
  const byColor = new Map<string, string[]>()
  for (const id of keys) {
    const color = painting[id]?.toLowerCase()
    if (color) byColor.set(color, [...(byColor.get(color) ?? []), id])
  }
  return [...byColor.entries()].map(([color, ids]) => ({ keys: ids, mode: mode(color) }))
}

/** Turns a mode as the user describes it into what the keyboard plays. */
export function slotToEffect(layout: KeyboardLayout, slot: EffectSlot, paintings: Paintings = new Map()): Effect {
  const all = layout.keys.map((k) => k.id)
  switch (slot.kind) {
    case 'paint':
      return { kind: 'static', colors: slot.colors }
    case 'wave':
    case 'rain': {
      const painting = paintingFor(slot.paintFrom, paintings)
      const chosen = slot.keys ? new Set(slot.keys) : null
      const area = chosen ? all.filter((id) => chosen.has(id)) : all
      const inArea = new Set(area)
      const painted = paintedKeys(painting)
      const hasPaint = new Set(painted)
      // Keys the animation can light: with painted colors, only keys that have one.
      const lit = slot.style === 'painted' ? area.filter((id) => hasPaint.has(id)) : area
      const background = slot.background && chosen ? painted.filter((id) => !inArea.has(id)) : []
      const groups: Group[] = [
        ...colorGroups(layout, lit, slot.style, slot.color, painting),
        ...groupsByColor(background, painting, (color) => ({ kind: 'fixed', color })),
      ]
      const moving = slot.kind === 'wave' ? waveSteps(layout, slot) : rainSteps(layout, slot)
      const frames = moving.map(({ keys, hold }) => {
        const inStep = new Set(keys)
        const on = slot.dark ? lit.filter((id) => !inStep.has(id)) : lit.filter((id) => inStep.has(id))
        return { keys: [...on, ...background], hold }
      })
      return { kind: 'animated', frames, groups }
    }
    case 'breathing': {
      const mode = (color: string): ColorMode => ({
        kind: 'breathing',
        color,
        step: BREATHING_STEP[slot.speed],
        hold: BREATHING_HOLD,
      })
      if (slot.style === 'painted') {
        const painting = paintingFor(slot.paintFrom, paintings)
        const keys = paintedKeys(painting)
        return { kind: 'animated', frames: [{ keys, hold: 1 }], groups: groupsByColor(keys, painting, mode) }
      }
      return { kind: 'animated', frames: [{ keys: all, hold: 1 }], groups: [{ keys: all, mode: mode(slot.color) }] }
    }
    case 'rainbow':
      return {
        kind: 'animated',
        frames: [{ keys: all, hold: 1 }],
        groups: [{ keys: all, mode: { kind: 'rainbow', color: '#ff0000', step: RAINBOW_STEP[slot.speed] } }],
      }
  }
}

function colorGroups(
  layout: KeyboardLayout,
  keys: readonly string[],
  style: ColorStyle,
  color: string,
  painting: Readonly<Record<string, string>>,
): Group[] {
  if (keys.length === 0) return []
  switch (style) {
    case 'solid':
      return [{ keys: [...keys], mode: { kind: 'fixed', color } }]
    case 'rainbow':
      return [{ keys: [...keys], mode: { kind: 'rainbow', color: '#ff0000', step: RAINBOW_STEP.normal } }]
    case 'breathing':
      return [{ keys: [...keys], mode: { kind: 'breathing', color, step: BREATHING_STEP.normal, hold: BREATHING_HOLD } }]
    case 'painted':
      return groupsByColor(keys, painting, (c) => ({ kind: 'fixed', color: c }))
    case 'spectrum': {
      // One group per key-width column, colored by its position from red to violet.
      const wanted = new Set(keys)
      const byColumn = new Map<number, string[]>()
      for (const key of layout.keys) {
        if (!wanted.has(key.id)) continue
        const column = Math.min(layout.width - 1, Math.floor(key.x + key.w / 2))
        byColumn.set(column, [...(byColumn.get(column) ?? []), key.id])
      }
      return [...byColumn.entries()]
        .sort(([a], [b]) => a - b)
        .map(([column, ids]) => ({ keys: ids, mode: { kind: 'fixed', color: hueToHex((column / layout.width) * 300) } }))
    }
  }
}

/** The bar's keys at each step of the sweep (over the whole keyboard). */
function waveSteps(layout: KeyboardLayout, slot: WaveSlot): Frame[] {
  const horizontal = slot.direction === 'right' || slot.direction === 'left'
  const reversed = slot.direction === 'left' || slot.direction === 'up'
  const steps = horizontal ? layout.width : layout.height
  const hold = holdFor(slot.seconds, steps)
  const frames: Frame[] = []
  for (let i = 0; i < steps; i++) {
    const p = reversed ? steps - 1 - i : i
    // The bar covers positions [from, to], trailing behind the direction of travel.
    const from = reversed ? p : p - slot.width + 1
    const to = reversed ? p + slot.width - 1 : p
    const keys = layout.keys
      .filter((k) => (horizontal ? k.x < to + 1 && k.x + k.w > from : k.y >= from && k.y <= to))
      .map((k) => k.id)
    frames.push({ keys, hold })
  }
  return frames
}

/** The keys under a falling drop at each tick (over the whole keyboard). */
function rainSteps(layout: KeyboardLayout, slot: RainSlot): Frame[] {
  const perRow = rowTicks(layout, slot.seconds)
  const life = perRow * layout.height
  const loop = Math.max(life, Math.round(RAIN_LOOP_SECONDS * TICKS_PER_SECOND))
  const random = mulberry32(slot.seed)
  const count = Math.max(1, Math.round((slot.dropsPerSecond * loop) / TICKS_PER_SECOND))
  const drops = Array.from({ length: count }, () => ({
    column: Math.floor(random() * layout.width),
    start: Math.floor(random() * loop),
  }))
  // The key under the middle of a column cell in a row.
  const keyAt = (column: number, row: number) =>
    layout.keys.find((k) => k.y === row && k.x <= column + 0.5 && k.x + k.w > column + 0.5)?.id

  const frames: Frame[] = []
  for (let t = 0; t < loop; t++) {
    const lit = new Set<string>()
    for (const drop of drops) {
      const age = (t - drop.start + loop) % loop
      if (age >= life) continue
      const id = keyAt(drop.column, Math.floor(age / perRow))
      if (id) lit.add(id)
    }
    frames.push({ keys: [...lit], hold: 1 })
  }
  return frames
}

/** Small seeded random number generator (0 ≤ n < 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hueToHex(hue: number): string {
  const f = (n: number) => {
    const k = (n + hue / 60) % 6
    return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))))
  }
  return '#' + [f(5), f(3), f(1)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

// ---- Reading saved modes (browser storage, profile files) ----

const HEX = /^#[0-9a-f]{6}$/i
const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)
const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback
const clamp = (v: unknown, range: { min: number; max: number }, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(range.max, Math.max(range.min, v)) : fallback

/** Reads a saved list of modes, dropping anything malformed and clamping values to range. */
export function parseSlots(raw: unknown, validKeyIds: ReadonlySet<string>): EffectSlot[] {
  if (!Array.isArray(raw)) return []
  const slots: EffectSlot[] = []
  for (const item of raw.slice(0, MAX_MODES)) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id ? o.id : newSlotId()
    const color = isHex(o.color) ? o.color.toLowerCase() : '#00c8ff'
    const style = pick(o.style, ['solid', 'spectrum', 'rainbow', 'breathing', 'painted'] as const, 'solid')
    const speed = pick(o.speed, ['slow', 'normal', 'fast'] as const, 'normal')
    const paintFrom = typeof o.paintFrom === 'string' ? o.paintFrom : null
    const area: AreaOptions = {
      keys: Array.isArray(o.keys) ? o.keys.filter((k): k is string => typeof k === 'string' && validKeyIds.has(k)) : null,
      paintFrom,
      background: o.background === true,
    }
    switch (o.kind) {
      case 'paint':
        slots.push({ id, kind: 'paint', colors: parseColors(o.colors, validKeyIds) })
        break
      case 'wave':
        slots.push({
          id,
          kind: 'wave',
          ...area,
          direction: pick(o.direction, ['right', 'left', 'down', 'up'] as const, 'right'),
          width: Math.round(clamp(o.width, LIMITS.waveWidth, 1)),
          seconds: clamp(o.seconds, LIMITS.waveSeconds, 1),
          style,
          color,
          dark: o.dark === true,
        })
        break
      case 'rain':
        slots.push({
          id,
          kind: 'rain',
          ...area,
          dropsPerSecond: Math.round(clamp(o.dropsPerSecond, LIMITS.dropsPerSecond, 6)),
          seconds: clamp(o.seconds, LIMITS.rainSeconds, 0.8),
          style,
          color,
          seed: typeof o.seed === 'number' && Number.isInteger(o.seed) ? o.seed : randomSeed(),
          dark: o.dark === true,
        })
        break
      case 'breathing':
        slots.push({ id, kind: 'breathing', style: o.style === 'painted' ? 'painted' : 'solid', color, paintFrom, speed })
        break
      case 'rainbow':
        slots.push({ id, kind: 'rainbow', speed })
        break
    }
  }
  return slots
}

/** Per-key colors, keeping only known keys and valid "#rrggbb" values. */
export function parseColors(raw: unknown, validKeyIds: ReadonlySet<string>): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([id, c]) => validKeyIds.has(id) && isHex(c))
      .map(([id, c]) => [id, (c as string).toLowerCase()]),
  )
}
