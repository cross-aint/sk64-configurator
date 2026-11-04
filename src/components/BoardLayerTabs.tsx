import { BOARD_LAYERS, type BoardLayer } from '../keyboard/keymap'

type Props = {
  board: BoardLayer
  onChange: (board: BoardLayer) => void
  /** Number of remapped keys per keyboard layer, shown as a count. */
  counts: Record<BoardLayer, number>
}

/** Switches which keyboard layer (base, or the on-board Fn + W / E / R layers) is shown and edited. */
export function BoardLayerTabs({ board, onChange, counts }: Props) {
  return (
    <div className="segmented" role="tablist" aria-label="Keyboard layer">
      {BOARD_LAYERS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="tab"
          aria-selected={board === l.id}
          title={l.reach[0].toUpperCase() + l.reach.slice(1)}
          onClick={() => onChange(l.id)}
        >
          {l.name}
          {counts[l.id] > 0 && <span className="count">{counts[l.id]}</span>}
        </button>
      ))}
    </div>
  )
}
