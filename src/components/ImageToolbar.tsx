import { withRotation, withScale, type ImageTransform } from '../keyboard/imageSampling'
import { ChoiceLabel } from './controls'
import { rangeFill } from './rangeFill'

export type ImageView = 'picture' | 'result'

type Props = {
  name: string
  transform: ImageTransform
  /** The scale that just covers the keyboard (= 100% zoom). */
  fitScale: number
  view: ImageView
  onViewChange: (view: ImageView) => void
  onChange: (change: (t: ImageTransform) => ImageTransform) => void
  onFit: () => void
  onCancel: () => void
  onConfirm: () => void
}

/** Controls shown above the keyboard while a picture is being positioned. */
export function ImageToolbar(props: Props) {
  const { name, transform: t, fitScale, view, onViewChange, onChange } = props
  const zoom = Math.round((t.scale / fitScale) * 100)
  const rotation = Math.round(t.rotation)

  return (
    <div className="settings-box paint">
      <div className="paint-row">
        <div className="segmented" role="radiogroup" aria-label="Show">
          <button type="button" role="radio" aria-checked={view === 'picture'} onClick={() => onViewChange('picture')}>
            <ChoiceLabel text="Picture" />
          </button>
          <button type="button" role="radio" aria-checked={view === 'result'} onClick={() => onViewChange('result')}>
            <ChoiceLabel text="Result" />
          </button>
        </div>
        <span className="image-name" title={name}>
          {name}
        </span>
        <span className="spacer" />
        <button className="secondary small" onClick={props.onCancel}>Cancel</button>
        <button className="small" onClick={props.onConfirm}>Use these colors</button>
      </div>

      <div className="paint-row paint-colors image-controls">
        <div className="image-control" role="group" aria-label="Zoom">
          <span className="muted">Zoom</span>
          <button
            type="button"
            className="secondary small icon"
            aria-label="Zoom out"
            onClick={() => onChange((cur) => withScale(cur, cur.scale / 1.1))}
          >
            −
          </button>
          <input
            type="range"
            aria-label="Zoom"
            min={10}
            max={500}
            value={Math.min(500, Math.max(10, zoom))}
            style={rangeFill(zoom, 10, 500)}
            onChange={(e) => onChange((cur) => withScale(cur, (fitScale * Number(e.target.value)) / 100))}
          />
          <button
            type="button"
            className="secondary small icon"
            aria-label="Zoom in"
            onClick={() => onChange((cur) => withScale(cur, cur.scale * 1.1))}
          >
            +
          </button>
          <output>{zoom}%</output>
        </div>

        <div className="image-control" role="group" aria-label="Rotate">
          <span className="muted">Rotate</span>
          <button
            type="button"
            className="secondary small icon"
            aria-label="Rotate 90° left"
            onClick={() => onChange((cur) => withRotation(cur, cur.rotation - 90))}
          >
            ↺
          </button>
          <input
            type="range"
            aria-label="Rotation"
            min={-180}
            max={180}
            value={rotation}
            style={rangeFill(rotation, -180, 180)}
            onChange={(e) => onChange((cur) => withRotation(cur, Number(e.target.value)))}
          />
          <button
            type="button"
            className="secondary small icon"
            aria-label="Rotate 90° right"
            onClick={() => onChange((cur) => withRotation(cur, cur.rotation + 90))}
          >
            ↻
          </button>
          <output>{rotation}°</output>
        </div>

        <button className="link" onClick={props.onFit}>Fit to keyboard</button>
      </div>
    </div>
  )
}
