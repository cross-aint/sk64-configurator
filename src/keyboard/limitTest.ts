import type { KeyboardLayout } from './layout'
import { MAX_EFFECTS, type Effect } from './effects'
import { hueToHex } from './presets'

// Hardware test: how many custom modes does the keyboard really hold?
//
// Writes the most modes the table allows (32). Mode n lights the first n keys in reading order
// (Esc, 1, 2, … then the next row), each mode in its own color. Stepping through them with Fn + ],
// the lit row grows by one key each press; when it jumps back to a single key, the longest row
// shows how many modes the keyboard kept. All 32 also make a ~23 KB block, so it checks memory too.

export type LimitTest = {
  effects: Effect[]
  /** Name of the last key lit by the final mode (e.g. "S"), to compare with what the user sees. */
  lastKeyName: string
}

export function buildLimitTest(layout: KeyboardLayout, count = MAX_EFFECTS): LimitTest {
  const order = layout.keys // already in reading order: row by row, left to right
  const effects: Effect[] = Array.from({ length: count }, (_, i) => {
    const color = hueToHex((i * 360) / count)
    const keys = order.slice(0, i + 1)
    return { kind: 'static', colors: Object.fromEntries(keys.map((k) => [k.id, color])) }
  })
  const last = order[Math.min(count, order.length) - 1]
  return { effects, lastKeyName: last.label || last.name }
}

/** The key the nth mode's lit row ends on, so a user can report "it stopped at Tab" as a number. */
export function keyForCount(layout: KeyboardLayout, n: number): string {
  const key = layout.keys[Math.max(0, Math.min(n, layout.keys.length) - 1)]
  return key.label || key.name
}

/** Plain-language summary of the keyboard's replies to a series of data packets. */
export function describeReplies(statuses: readonly number[], packetSize: number, what = 'lighting packets'): string {
  if (statuses.length === 0) return `No ${what} were sent.`
  const counts = new Map<number, number>()
  statuses.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1))
  if (counts.size === 1) {
    const [status] = counts.keys()
    const meaning = status === 1 ? ', the same code it uses for a successful info request' : ''
    return `The keyboard answered all ${statuses.length} ${what} with status ${status}${meaning}.`
  }
  const parts = [...counts.entries()].sort(([a], [b]) => a - b).map(([s, n]) => `status ${s} × ${n}`)
  const firstOdd = statuses.findIndex((s) => s !== statuses[0])
  return `The keyboard's answers were mixed: ${parts.join(', ')}. The first change was at packet ${firstOdd + 1} (data byte ${firstOdd * packetSize}).`
}
