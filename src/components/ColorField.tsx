import { useRef, useState, type CSSProperties } from 'react'
import { parseHexColor } from '../keyboard/lighting'

/**
 * Text box for typing or pasting a hex code. The color updates as soon as the text is a valid
 * color; anything invalid is flagged and dropped when the box loses focus.
 */
export function HexInput({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  const [text, setText] = useState<string | null>(null) // null = not editing, show `color`
  const shown = text ?? color.toUpperCase()
  const invalid = text !== null && parseHexColor(text) === null

  return (
    <input
      className="paint-hex"
      type="text"
      value={shown}
      spellCheck={false}
      autoComplete="off"
      maxLength={9}
      aria-label="Hex color code"
      aria-invalid={invalid || undefined}
      title="Type or paste a hex code, like #1E90FF"
      onFocus={(e) => {
        setText(color.toUpperCase())
        e.target.select()
      }}
      onChange={(e) => {
        setText(e.target.value)
        const parsed = parseHexColor(e.target.value)
        if (parsed) onChange(parsed)
      }}
      onBlur={() => setText(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
      }}
    />
  )
}

/** A color chip that opens the system color picker, next to an editable hex code. */
export function ColorField({ label, color, onChange }: { label: string; color: string; onChange: (color: string) => void }) {
  const picker = useRef<HTMLInputElement>(null)
  const open = () => {
    const input = picker.current
    if (!input) return
    input.value = color
    try {
      input.showPicker()
    } catch {
      input.click()
    }
  }
  return (
    <div className="color-field">
      <button
        type="button"
        className="color-field-chip"
        style={{ '--swatch': color } as CSSProperties}
        aria-label={`${label}: choose a color`}
        onClick={open}
      />
      <HexInput color={color} onChange={onChange} />
      <input
        ref={picker}
        type="color"
        className="paint-picker"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
