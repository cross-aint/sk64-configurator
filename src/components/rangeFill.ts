import type { CSSProperties } from 'react'

/** Paints the part of a range track left of the thumb (read by the range styles in index.css). */
export function rangeFill(value: number, min: number, max: number): CSSProperties {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0
  return { '--fill': `${Math.min(100, Math.max(0, fill))}%` } as CSSProperties
}
