import { useEffect, useMemo, useState } from 'react'
import type { Effect } from '../keyboard/effects'
import { TICKS_PER_SECOND } from '../keyboard/presets'
import { buildPreview } from '../keyboard/preview'

/** What to show between runs of the effect, like the keyboard does after a key reaction. */
export type PreviewRest = { colors: Readonly<Record<string, string>>; ticks: number }

/**
 * Plays an effect on the on-screen keyboard at the keyboard's default speed. Returns the
 * current key colors, or null when there's nothing to play. With `rest`, each run is followed by
 * those colors for a while (e.g. mode 1 between key reactions).
 */
export function useEffectPreview(effect: Effect | null, rest: PreviewRest | null = null): Record<string, string> | null {
  const timeline = useMemo(() => (effect ? buildPreview(effect) : null), [effect])
  const [tick, setTick] = useState(0)
  const animated = effect?.kind === 'animated'

  useEffect(() => {
    if (!animated) return
    const timer = setInterval(() => setTick((t) => t + 1), 1000 / TICKS_PER_SECOND)
    return () => clearInterval(timer)
  }, [animated])

  if (!timeline) return null
  if (!rest) return timeline.colorsAt(tick)
  const cycle = timeline.length + rest.ticks
  const t = tick % cycle
  return t < timeline.length ? timeline.colorsAt(t) : { ...rest.colors }
}
