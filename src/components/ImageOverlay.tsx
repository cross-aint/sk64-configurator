import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { transformAround, type ImageTransform } from '../keyboard/imageSampling'
import type { KeyboardLayout } from '../keyboard/layout'

type Props = {
  layout: KeyboardLayout
  src: string
  /** Image height / width. */
  aspect: number
  transform: ImageTransform
  onChange: (change: (t: ImageTransform) => ImageTransform) => void
}

type Point = { x: number; y: number }

/** A pointer position in plate widths, relative to the plate's top-left corner. */
function localPoint(el: HTMLElement, clientX: number, clientY: number): Point {
  const r = el.getBoundingClientRect()
  return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.width }
}

/**
 * Picture laid over the keyboard plate, with key outlines on top so it's clear what lands on
 * each key. Drag to move, scroll or pinch to zoom, Shift + scroll or twist to rotate.
 * Keyboard: arrows move, + / − zoom, [ / ] rotate (Shift for bigger steps).
 */
export function ImageOverlay({ layout, src, aspect, transform: t, onChange }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const pointers = useRef(new Map<number, Point>())

  // Track the plate's width so the picture is drawn at the right size.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Wheel needs a non-passive listener so the page doesn't scroll while zooming.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = localPoint(el, e.clientX, e.clientY)
      const delta = e.deltaY || e.deltaX
      if (e.shiftKey) onChange((cur) => transformAround(cur, p, 1, delta > 0 ? 5 : -5))
      else onChange((cur) => transformAround(cur, p, Math.exp(-delta * 0.0015)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onChange])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, localPoint(e.currentTarget, e.clientX, e.clientY))
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointers.current
    const prev = map.get(e.pointerId)
    if (!prev) return
    const next = localPoint(e.currentTarget, e.clientX, e.clientY)
    map.set(e.pointerId, next)

    if (map.size === 1) {
      onChange((cur) => ({ ...cur, cx: cur.cx + next.x - prev.x, cy: cur.cy + next.y - prev.y }))
      return
    }
    // Two fingers: move with their midpoint, zoom with their distance, rotate with their angle.
    const other = [...map].find(([id]) => id !== e.pointerId)?.[1]
    if (!other) return
    const before = Math.hypot(prev.x - other.x, prev.y - other.y)
    const after = Math.hypot(next.x - other.x, next.y - other.y)
    if (before === 0) return
    let turn = Math.atan2(next.y - other.y, next.x - other.x) - Math.atan2(prev.y - other.y, prev.x - other.x)
    if (turn > Math.PI) turn -= 2 * Math.PI
    if (turn < -Math.PI) turn += 2 * Math.PI
    const mid0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 }
    const mid1 = { x: (next.x + other.x) / 2, y: (next.y + other.y) / 2 }
    onChange((cur) =>
      transformAround(
        { ...cur, cx: cur.cx + mid1.x - mid0.x, cy: cur.cy + mid1.y - mid0.y },
        mid1,
        after / before,
        (turn * 180) / Math.PI,
      ),
    )
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01
    const center = (cur: ImageTransform) => ({ x: cur.cx, y: cur.cy })
    const actions: Record<string, (cur: ImageTransform) => ImageTransform> = {
      ArrowLeft: (cur) => ({ ...cur, cx: cur.cx - step }),
      ArrowRight: (cur) => ({ ...cur, cx: cur.cx + step }),
      ArrowUp: (cur) => ({ ...cur, cy: cur.cy - step }),
      ArrowDown: (cur) => ({ ...cur, cy: cur.cy + step }),
      '+': (cur) => transformAround(cur, center(cur), 1.1),
      '=': (cur) => transformAround(cur, center(cur), 1.1),
      '-': (cur) => transformAround(cur, center(cur), 1 / 1.1),
      '[': (cur) => transformAround(cur, center(cur), 1, e.shiftKey ? -15 : -1),
      ']': (cur) => transformAround(cur, center(cur), 1, e.shiftKey ? 15 : 1),
      '{': (cur) => transformAround(cur, center(cur), 1, -15),
      '}': (cur) => transformAround(cur, center(cur), 1, 15),
    }
    const action = actions[e.key]
    if (!action) return
    e.preventDefault()
    onChange(action)
  }

  return (
    <div
      ref={box}
      className="kb-image"
      tabIndex={0}
      role="application"
      aria-label="Picture position. Drag to move, scroll to zoom, Shift and scroll to rotate. Arrow keys move, plus and minus zoom, brackets rotate."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
    >
      {width > 0 && (
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            left: t.cx * width,
            top: t.cy * width,
            width: t.scale * width,
            height: t.scale * width * aspect,
            transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`,
          }}
        />
      )}
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none" aria-hidden>
        {layout.keys.map((k) => (
          <rect key={k.id} x={k.x + 0.05} y={k.y + 0.05} width={k.w - 0.1} height={0.9} rx={0.08} />
        ))}
      </svg>
    </div>
  )
}
