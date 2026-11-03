import { useEffect, type RefObject } from 'react'

/** Closes a <details> menu when clicking outside it or pressing Escape. */
export function useCloseOnOutside(ref: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const menu = ref.current
      if (menu?.open && !menu.contains(e.target as Node)) menu.open = false
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const menu = ref.current
      if (e.key !== 'Escape' || !menu?.open) return
      menu.open = false
      menu.querySelector('summary')?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ref])
}
