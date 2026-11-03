import { fitGroups, type ColorMode, type Effect } from './effects'

// Simulates an effect for the on-screen preview, from the same data that's written to the
// keyboard. Frames and fixed colors are exact. Rainbow and breathing are approximations: the
// keyboard's exact curves aren't known, so the preview just cycles at a similar pace.

export type PreviewTimeline = {
  /** Ticks before the frame sequence repeats. */
  length: number
  colorsAt: (tick: number) => Record<string, string>
}

export function buildPreview(input: Effect): PreviewTimeline {
  // Same group merging as when writing, so the preview shows the colors the keyboard will.
  const effect = fitGroups(input)
  if (effect.kind === 'static') {
    const colors = { ...effect.colors }
    return { length: 1, colorsAt: () => colors }
  }

  const ticks: (readonly string[])[] = []
  for (const frame of effect.frames) {
    for (let i = 0; i < Math.max(1, Math.floor(frame.hold)); i++) ticks.push(frame.keys)
  }
  const modeByKey = new Map<string, ColorMode>()
  for (const group of effect.groups) {
    for (const id of group.keys) if (!modeByKey.has(id)) modeByKey.set(id, group.mode)
  }

  return {
    length: Math.max(1, ticks.length),
    colorsAt: (tick) => {
      const lit = ticks.length ? ticks[tick % ticks.length] : []
      const colors: Record<string, string> = {}
      for (const id of lit) {
        const mode = modeByKey.get(id)
        if (mode) colors[id] = colorAt(mode, tick)
      }
      return colors
    },
  }
}

function colorAt(mode: ColorMode, tick: number): string {
  switch (mode.kind) {
    case 'fixed':
      return mode.color
    case 'rainbow':
      return rotateHue(mode.color, mode.step * tick)
    case 'breathing': {
      // Brightness 0 → 100 in steps, held, then back down.
      const ramp = Math.max(1, Math.ceil(100 / Math.max(1, mode.step)))
      const cycle = ramp * 2 + mode.hold
      const t = tick % cycle
      const level = t < ramp ? t / ramp : t < ramp + mode.hold ? 1 : 1 - (t - ramp - mode.hold) / ramp
      return scale(mode.color, level)
    }
  }
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function toHex(rgb: number[]): string {
  return '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

function scale(hex: string, level: number): string {
  return toHex(toRgb(hex).map((v) => v * level))
}

function rotateHue(hex: string, degrees: number): string {
  const [r, g, b] = toRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  const hue = (((h * 60 + degrees) % 360) + 360) % 360
  const s = max === 0 ? 0 : d / max
  const f = (n: number) => {
    const k = (n + hue / 60) % 6
    return 255 * max * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)))
  }
  return toHex([f(5), f(3), f(1)])
}
