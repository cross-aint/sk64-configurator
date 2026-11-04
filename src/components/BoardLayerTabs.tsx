import { BOARD_LAYERS, type BoardLayer } from '../keyboard/keymap'
import { ChoiceLabel } from './controls'

type Props = {
  board: BoardLayer
  onChange: (board: BoardLayer) => void
  /** Number of remapped keys per keyboard layer, shown as a count. */
  counts: Record<BoardLayer, number>
}

/** How to reach each layer, short enough for a tab. */
const HINTS: Record<BoardLayer, string> = { base: '', windows: 'Fn + W', mac: 'Fn + E', fnx: 'hold FNX' }

/** Line tabs for the keyboard layer being edited (base, or the on-board Fn + W / E and FNX layers). */
export function BoardLayerTabs({ board, onChange, counts }: Props) {
  return (
    <div className="line-tabs" role="tablist" aria-label="Keyboard layer">
      {BOARD_LAYERS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="tab"
          aria-selected={board === l.id}
          title={l.reach[0].toUpperCase() + l.reach.slice(1)}
          onClick={() => onChange(l.id)}
        >
          <ChoiceLabel text={l.name} />
          {HINTS[l.id] && <span className="tab-hint">{HINTS[l.id]}</span>}
          {counts[l.id] > 0 && <span className="tag count">{counts[l.id]}</span>}
        </button>
      ))}
    </div>
  )
}
