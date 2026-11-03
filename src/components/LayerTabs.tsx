import type { LayerName } from '../keyboard/keymap'

type Props = {
  layer: LayerName
  onChange: (layer: LayerName) => void
  /** Number of changed keys per layer, shown as a count. */
  counts: Record<LayerName, number>
}

const TABS: { id: LayerName; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'fn', label: 'Fn layer' },
]

/** Switches which layer the keyboard view shows and edits. */
export function LayerTabs({ layer, onChange, counts }: Props) {
  return (
    <div className="segmented" role="tablist" aria-label="Layer">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={layer === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {counts[tab.id] > 0 && <span className="count">{counts[tab.id]}</span>}
        </button>
      ))}
    </div>
  )
}
