import type { ChangeSheet, SheetMacro, SheetSection } from '../keyboard/changeSheet'
import type { KeyboardLayout } from '../keyboard/layout'

// Draws a change sheet (see keyboard/changeSheet.ts) as a picture: a header card, one card per
// changed layer (a keyboard with the remapped keys called out and a list of what changed), then a
// card of macros. Colors, fonts and keycap shapes come from the design tokens (styles/tokens.css),
// and the layout follows the app's: square tiles on the gray page, sunken boxes inside them, keycaps
// with a heavier bottom edge.

const WIDTH = 1200
const MARGIN = 32 // around the page
const CARD_PAD = 32 // inside each tile
const CARD_GAP = 16 // between tiles, as in the app
const INSET_PAD = 16 // inside sunken boxes within a tile
const KEY_EDGE = 3 // keycaps' heavier bottom edge, as on screen
const SCALE = 2 // draw at double resolution so the picture stays sharp

type Shape = { keyRadius: number; caseRadius: number; keyGap: number; casePad: number }

type Theme = Shape &
  Record<
    | 'bg'
    | 'surface'
    | 'sunken'
    | 'text'
    | 'muted'
    | 'border'
    | 'case'
    | 'key'
    | 'keyMod'
    | 'keyText'
    | 'keyBorder'
    | 'remapped'
    | 'remappedText'
    | 'font'
    | 'mono',
    string
  >

function readTheme(): Theme {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  const px = (name: string, fallback: number) => parseFloat(css.getPropertyValue(name)) || fallback
  return {
    keyRadius: px('--kb-radius', 2),
    caseRadius: px('--kb-case-radius', 4),
    keyGap: px('--kb-gap', 4),
    casePad: px('--kb-case-padding', 12),
    bg: v('--color-bg', '#f4f5f7'),
    surface: v('--color-surface', '#ffffff'),
    sunken: v('--color-surface-sunken', '#f1f3f5'),
    text: v('--color-text', '#16181d'),
    muted: v('--color-text-muted', '#6b7280'),
    border: v('--color-border', '#d0d4dc'),
    case: v('--kb-case', '#e9ecf1'),
    key: v('--kb-key', '#ffffff'),
    keyMod: v('--kb-key-mod', '#f4f4f4'),
    keyText: v('--kb-key-text', '#161616'),
    keyBorder: v('--kb-key-border', '#c9ccd4'),
    remapped: v('--kb-key-remapped', '#3b5bdb'),
    remappedText: v('--kb-key-remapped-text', '#2f4ac0'),
    font: v('--font-sans', 'system-ui, sans-serif'),
    mono: v('--font-mono', 'ui-monospace, monospace'),
  }
}

/** A horizontal span to draw into. */
type Box = { x: number; w: number }

/** Lays out top to bottom; measures on every pass but only paints when `paint` is set. */
class Painter {
  y = 0
  readonly ctx: CanvasRenderingContext2D
  readonly theme: Theme
  readonly paint: boolean

  constructor(ctx: CanvasRenderingContext2D, theme: Theme, paint: boolean, y = 0) {
    this.ctx = ctx
    this.theme = theme
    this.paint = paint
    this.y = y
  }

  font(size: number, weight = 400, family = this.theme.font) {
    this.ctx.font = `${weight} ${size}px ${family}`
  }

  text(s: string, x: number, y: number, color: string, maxWidth?: number) {
    if (!this.paint) return
    this.ctx.fillStyle = color
    this.ctx.fillText(maxWidth ? fit(this.ctx, s, maxWidth) : s, x, y)
  }

  /** Wraps text into lines no wider than `width`, at most `maxLines` (the last ends with …). */
  wrap(s: string, width: number, maxLines: number): string[] {
    const lines: string[] = []
    let line = ''
    for (const word of s.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (this.ctx.measureText(next).width <= width || !line) line = next
      else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines)
      kept[maxLines - 1] = fit(this.ctx, kept[maxLines - 1] + ' …', width, true)
      return kept
    }
    return lines.map((l) => fit(this.ctx, l, width))
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lineWidth = 1) {
    if (!this.paint) return
    const { ctx } = this
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.fillStyle = fill
    ctx.fill()
    if (stroke) {
      ctx.lineWidth = lineWidth
      ctx.strokeStyle = stroke
      ctx.stroke()
    }
  }

  /** A keycap like the on-screen keyboard's: a 1px edge with a heavier bottom edge. */
  keycap(x: number, y: number, w: number, h: number, fill: string, edge: string, edgeWidth = 1) {
    if (!this.paint) return
    const r = this.theme.keyRadius
    this.roundRect(x, y, w, h, r, edge)
    this.roundRect(x + edgeWidth, y + edgeWidth, w - edgeWidth * 2, h - edgeWidth - KEY_EDGE, Math.max(0, r - 1), fill)
  }

  /**
   * A padded box around whatever `body` draws: measured first, so the box is painted behind its
   * contents at the right height. `body` gets the inner span and draws through `current` (this
   * painter) from its `y` down. Call it on `current`.
   */
  container(box: Box, pad: number, style: { fill: string; stroke?: string; radius: number }, body: (inner: Box) => void) {
    const inner = { x: box.x + pad, w: box.w - pad * 2 }
    const start = this.y
    const measure = new Painter(this.ctx, this.theme, false, start + pad)
    measureWith(measure, inner, body)
    const height = measure.y - start + pad
    this.roundRect(box.x, start, box.w, height, style.radius, style.fill, style.stroke)
    this.y = start + pad
    body(inner)
    this.y = start + height
  }
}

