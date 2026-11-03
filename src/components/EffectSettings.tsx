import type { KeyboardLayout } from '../keyboard/layout'
import {
  actualSeconds,
  LIMITS,
  randomSeed,
  speedName,
  type ColorStyle,
  type Direction,
  type EffectSlot,
  type Speed,
} from '../keyboard/presets'
import { ColorField } from './ColorField'
import { Segmented, Setting } from './controls'

type AnimatedSlot = Exclude<EffectSlot, { kind: 'paint' }>

/** A Painted colors mode that others can borrow colors from. */
export type PaintingOption = { id: string; label: string }

type Props = {
  layout: KeyboardLayout
  slot: AnimatedSlot
  paintings: readonly PaintingOption[]
  /** Clicking keys on the board adds / removes them from this mode's keys. */
  choosingKeys: boolean
  onChoosingKeysChange: (choosing: boolean) => void
  onChange: (change: (slot: EffectSlot) => EffectSlot) => void
}

const DIRECTIONS: { value: Direction; label: string; name: string }[] = [
  { value: 'right', label: '→', name: 'Left to right' },
  { value: 'left', label: '←', name: 'Right to left' },
  { value: 'down', label: '↓', name: 'Top to bottom' },
  { value: 'up', label: '↑', name: 'Bottom to top' },
]

const STYLES: { value: ColorStyle; label: string }[] = [
  { value: 'spectrum', label: 'Spectrum' },
  { value: 'solid', label: 'One color' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'breathing', label: 'Breathing' },
  { value: 'painted', label: 'Painted' },
]

const SPEEDS: Speed[] = ['slow', 'normal', 'fast']
const NO_PAINTING = 'Add a Painted colors mode first'

