import { useCallback, useEffect, useState } from 'react'
import { isColor } from '../keyboard/lighting'

// The paint palette, like MS Paint: a row of default colors the user can change, and a row of
// empty slots for their own colors. Saved in this browser.

export const PALETTE_SIZE = 12

export const DEFAULT_COLORS: readonly string[] = [
  '#ff0000', '#ff7a00', '#ffd400', '#9dff00', '#00e05a', '#00ffc8',
  '#00c8ff', '#2050ff', '#8a2be2', '#ff00ff', '#ff2fa0', '#ffffff',
]

export type PaletteRow = 'colors' | 'custom'
export type SwatchRef = { row: PaletteRow; index: number }
export type Palette = Record<PaletteRow, (string | null)[]>

const STORAGE_KEY = 'sk64.palette.v1'

function fresh(): Palette {
  return { colors: [...DEFAULT_COLORS], custom: Array<string | null>(PALETTE_SIZE).fill(null) }
}

function load(): Palette {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fresh()
    const saved = JSON.parse(raw) as Partial<Palette>
    const read = (row: unknown, i: number) => {
      const value = Array.isArray(row) ? row[i] : undefined
      return isColor(value) ? value.toLowerCase() : null
    }
    return {
      colors: DEFAULT_COLORS.map((d, i) => read(saved.colors, i) ?? d),
      custom: Array.from({ length: PALETTE_SIZE }, (_, i) => read(saved.custom, i)),
    }
  } catch {
    return fresh()
  }
}

/** First palette slot holding this color, if any. */
export function findSwatch(palette: Palette, color: string): SwatchRef | null {
  const c = color.toLowerCase()
  for (const row of ['colors', 'custom'] as const) {
    const index = palette[row].indexOf(c)
    if (index >= 0) return { row, index }
  }
  return null
}

export function usePalette() {
  const [palette, setPalette] = useState<Palette>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(palette))
    } catch {
      // Storage unavailable; the palette just won't be remembered.
    }
  }, [palette])

  /** Sets a slot's color, or with null empties a custom slot. */
  const setSwatch = useCallback((ref: SwatchRef, color: string | null) => {
    if (ref.row === 'colors' && color === null) return
    setPalette((cur) => {
      const row = [...cur[ref.row]]
      row[ref.index] = color?.toLowerCase() ?? null
      return { ...cur, [ref.row]: row }
    })
  }, [])

  /** Puts a color in the first empty custom slot. When all are full, the oldest is dropped. */
  const addCustom = useCallback((color: string) => {
    setPalette((cur) => {
      const custom = [...cur.custom]
      const c = color.toLowerCase()
      const empty = custom.indexOf(null)
      if (empty >= 0) {
        custom[empty] = c
      } else {
        custom.shift()
        custom.push(c)
      }
      return { ...cur, custom }
    })
  }, [])

  const restoreDefaults = useCallback(() => setPalette((cur) => ({ ...cur, colors: [...DEFAULT_COLORS] })), [])

  return { palette, setSwatch, addCustom, restoreDefaults }
}
