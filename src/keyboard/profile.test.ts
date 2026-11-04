import { describe, expect, it } from 'vitest'
import { EMPTY_KEYMAPS } from './keymap'
import { SK64_LAYOUT as layout } from './layout'
import { BUILTIN_LIGHTING } from './lighting'
import { macroKeyValue } from './macros'
import { exportProfile, importProfile, type Profile } from './profile'

const file = (o: object) => JSON.stringify({ app: 'sk64-configurator', layout: layout.name, name: 'Old', ...o })

describe('profile files', () => {
  it('round-trip every keyboard layer, the lighting and the macros', () => {
    const profile: Profile = {
      name: 'Mine',
      keymaps: {
        ...EMPTY_KEYMAPS,
        base: { normal: { caps: 0x02000001 }, fn: {} },
        windows: { normal: { menu: macroKeyValue(0) }, fn: { a: 0x02000500 } },
        fnx: { normal: { a: 0x02001b00 }, fn: {} },
      },
      lighting: BUILTIN_LIGHTING,
      macros: [
        {
          id: 'm1',
          name: 'Hello',
          repeat: 'whileHeld',
          count: 1,
          steps: [
            { input: { kind: 'key', code: 0x04, mods: 0 }, down: true, delay: 0 },
            { input: { kind: 'key', code: 0x04, mods: 0 }, down: false, delay: 30 },
          ],
        },
      ],
    }
    expect(importProfile(layout, exportProfile(layout, profile))).toEqual(profile)
  })

  it('reads version 2 files into the base layer', () => {
    const p = importProfile(layout, file({ version: 2, layers: { normal: { q: '0x02001400' }, fn: {} } }))
    expect(p.keymaps.base.normal).toEqual({ q: 0x02001400 })
    expect(p.keymaps.windows).toEqual(EMPTY_KEYMAPS.windows)
    expect(p.macros).toEqual([])
  })

  it('reads version 1 lighting (one set of colors) as a painted mode', () => {
    const p = importProfile(layout, file({ version: 1, layers: { normal: {}, fn: {} }, lighting: { kind: 'custom', colors: { a: '#ff0000' } } }))
    expect(p.lighting.kind).toBe('custom')
  })

  it('explains files it can’t read', () => {
    expect(() => importProfile(layout, 'not json')).toThrow(/valid JSON/)
    expect(() => importProfile(layout, JSON.stringify({ app: 'other' }))).toThrow(/isn't an SK64 Configurator profile/)
    expect(() => importProfile(layout, file({ version: 9 }))).toThrow(/newer version/)
    expect(() => importProfile(layout, file({ version: 2, layers: { normal: { a: 'nope' }, fn: {} } }))).toThrow(/Invalid value/)
  })

  it('ignores unknown keys and Fn', () => {
    const p = importProfile(layout, file({ version: 2, layers: { normal: { nokey: '0x1', [layout.fnKeyId]: '0x02000400' }, fn: {} } }))
    expect(p.keymaps.base.normal).toEqual({})
  })
})
