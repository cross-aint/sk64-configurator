import { describe, expect, it } from 'vitest'
import { SK64_LAYOUT as layout } from './layout'
import { keyPressTable, newReaction, reactionEffects, reactionSlots, type Reaction } from './reactions'

const reaction = (patch: Partial<Reaction>): Reaction => ({ ...newReaction('ripple', 'r'), keys: ['enter'], ...patch })
// Mode 1 painted blue, except Esc which is off.
const base = Object.fromEntries(layout.keys.map((k) => [k.id, k.id === 'esc' ? '#000000' : '#0000ff']))
const painted = layout.keys.map((k) => k.id).filter((id) => id !== 'esc')

describe('reactionEffects – closing frame', () => {
  // Without a closing frame, reactions kept repeating on an SK64.
  it('ends every reaction with a one-tick frame', () => {
    for (const style of ['dark', 'base', 'cutout'] as const) {
      const [effect] = reactionEffects(layout, reaction({ style }), base)
      if (effect.kind !== 'animated') throw new Error('expected an animation')
      expect(effect.frames.at(-1)?.hold).toBe(1)
    }
  })

  it('is fully dark for On dark', () => {
    const [effect] = reactionEffects(layout, reaction({ style: 'dark' }), base)
    expect(effect.kind === 'animated' && effect.frames.at(-1)?.keys).toEqual([])
  })

  it('shows the whole base for Cut out (a dark tick showed as a blank flash)', () => {
    const [effect] = reactionEffects(layout, reaction({ style: 'cutout' }), base)
    expect(effect.kind === 'animated' && [...effect.frames.at(-1)!.keys].sort()).toEqual([...painted].sort())
  })

  it('shows the base outside the reaction’s reach for Over base', () => {
    const [effect] = reactionEffects(layout, reaction({ style: 'base' }), base)
    if (effect.kind !== 'animated') throw new Error('expected an animation')
    const reach = new Set(effect.frames.slice(0, -1).flatMap((f) => f.keys).filter((id) => !effect.frames.every((f) => f.keys.includes(id))))
    const last = effect.frames.at(-1)!.keys
    expect(last.length).toBeGreaterThan(0)
    for (const id of last) expect(reach.has(id)).toBe(false)
  })
})

describe('reactionEffects – per key', () => {
  it('makes one animation per trigger key for ripples, one in total for sweeps', () => {
    expect(reactionEffects(layout, reaction({ keys: ['a', 'b', 'c'] }))).toHaveLength(3)
    expect(reactionEffects(layout, { ...newReaction('sweep', 's'), keys: ['a', 'b', 'c'] })).toHaveLength(1)
    expect(reactionSlots(reaction({ keys: ['a', 'b'] }))).toBe(2)
    expect(reactionSlots({ ...newReaction('flash', 'f'), keys: ['a', 'b'] })).toBe(1)
  })

  it('line ripples stay in the pressed key’s row', () => {
    const [effect] = reactionEffects(layout, reaction({ keys: ['g'], shape: 'line', size: 4 }))
    if (effect.kind !== 'animated') throw new Error('expected an animation')
    const row = layout.keys.find((k) => k.id === 'g')!.y
    for (const id of effect.frames.flatMap((f) => f.keys)) expect(layout.keys.find((k) => k.id === id)!.y).toBe(row)
  })
})

describe('keyPressTable', () => {
  it('names each trigger key’s effect, counting from 0 after the modes, 0xFF elsewhere', () => {
    const ripple = reaction({ keys: ['a', 'b'] })
    const flash = { ...newReaction('flash', 'f'), keys: ['c', 'd'] }
    const table = keyPressTable(layout, 2, [ripple, flash], 112)
    const slot = (id: string) => layout.keys.find((k) => k.id === id)!.slot
    expect([table[slot('a')], table[slot('b')], table[slot('c')], table[slot('d')]]).toEqual([2, 3, 4, 4])
    expect(table[slot('e')]).toBe(0xff)
    expect(table.length).toBe(112)
  })
})
