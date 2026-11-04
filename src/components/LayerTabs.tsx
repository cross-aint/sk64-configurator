import type { LayerName } from '../keyboard/keymap'
import { ChoiceLabel } from './controls'

type Props = {
  layer: LayerName
  onChange: (layer: LayerName) => void
  /** Number of changed keys per table, shown as a count. */
  counts: Record<LayerName, number>
}

const TABS: { id: LayerName; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'fn', label: 'Fn held' },
]

/** Switches between what keys do normally and while Fn is held, on the current keyboard layer. */
export function LayerTabs({ layer, onChange, counts }: Props) {
  return (
    <div className="segmented" role="tablist" aria-label="Normal or with Fn held">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={layer === tab.id}
          onClick={() => onChange(tab.id)}
        >
          <ChoiceLabel text={tab.label} />
          {counts[tab.id] > 0 && <span className="tag count">{counts[tab.id]}</span>}
        </button>
      ))}
    </div>
  )
}