/** Settings for an animated mode (wave, rain, breathing, rainbow). */
export function EffectSettings({ layout, slot, paintings, choosingKeys, onChoosingKeysChange, onChange }: Props) {
  // Typed helper: change fields of this slot's own kind.
  const set = <S extends AnimatedSlot>(patch: Partial<S>) => onChange((s) => ({ ...s, ...patch }) as EffectSlot)
  const hasPainting = paintings.length > 0

  return (
    <div className="paint-row paint-colors effect-settings">
      {slot.kind === 'wave' && (
        <>
          <Setting label="Direction">
            <Segmented
              label="Direction"
              options={DIRECTIONS.map((d) => ({ value: d.value, label: d.label, title: d.name, ariaLabel: d.name }))}
              value={slot.direction}
              onChange={(direction) => set({ direction })}
            />
          </Setting>
        </>
      )}

      {(slot.kind === 'wave' || slot.kind === 'rain') && (
        <>
          <LitOrDark
            label={slot.kind === 'wave' ? 'Bar' : 'Raindrops'}
            titles={
              slot.kind === 'wave'
                ? ['The bar lights keys up', 'Keys stay lit and the bar turns them off']
                : ['Drops light keys up', 'Keys stay lit and drops turn them off']
            }
            dark={slot.dark}
            onChange={(dark) => set({ dark })}
          />
          <Setting label="Colors">
            <Segmented
              label="Colors"
              options={STYLES.map((s) => ({
                ...s,
                disabled: s.value === 'painted' && !hasPainting,
                title: s.value === 'painted' ? (hasPainting ? 'Each key in its painted color' : NO_PAINTING) : undefined,
              }))}
              value={slot.style}
              onChange={(style) => set({ style })}
            />
            {(slot.style === 'solid' || slot.style === 'breathing') && (
              <ColorField label="Mode color" color={slot.color} onChange={(color) => set({ color })} />
            )}
          </Setting>
          <Setting label="Keys">
            <Segmented
              label="Keys"
              options={[
                { value: 'all', label: 'All keys' },
                { value: 'chosen', label: 'Chosen keys' },
              ]}
              value={slot.keys ? 'chosen' : 'all'}
              onChange={(v) => {
                set({ keys: v === 'all' ? null : [] })
                onChoosingKeysChange(v === 'chosen')
              }}
            />
            {slot.keys && (
              <>
                <button
                  className={choosingKeys ? 'small' : 'secondary small'}
                  aria-pressed={choosingKeys}
                  onClick={() => onChoosingKeysChange(!choosingKeys)}
                >
                  {choosingKeys ? 'Done choosing' : 'Choose keys'}
                </button>
                <span className="muted">{slot.keys.length} keys</span>
              </>
            )}
          </Setting>
          <Setting label="Other keys">
            <Segmented
              label="Other keys"
              options={[
                { value: 'off', label: 'Off' },
                {
                  value: 'painted',
                  label: 'Painted',
                  disabled: !hasPainting,
                  title: hasPainting ? 'Keys outside the animation stay lit in their painted colors' : NO_PAINTING,
                },
              ]}
              value={slot.background && slot.keys ? 'painted' : 'off'}
              disabled={!slot.keys}
              disabledTitle="Choose keys first: with all keys there are no other keys"
              onChange={(v) => set({ background: v === 'painted' })}
            />
          </Setting>
          {(slot.style === 'painted' || (slot.background && slot.keys)) && (
            <PaintingPicker paintings={paintings} value={slot.paintFrom} onChange={(paintFrom) => set({ paintFrom })} />
          )}
        </>
      )}

      {slot.kind === 'wave' && (
        <>
          <Setting label="Thickness">
            <Segmented
              label="Thickness in keys"
              options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n), title: `${n} key${n > 1 ? 's' : ''}` }))}
              value={slot.width}
              onChange={(width) => set({ width })}
            />
          </Setting>
          <Setting label="Sweep time">
            <input
              type="range"
              aria-label="Sweep time in seconds"
              min={LIMITS.waveSeconds.min}
              max={LIMITS.waveSeconds.max}
              step={0.1}
              value={slot.seconds}
              onChange={(e) => set({ seconds: Number(e.target.value) })}
            />
            <output>{actualSeconds(layout, slot).toFixed(1)} s</output>
          </Setting>
        </>
      )}

      {slot.kind === 'rain' && (
        <>
          <Setting label="Amount">
            <input
              type="range"
              aria-label="Drops per second"
              min={LIMITS.dropsPerSecond.min}
              max={LIMITS.dropsPerSecond.max}
              step={1}
              value={slot.dropsPerSecond}
              onChange={(e) => set({ dropsPerSecond: Number(e.target.value) })}
            />
            <output>{slot.dropsPerSecond}/s</output>
          </Setting>
          <Setting label="Fall time">
            <input
              type="range"
              aria-label="Fall time in seconds"
              min={LIMITS.rainSeconds.min}
              max={LIMITS.rainSeconds.max}
              step={0.1}
              value={slot.seconds}
              onChange={(e) => set({ seconds: Number(e.target.value) })}
            />
            <output>{actualSeconds(layout, slot).toFixed(1)} s</output>
          </Setting>
          <button
            className="secondary small"
            title="Drops fall in a random order that repeats every 4 seconds. This picks a different random order."
            onClick={() => set({ seed: randomSeed() })}
          >
            Shuffle drops
          </button>
        </>
      )}

      {slot.kind === 'breathing' && (
        <>
          <Setting label="Colors">
            <Segmented
              label="Colors"
              options={[
                { value: 'solid', label: 'One color' },
                {
                  value: 'painted',
                  label: 'Painted',
                  disabled: !hasPainting,
                  title: hasPainting ? 'Your painted colors breathe together' : NO_PAINTING,
                },
              ]}
              value={slot.style}
              onChange={(style) => set({ style })}
            />
            {slot.style === 'solid' && (
              <ColorField label="Breathing color" color={slot.color} onChange={(color) => set({ color })} />
            )}
          </Setting>
          {slot.style === 'painted' && (
            <PaintingPicker paintings={paintings} value={slot.paintFrom} onChange={(paintFrom) => set({ paintFrom })} />
          )}
          <SpeedSetting speed={slot.speed} onChange={(speed) => set({ speed })} />
        </>
      )}

      {slot.kind === 'rainbow' && <SpeedSetting speed={slot.speed} onChange={(speed) => set({ speed })} />}

      <p className="muted effect-note">
        {choosingKeys
          ? 'Click keys on the keyboard to add or remove them. '
          : slot.kind === 'rain'
            ? 'Drops fall in a random order that repeats every 4 seconds; Shuffle drops picks a different one. Times are at the keyboard’s default speed. '
            : slot.kind === 'wave'
              ? 'Times are at the keyboard’s default speed. '
            : 'The preview is approximate: the keyboard’s exact fade and color curves aren’t known. '}
        <kbd>Fn</kbd> + <kbd>←</kbd> / <kbd>→</kbd> on the keyboard makes all modes slower or faster.
      </p>
    </div>
  )
}

/** Lit: the moving part lights keys up. Dark: keys stay lit and the moving part turns them off. */
function LitOrDark({
  label,
  titles,
  dark,
  onChange,
}: {
  label: string
  /** Tooltips for Lit and Dark. */
  titles: [string, string]
  dark: boolean
  onChange: (dark: boolean) => void
}) {
  return (
    <Setting label={label}>
      <Segmented
        label={label}
        options={[
          { value: 'lit', label: 'Lit', title: titles[0] },
          { value: 'dark', label: 'Dark', title: titles[1] },
        ]}
        value={dark ? 'dark' : 'lit'}
        onChange={(v) => onChange(v === 'dark')}
      />
    </Setting>
  )
}

/** Which Painted colors mode to borrow from (only shown when there's a choice). */
function PaintingPicker({
  paintings,
  value,
  onChange,
}: {
  paintings: readonly PaintingOption[]
  value: string | null
  onChange: (id: string) => void
}) {
  if (paintings.length < 2) return null
  const current = paintings.some((p) => p.id === value) ? value! : paintings[0].id
  return (
    <Setting label="Painted from">
      <select className="setting-select" aria-label="Painted colors to use" value={current} onChange={(e) => onChange(e.target.value)}>
        {paintings.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </Setting>
  )
}

function SpeedSetting({ speed, onChange }: { speed: Speed; onChange: (speed: Speed) => void }) {
  return (
    <Setting label="Speed">
      <Segmented
        label="Speed"
        options={SPEEDS.map((s) => ({ value: s, label: speedName(s) }))}
        value={speed}
        onChange={onChange}
      />
    </Setting>
  )
}
