import type { KeyboardLayout } from './layout'

// Coloring keys from a picture placed over the keyboard.
//
// Placement is stored relative to the keyboard plate, with every length measured in plate
// widths (so it doesn't change when the window is resized): the image's center (cx, cy),
// its displayed width (scale), and its rotation in degrees, clockwise.

export type ImageTransform = { cx: number; cy: number; scale: number; rotation: number }

const MIN_SCALE = 0.05
const MAX_SCALE = 40

/** Placement that just covers the whole keyboard, centered and unrotated. */
export function coverTransform(layout: KeyboardLayout, imageWidth: number, imageHeight: number): ImageTransform {
  const plateAspect = layout.width / layout.height
  const imageAspect = imageWidth / imageHeight
  return {
    cx: 0.5,
    cy: layout.height / layout.width / 2,
    scale: imageAspect > plateAspect ? imageAspect / plateAspect : 1,
    rotation: 0,
  }
}

/** Zooms by `factor` and rotates by `degrees` around a pivot point (in plate widths). */
export function transformAround(
  t: ImageTransform,
  pivot: { x: number; y: number },
  factor = 1,
  degrees = 0,
): ImageTransform {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * factor))
  const k = scale / t.scale
  const rad = (degrees * Math.PI) / 180
  const dx = t.cx - pivot.x
  const dy = t.cy - pivot.y
  return {
    cx: pivot.x + k * (dx * Math.cos(rad) - dy * Math.sin(rad)),
    cy: pivot.y + k * (dx * Math.sin(rad) + dy * Math.cos(rad)),
    scale,
    rotation: normalizeDegrees(t.rotation + degrees),
  }
}

/** Sets an absolute zoom (scale) or rotation, keeping the image's center where it is. */
export function withScale(t: ImageTransform, scale: number): ImageTransform {
  return { ...t, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)) }
}

export function withRotation(t: ImageTransform, degrees: number): ImageTransform {
  return { ...t, rotation: normalizeDegrees(degrees) }
}

/** -180 < degrees <= 180 */
export function normalizeDegrees(degrees: number): number {
  const d = ((degrees % 360) + 360) % 360
  return d > 180 ? d - 360 : d
}

/** Pixels per key unit in the sampling canvas. Plenty for averaging a keycap's area. */
const UNIT_PX = 40
/** Keycap edge left out of sampling (key units), so neighbouring colors don't bleed in. */
const INSET = 0.1

/**
 * Renders the placed image at keyboard size and averages the color under each key.
 * Keys mostly not covered by the image (or over transparent parts) are left out, i.e. unlit.
 */
export function sampleKeyColors(
  layout: KeyboardLayout,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  t: ImageTransform,
): Record<string, string> {
  const width = layout.width * UNIT_PX
  const height = layout.height * UNIT_PX
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('This browser can’t read pictures.')

  ctx.imageSmoothingQuality = 'high'
  ctx.translate(t.cx * width, t.cy * width)
  ctx.rotate((t.rotation * Math.PI) / 180)
  const w = t.scale * width
  const h = (w * imageHeight) / imageWidth
  ctx.drawImage(image, -w / 2, -h / 2, w, h)
  const pixels = ctx.getImageData(0, 0, width, height).data

  const colors: Record<string, string> = {}
  for (const key of layout.keys) {
    const x0 = Math.round((key.x + INSET) * UNIT_PX)
    const x1 = Math.round((key.x + key.w - INSET) * UNIT_PX)
    const y0 = Math.round((key.y + INSET) * UNIT_PX)
    const y1 = Math.round((key.y + 1 - INSET) * UNIT_PX)
    let r = 0
    let g = 0
    let b = 0
    let alpha = 0
    let count = 0
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4
        const a = pixels[i + 3]
        r += pixels[i] * a
        g += pixels[i + 1] * a
        b += pixels[i + 2] * a
        alpha += a
        count++
      }
    }
    if (count === 0 || alpha / (count * 255) < 0.5) continue
    colors[key.id] = toHex(r / alpha, g / alpha, b / alpha)
  }
  return colors
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}