// The body callbacks draw through whichever Painter is current; this lets `container` run them
// once to measure and once to paint.
let current: Painter
function measureWith(p: Painter, inner: Box, body: (inner: Box) => void) {
  const saved = current
  current = p
  body(inner)
  current = saved
}
function withPainter(p: Painter, fn: () => void) {
  const saved = current
  current = p
  fn()
  current = saved
}

/** Shortens text with … until it fits (`keepEnd` keeps a trailing … already there). */
function fit(ctx: CanvasRenderingContext2D, s: string, width: number, keepEnd = false): string {
  if (ctx.measureText(s).width <= width) return s
  let t = keepEnd ? s.replace(/ …$/, '') : s
  while (t.length > 1 && ctx.measureText(t + '…').width > width) t = t.slice(0, -1)
  return t + '…'
}

/** A tile on the page, like the app's: surface color, square corners, no border. */
function card(body: (inner: Box) => void) {
  const p = current
  const box = { x: MARGIN, w: WIDTH - MARGIN * 2 }
  p.container(box, CARD_PAD, { fill: p.theme.surface, radius: 0 }, (inner) => body(inner))
  current.y += CARD_GAP
}

/** A title (Carbon's light headings), and a muted line under it. */
function heading(inner: Box, title: string, subtitle: string, titleSize = 20) {
  const p = current
  p.font(titleSize, 400)
  p.text(title, inner.x, p.y + titleSize, p.theme.text, inner.w)
  p.font(14)
  p.text(subtitle, inner.x, p.y + titleSize + 24, p.theme.muted, inner.w)
  p.y += titleSize + 24 + 24
}

/** The picture's title block: the logo on the left, the setup's name, and a muted line under it. */
function titleBlock(inner: Box, title: string, subtitle: string, logo: CanvasImageSource | null) {
  const p = current
  const logoSize = 60
  const x = logo ? inner.x + logoSize + 20 : inner.x
  const w = inner.w - (x - inner.x)
  // The logo spans from the title's top to the subtitle's baseline.
  if (logo && p.paint) p.ctx.drawImage(logo, inner.x, p.y + 4, logoSize, logoSize)
  p.font(32, 400)
  p.text(title, x, p.y + 32, p.theme.text, w)
  p.font(14)
  p.text(subtitle, x, p.y + 64, p.theme.muted, w)
  p.y += 64 + 4
}

function keyboard(inner: Box, layout: KeyboardLayout, section: SheetSection) {
  const p = current
  const { casePad: pad, keyGap: gap, caseRadius } = p.theme
  const unit = (inner.w - pad * 2) / layout.width
  const height = layout.height * unit + pad * 2
  const top = p.y
  p.roundRect(inner.x, top, inner.w, height, caseRadius, p.theme.case)
  const changed = new Map(section.changes.map((c) => [c.id, c]))
  for (const k of layout.keys) {
    const x = inner.x + pad + k.x * unit + gap / 2
    const y = top + pad + k.y * unit + gap / 2
    const w = k.w * unit - gap
    const h = unit - gap
    const change = changed.get(k.id)
    // Remapped keys: accent edge plus a corner dot, as on screen (not color alone).
    p.keycap(x, y, w, h, k.w > 1 ? p.theme.keyMod : p.theme.key, change ? p.theme.remapped : p.theme.keyBorder, change ? 2 : 1)
    if (!p.paint) continue
    if (change) {
      p.ctx.beginPath()
      p.ctx.arc(x + w - 9, y + 9, 3, 0, Math.PI * 2)
      p.ctx.fillStyle = p.theme.remapped
      p.ctx.fill()
    }
    const label = change ? change.cap : k.label || k.name
    p.ctx.textAlign = 'center'
    p.ctx.textBaseline = 'middle'
    for (let size = change ? 15 : 12; size >= 9; size--) {
      p.font(size, change ? 600 : 400)
      if (p.ctx.measureText(label).width <= w - 12 || size === 9) break
    }
    p.text(label, x + w / 2, y + (h - KEY_EDGE) / 2 + 1, change ? p.theme.remappedText : p.theme.muted, w - 10)
    p.ctx.textAlign = 'left'
    p.ctx.textBaseline = 'alphabetic'
  }
  p.y = top + height + 24
}

