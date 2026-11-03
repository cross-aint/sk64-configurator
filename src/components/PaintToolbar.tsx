import { useRef, type CSSProperties } from 'react'
import { findSwatch, type Palette, type SwatchRef } from '../hooks/usePalette'
import { HexInput } from './ColorField'

export type PaintTool = 'paint' | 'erase' | 'pick'

type Props = {
  /** Colors of the painted-colors effect being edited. */
  colors: Readonly<Record<string, string>>
  keyCount: number
  color: string
  tool: PaintTool
  palette: Palette
  onColorChange: (color: string) => void
  onToolChange: (tool: PaintTool) => void
  onSwatchChange: (ref: SwatchRef, color: string | null) => void
  onAddCustom: (color: string) => void
  onRestoreDefaults: () => void
  onFillAll: () => void
  onClearAll: () => void
  /** A picture file was chosen to color the keys from. */
  onImportImage: (file: File) => void
}

/** What the color picker is currently editing: just the brush color, or a palette slot. */
type EditTarget = 'current' | SwatchRef

/**
 * Controls for a painted-colors effect, shown above the keyboard: the paint tools and an
 * MS Paint style palette (a row of default colors and a row of custom slots).
 */
export function PaintToolbar(props: Props) {
  const { colors, keyCount, color, tool, palette, onColorChange, onToolChange, onSwatchChange } = props
  const picker = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const editTarget = useRef<EditTarget>('current')
  const litCount = Object.keys(colors).length
  const match = findSwatch(palette, color)

  const openPicker = (target: EditTarget, start: string) => {
    const input = picker.current
    if (!input) return
    editTarget.current = target
    input.value = start
    try {
      input.showPicker()
    } catch {
      input.click()
    }
  }

  const onPicked = (value: string) => {
    const target = editTarget.current
    if (target !== 'current') onSwatchChange(target, value)
    onColorChange(value)
    onToolChange('paint')
  }

  const choose = (value: string) => {
    onColorChange(value)
    onToolChange('paint')
  }

  const swatch = (row: 'colors' | 'custom', value: string | null, index: number) => {
    const ref = { row, index }
    if (value === null) {
      return (
        <button
          key={index}
          type="button"
          className="swatch"
          data-empty
          aria-label="Empty slot: add a color"
          title="Add a color"
          onClick={() => openPicker(ref, color)}
        >
          +
        </button>
      )
    }
    const active = tool === 'paint' && match?.row === row && match.index === index
    return (
      <button
        key={index}
        type="button"
        className="swatch"
        style={{ '--swatch': value } as CSSProperties}
        aria-label={`Use ${value.toUpperCase()}`}
        title={`${value.toUpperCase()} (double-click to change)`}
        aria-pressed={active}
        onClick={() => choose(value)}
        onDoubleClick={() => openPicker(ref, value)}
      />
    )
  }

  return (
    <div className="paint">
      <div className="paint-row">
        <div className="segmented" role="radiogroup" aria-label="Tool">
          <button type="button" role="radio" aria-checked={tool === 'paint'} onClick={() => onToolChange('paint')}>
            Brush
          </button>
          <button type="button" role="radio" aria-checked={tool === 'erase'} onClick={() => onToolChange('erase')}>
            Eraser
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={tool === 'pick'}
            title="Click a key to use its color"
            onClick={() => onToolChange('pick')}
          >
            Pick color
          </button>
        </div>
        <div className="paint-actions">
          <button className="secondary small" onClick={props.onFillAll}>Fill all</button>
          <button className="secondary small" onClick={props.onClearAll}>Clear all</button>
          <button className="secondary small" onClick={() => imageInput.current?.click()}>
            Import picture…
          </button>
          <input
            ref={imageInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = '' // so choosing the same file again still triggers
              if (file) props.onImportImage(file)
            }}
          />
          <span className="muted paint-count">
            {litCount} / {keyCount} lit
          </span>
        </div>
      </div>

      <div className="paint-row paint-colors">
        <div className="paint-current" data-erasing={tool === 'erase' || undefined}>
          <button
            type="button"
            className="paint-current-chip"
            style={{ '--swatch': color } as CSSProperties}
            aria-label="Choose a color"
            title="Choose a color"
            onClick={() => openPicker('current', color)}
          />
          <label className="paint-current-text">
            <span className="muted">{tool === 'erase' ? 'Eraser' : 'Brush color'}</span>
            <HexInput color={color} onChange={choose} />
          </label>
          <input
            ref={picker}
            type="color"
            className="paint-picker"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => onPicked(e.target.value)}
          />
        </div>

        <div className="palette">
          <div className="palette-row" role="group" aria-label="Colors">
            {palette.colors.map((c, i) => swatch('colors', c, i))}
          </div>
          <div className="palette-row" role="group" aria-label="Custom colors">
            {palette.custom.map((c, i) => swatch('custom', c, i))}
          </div>
        </div>

        <div className="palette-actions">
          {match ? (
            <button className="link" onClick={() => openPicker(match, color)}>Change this color</button>
          ) : (
            <button className="link" onClick={() => props.onAddCustom(color)}>Add to custom colors</button>
          )}
          {match?.row === 'custom' && (
            <button className="link" onClick={() => onSwatchChange(match, null)}>Remove from palette</button>
          )}
          <button className="link muted-link" onClick={props.onRestoreDefaults}>Restore default colors</button>
        </div>
      </div>
    </div>
  )
}
