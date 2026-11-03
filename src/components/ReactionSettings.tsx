import type { KeyboardLayout } from '../keyboard/layout'
import type { Direction } from '../keyboard/presets'
import {
  describeReaction,
  REACTION_KINDS,
  REACTION_LIMITS,
  RIPPLE_SHAPES,
  styleAvailable,
  type Reaction,
  type ReactionStyle,
} from '../keyboard/reactions'
import { ColorField } from './ColorField'
import { Segmented, Setting } from './controls'

type Props = {
  layout: KeyboardLayout
  reaction: Reaction
  /** A message about the last key click (e.g. no slots left), or null. */
  notice: string | null
  /** Mode 1 is a Painted colors mode, so reactions can keep its colors lit. */
  hasPaintedBase: boolean
  onChange: (change: (r: Reaction) => Reaction) => void
}

const DIRECTIONS: { value: Direction; label: string; name: string }[] = [
  { value: 'right', label: '→', name: 'Left to right' },
  { value: 'left', label: '←', name: 'Right to left' },
  { value: 'down', label: '↓', name: 'Top to bottom' },
  { value: 'up', label: '↑', name: 'Bottom to top' },
]

/** Settings for a key reaction. Trigger keys are chosen by clicking the on-screen keyboard. */
export function ReactionSettings({ layout, reaction, notice, hasPaintedBase, onChange }: Props) {
  const set = (patch: Partial<Reaction>) => onChange((r) => ({ ...r, ...patch }))
  const perKey = REACTION_KINDS.find((k) => k.kind === reaction.kind)?.perKey
  const wholeBoard = reaction.kind === 'flash' || reaction.kind === 'sweep'
  const styleTitle = (style: ReactionStyle) => {
    if (style === 'dark') return 'The reaction in its color; the rest of the keyboard goes dark while it plays'
    if (!hasPaintedBase) return 'Make mode 1 a Painted colors mode first'
    if (style === 'base') {
      return wholeBoard
        ? 'This reaction reaches every key, so nothing would stay lit. Try Cut out of base.'
        : 'The rest of the keyboard keeps mode 1’s colors; keys the reaction reaches go dark until it passes'
    }
    return 'Mode 1’s colors stay lit and the reaction passes through them as darkness'
  }
  const styleWorks = styleAvailable(reaction.kind, reaction.style, hasPaintedBase)

  return (
    <div className="paint-row paint-colors effect-settings">
      <Setting label="Keys">
        <span>{describeReaction(layout, reaction)}</span>
        {reaction.keys.length > 0 && (
          <button className="link" onClick={() => set({ keys: [] })}>
            Clear
          </button>
        )}
      </Setting>
      <Setting label="Style">
        <Segmented
          label="Style"
          options={(
            [
              ['dark', 'On dark'],
              ['base', 'Over base'],
              ['cutout', 'Cut out of base'],
            ] as const
          ).map(([value, label]) => ({
            value,
            label,
            title: styleTitle(value),
            disabled: !styleAvailable(reaction.kind, value, hasPaintedBase),
          }))}
          value={reaction.style}
          onChange={(style) => set({ style })}
        />
      </Setting>
      {reaction.style !== 'cutout' && (
        <Setting label="Color">
          <ColorField label="Reaction color" color={reaction.color} onChange={(color) => set({ color })} />
        </Setting>
      )}
      <Setting label="Duration">
        <input
          type="range"
          aria-label="Duration in seconds"
          min={REACTION_LIMITS.seconds.min}
          max={REACTION_LIMITS.seconds.max}
          step={0.1}
          value={reaction.seconds}
          onChange={(e) => set({ seconds: Number(e.target.value) })}
        />
        <output>{reaction.seconds.toFixed(1)} s</output>
      </Setting>
      {reaction.kind === 'ripple' && (
        <Setting label="Shape">
          <Segmented
            label="Ripple shape"
            options={RIPPLE_SHAPES.map((s) => ({ value: s.shape, label: s.name, title: s.description }))}
            value={reaction.shape}
            onChange={(shape) => set({ shape })}
          />
        </Setting>
      )}
      {reaction.kind === 'ripple' && (
        <Setting label="Size">
          <input
            type="range"
            aria-label="How far the ripple spreads, in keys"
            min={REACTION_LIMITS.size.min}
            max={REACTION_LIMITS.size.max}
            step={1}
            value={reaction.size}
            onChange={(e) => set({ size: Number(e.target.value) })}
          />
          <output>
            {reaction.size} {reaction.shape === 'horizontal' ? (reaction.size === 1 ? 'row' : 'rows') : reaction.size === 1 ? 'key' : 'keys'}
          </output>
        </Setting>
      )}
      {reaction.kind === 'sweep' && (
        <Setting label="Direction">
          <Segmented
            label="Direction"
            options={DIRECTIONS.map((d) => ({ value: d.value, label: d.label, title: d.name, ariaLabel: d.name }))}
            value={reaction.direction}
            onChange={(direction) => set({ direction })}
          />
        </Setting>
      )}
      {!styleWorks && (
        <p className="effect-note reaction-notice">
          {styleTitle(reaction.style).replace(/\.$/, '')}. Until then this reaction plays On dark.
        </p>
      )}
      {notice && <p className="effect-note reaction-notice">{notice}</p>}
      <p className="muted effect-note">
        Click keys on the keyboard to choose which ones trigger this reaction (Fn can’t).{' '}
        {perKey ? 'Each key uses its own slot, since the animation is drawn around it. ' : 'All its keys share one slot. '}
        Reactions also show up, looping, when you step through modes with <kbd>Fn</kbd> + <kbd>]</kbd>.
      </p>
    </div>
  )
}