function changeList(inner: Box, section: SheetSection) {
  const p = current
  p.container(inner, INSET_PAD, { fill: p.theme.sunken, radius: 0 }, (box) => {
    const q = current
    const columns = 2
    const colGap = 32
    const colWidth = (box.w - colGap * (columns - 1)) / columns
    const rowHeight = 32
    const capHeight = 24
    section.changes.forEach((c, i) => {
      const x = box.x + (i % columns) * (colWidth + colGap)
      const top = q.y + Math.floor(i / columns) * rowHeight
      // The key's name as a small keycap, like keys written in text in the app.
      q.font(12, 400, q.theme.mono)
      const capWidth = Math.min(Math.max(q.ctx.measureText(c.keyName).width + 14, 28), 140)
      q.keycap(x, top, capWidth, capHeight, q.theme.key, q.theme.keyBorder)
      if (q.paint) q.ctx.textAlign = 'center'
      q.text(c.keyName, x + capWidth / 2, top + 15, q.theme.keyText, capWidth - 8)
      if (q.paint) q.ctx.textAlign = 'left'
      q.font(14)
      const textX = x + capWidth + 12
      q.text(`${c.was ? `${c.was} ` : ''}→ ${c.name}`, textX, top + 16, q.theme.muted, colWidth - (textX - x))
    })
    q.y += Math.ceil(section.changes.length / columns) * rowHeight - (rowHeight - capHeight)
  })
}

function macroBox(inner: Box, m: SheetMacro) {
  const p = current
  p.container(inner, INSET_PAD, { fill: p.theme.sunken, radius: 0 }, (box) => {
    const q = current
    q.font(16, 600)
    q.text(`M${m.number}   ${m.name}`, box.x, q.y + 16, q.theme.text, box.w)
    q.font(14)
    q.text(`${m.plays} · ${m.keys.length ? m.keys.join(', ') : 'not on any key yet'}`, box.x, q.y + 38, q.theme.muted, box.w)
    q.y += 56
    q.font(14, 400, q.theme.mono)
    const lines = q.wrap(m.steps || '(no steps)', box.w, 3)
    lines.forEach((line, i) => q.text(line, box.x, q.y + 14 + i * 22, q.theme.text))
    q.y += lines.length * 22 - 4
  })
}

type Header = { title: string; date: string; credit: string; logo: CanvasImageSource | null }

function draw(sheet: ChangeSheet, layout: KeyboardLayout, { title, date, credit, logo }: Header) {
  const p = current
  p.y = MARGIN
  const layers = new Set(sheet.sections.map((s) => s.board)).size
  const summary = [
    `${layers} ${layers === 1 ? 'layer' : 'layers'} with remapped keys`,
    `${sheet.macros.length} ${sheet.macros.length === 1 ? 'macro' : 'macros'}`,
  ]

  card((inner) => titleBlock(inner, title, `${date} · ${summary.join(' · ')} · lighting not included`, logo))

  for (const section of sheet.sections) {
    card((inner) => {
      heading(inner, section.title, section.reach)
      keyboard(inner, layout, section)
      changeList(inner, section)
    })
  }

  if (sheet.macros.length > 0) {
    card((inner) => {
      heading(inner, 'Macros', 'Keys on the Windows, macOS and FNX layers can run these.')
      sheet.macros.forEach((m, i) => {
        if (i > 0) current.y += 8
        macroBox(inner, m)
      })
    })
  }

  const q = current
  q.font(12)
  if (q.paint) q.ctx.textAlign = 'center'
  q.text(credit, WIDTH / 2, q.y + 4, q.theme.muted)
  if (q.paint) q.ctx.textAlign = 'left'
  q.y += 4 + MARGIN
}

let logoLoad: Promise<HTMLImageElement | null> | undefined

/** The app's logo for the picture, loaded once; null if it can't be loaded (the picture goes without). */
export function loadLogo(): Promise<HTMLImageElement | null> {
  logoLoad ??= new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = `${import.meta.env.BASE_URL}logo.png`
  })
  return logoLoad
}

/**
 * Draws the sheet and returns the canvas. The header has the setup's name (with the logo on its
 * left, when given), and `credit` is the small line at the very bottom.
 */
export function renderChangeSheet(sheet: ChangeSheet, layout: KeyboardLayout, header: Header): HTMLCanvasElement {
  const theme = readTheme()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser can’t draw pictures.')

  // First pass: lay out to find the height. Second pass: paint.
  const measure = new Painter(ctx, theme, false)
  withPainter(measure, () => draw(sheet, layout, header))
  canvas.width = WIDTH * SCALE
  canvas.height = Math.ceil(measure.y) * SCALE

  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, WIDTH, measure.y)
  withPainter(new Painter(ctx, theme, true), () => draw(sheet, layout, header))
  return canvas
}
