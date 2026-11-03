import { useEffect, useMemo, useState } from 'react'
import type { KeyboardLayout } from '../keyboard/layout'

/**
 * While enabled, listens to physical key presses and reports which layout keys are held
 * down right now and which have been pressed at least once. Presses are swallowed so that
 * Tab, Space, arrows etc. don't move focus or scroll the page during the test.
 *
 * Fn never reaches the computer, but Fn + a number key sends F1–F12, which the SK64 can't
 * produce any other way — so an F-key lights up both Fn and that number key.
 */
export function useKeyTester(layout: KeyboardLayout, enabled: boolean) {
  const [held, setHeld] = useState<ReadonlySet<string>>(new Set())
  const [tested, setTested] = useState<ReadonlySet<string>>(new Set())

  // Browser key code -> layout keys it lights up.
  const idsByCode = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const key of layout.keys) {
      if (key.code) map.set(key.code, [key.id])
      if (key.fnCode) map.set(key.fnCode, [layout.fnKeyId, key.id])
    }
    return map
  }, [layout])

  const testableCount = useMemo(() => new Set([...idsByCode.values()].flat()).size, [idsByCode])

  useEffect(() => {
    if (!enabled) return
    const onDown = (e: KeyboardEvent) => {
      const ids = idsByCode.get(e.code)
      if (!ids) return
      e.preventDefault()
      setHeld((prev) => new Set([...prev, ...ids]))
      setTested((prev) => (ids.every((id) => prev.has(id)) ? prev : new Set([...prev, ...ids])))
    }
    const onUp = (e: KeyboardEvent) => {
      const ids = idsByCode.get(e.code)
      if (!ids) return
      e.preventDefault()
      setHeld((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }
    // Releasing keys while the window is in the background never fires keyup.
    const onBlur = () => setHeld(new Set())
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
      setHeld(new Set())
    }
  }, [enabled, idsByCode])

  const reset = () => setTested(new Set())

  return { held, tested, testableCount, reset }
}
