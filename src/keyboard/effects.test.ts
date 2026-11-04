import { describe, expect, it } from 'vitest'
import { encodeEffects, fitGroups, MAX_EFFECTS, MAX_GROUPS, type Effect } from './effects'
import { SK64_LAYOUT as layout } from './layout'

const TABLE = MAX_EFFECTS * 16
const key = (id: string) => layout.keys.find((k) => k.id === id)!
const int32s = (block: Uint8Array, at: number, n: number) =>
  Array.from({ length: n }, (_, i) => new DataView(block.buffer).getInt32(at + i * 4, true))
const bit = (mask: Uint8Array, led: number) => (mask[led >> 3] >> (led & 7)) & 1

describe('encodeEffects – effect table', () => {
  it('has 32 slots of [data offset, data count, params offset, params count], -1 when empty', () => {
    const block = encodeEffects(layout, [{ kind: 'static', colors: {} }])
    expect(int32s(block, 0, 4)).toEqual([TABLE, 1, 0, 0])
    for (let slot = 1; slot < MAX_EFFECTS; slot++) expect(int32s(block, slot * 16, 4)).toEqual([-1, -1, -1, -1])
  })

  it('refuses no effects and more than 32', () => {
    expect(() => encodeEffects(layout, [])).toThrow()
    expect(() => encodeEffects(layout, Array(MAX_EFFECTS + 1).fill({ kind: 'static', colors: {} }))).toThrow()
  })
})

describe('encodeEffects – static colors', () => {
  const block = encodeEffects(layout, [{ kind: 'static', colors: { a: '#102030', s: '#000000', space: '#ff0000' } }])
  const view = new DataView(block.buffer)
  const color = (led: number) => [...block.slice(TABLE + 4 + led * 4, TABLE + 8 + led * 4)]

  it('starts with type 0 and 704 bytes (176 LEDs × RGBA)', () => {
    expect(view.getUint16(TABLE, true)).toBe(0)
    expect(view.getUint16(TABLE + 2, true)).toBe(704)
    expect(block.length).toBe(TABLE + 4 + 704)
  })

  it('stores each lit key as [R, G, B, FF] at its LED; black means off', () => {
    expect(color(key('a').led)).toEqual([0x10, 0x20, 0x30, 0xff])
    expect(color(key('s').led)).toEqual([0, 0, 0, 0])
  })

  it('lights the space bar’s extra LEDs too', () => {
    for (const led of [key('space').led, ...(key('space').extraLeds ?? [])]) expect(color(led)).toEqual([0xff, 0, 0, 0xff])
  })
})

describe('encodeEffects – animations', () => {
  const effect: Effect = {
    kind: 'animated',
    frames: [
      { keys: ['a'], hold: 3 },
      { keys: [], hold: 1 },
    ],
    groups: [
      { keys: ['a'], mode: { kind: 'rainbow', color: '#ff0000', step: 18 } },
      { keys: ['b'], mode: { kind: 'breathing', color: '#00ff00', step: 5, hold: 5 } },
    ],
  }
  const block = encodeEffects(layout, [effect])
  const [framesAt, ticks, paramsAt, groups] = int32s(block, 0, 4)

  it('writes one 26-byte frame entry per tick (holds are expanded)', () => {
    expect([framesAt, ticks, groups]).toEqual([TABLE, 4, 2])
    expect(paramsAt).toBe(TABLE + 4 * 26)
    const frame = (i: number) => block.slice(TABLE + i * 26, TABLE + (i + 1) * 26)
    expect([...frame(0).slice(0, 4)]).toEqual([3, 0, 22, 0])
    expect(bit(frame(0).slice(4), key('a').led)).toBe(1)
    expect(bit(frame(2).slice(4), key('a').led)).toBe(1)
    expect(frame(3).slice(4).every((b) => b === 0)).toBe(true)
  })

  it('writes 32-byte color groups: mode, 32, LED mask, [R, G, B, 0], step, hold', () => {
    const g = (i: number) => block.slice(paramsAt + i * 32, paramsAt + (i + 1) * 32)
    const view = (i: number) => new DataView(g(i).buffer)
    expect([g(0)[0], g(0)[1]]).toEqual([1, 32])
    expect(bit(g(0).slice(2, 24), key('a').led)).toBe(1)
    expect([...g(0).slice(24, 28)]).toEqual([0xff, 0, 0, 0])
    expect([view(0).getUint16(28, true), view(0).getUint16(30, true)]).toEqual([18, 0])
    expect(g(1)[0]).toBe(2)
    expect([view(1).getUint16(28, true), view(1).getUint16(30, true)]).toEqual([5, 5])
  })
})

describe('fitGroups', () => {
  // One group per key, each a different color: far over the limit, like a colorful painting.
  const many: Effect = {
    kind: 'animated',
    frames: [{ keys: layout.keys.map((k) => k.id), hold: 1 }],
    groups: layout.keys.map((k, i) => ({
      keys: [k.id],
      mode: { kind: 'fixed' as const, color: '#' + ((i * 0x040302) & 0xffffff).toString(16).padStart(6, '0') },
    })),
  }

  it('merges colors until there are at most 30 groups (more lit later keys white on an SK64)', () => {
    const fitted = fitGroups(many)
    if (fitted.kind !== 'animated') throw new Error('expected an animation')
    expect(many.kind === 'animated' && many.groups.length).toBeGreaterThan(MAX_GROUPS)
    expect(fitted.groups.length).toBe(MAX_GROUPS)
  })

  it('keeps every key colored exactly once', () => {
    const fitted = fitGroups(many)
    if (fitted.kind !== 'animated') throw new Error('expected an animation')
    const keys = fitted.groups.flatMap((g) => g.keys).sort()
    expect(keys).toEqual(layout.keys.map((k) => k.id).sort())
  })

  it('never merges groups with different timing', () => {
    const mixed: Effect = {
      kind: 'animated',
      frames: [{ keys: [], hold: 1 }],
      groups: layout.keys.map((k, i) => ({
        keys: [k.id],
        mode: i % 2 ? { kind: 'fixed' as const, color: '#ffffff' } : { kind: 'rainbow' as const, color: '#ffffff', step: 18 },
      })),
    }
    const fitted = fitGroups(mixed)
    if (fitted.kind !== 'animated' || mixed.kind !== 'animated') throw new Error('expected an animation')
    expect(fitted.groups.length).toBeLessThanOrEqual(MAX_GROUPS)
    const kindOf = new Map(mixed.groups.map((g) => [g.keys[0], g.mode.kind]))
    for (const g of fitted.groups) for (const k of g.keys) expect(kindOf.get(k)).toBe(g.mode.kind)
  })

  it('leaves effects within the limit untouched', () => {
    const small: Effect = { kind: 'static', colors: { a: '#ffffff' } }
    expect(fitGroups(small)).toBe(small)
  })
})
