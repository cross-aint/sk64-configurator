import type { Effect, Frame } from './effects'
import type { KeyboardLayout } from './layout'

// Hardware test: key-press lighting.
//
// The official software sends a table (command 0x26) with one byte per key slot naming a lighting
// effect to play when that key is pressed (0xFF = none). Nobody has documented how it behaves, so
// this test writes four lighting modes and links a few keys to them:
//
//   mode 1 (number 0)  dim blue background, static
//   mode 2 (number 1)  white flash on every key
//   mode 3 (number 2)  red burst spreading out from Enter
//   mode 4 (number 3)  green sweep from left to right
//
//   Q → 0, Esc → 1, Enter → 2, Space → 3
//
// What lights up tells us whether the numbers count from 0 or from 1, whether a reaction plays
// once or loops, and whether these modes also appear on Fn + ].

export const KEY_PRESS_LINKS: readonly { keyId: string; effect: number }[] = [
  { keyId: 'q', effect: 0 },
  { keyId: 'esc', effect: 1 },
  { keyId: 'enter', effect: 2 },
  { keyId: 'space', effect: 3 },
]

export const NO_KEY_PRESS_EFFECT = 0xff

export type KeyPressTest = {
  effects: Effect[]
  /** One byte per key slot. */
  table: Uint8Array
}

export function buildKeyPressTest(layout: KeyboardLayout, slotCount: number): KeyPressTest {
  const all = layout.keys.map((k) => k.id)
  const center = (id: string) => {
    const k = layout.keys.find((key) => key.id === id)
    return k ? { x: k.x + k.w / 2, y: k.y + 0.5 } : { x: 0, y: 0 }
  }

  // Burst from Enter: rings of keys by distance, then a pause.
  const origin = center('enter')
  const rings: string[][] = [[], [], [], []]
  for (const id of all) {
    const c = center(id)
    const d = Math.hypot(c.x - origin.x, c.y - origin.y)
    const ring = Math.floor(d / 1.25)
    if (ring < rings.length) rings[ring].push(id)
  }
  const burst: Frame[] = [...rings.map((keys) => ({ keys, hold: 2 })), { keys: [], hold: 6 }]

  // Sweep: one key-width column per tick.
  const columns: Frame[] = Array.from({ length: layout.width }, (_, c) => ({
    keys: all.filter((id) => {
      const k = layout.keys.find((key) => key.id === id)
      return !!k && k.x < c + 1 && k.x + k.w > c
    }),
    hold: 1,
  }))

  const effects: Effect[] = [
    { kind: 'static', colors: Object.fromEntries(all.map((id) => [id, '#103080'])) },
    {
      kind: 'animated',
      frames: [
        { keys: all, hold: 4 },
        { keys: [], hold: 4 },
      ],
      groups: [{ keys: all, mode: { kind: 'fixed', color: '#ffffff' } }],
    },
    { kind: 'animated', frames: burst, groups: [{ keys: all, mode: { kind: 'fixed', color: '#ff0000' } }] },
    { kind: 'animated', frames: columns, groups: [{ keys: all, mode: { kind: 'fixed', color: '#00ff40' } }] },
  ]

  const table = new Uint8Array(slotCount).fill(NO_KEY_PRESS_EFFECT)
  for (const link of KEY_PRESS_LINKS) {
    const key = layout.keys.find((k) => k.id === link.keyId)
    if (key && key.slot < slotCount) table[key.slot] = link.effect
  }
  return { effects, table }
}
