import { Modifier } from './actions'
import type { KeyDef } from './layout'

// What each SK64 key does out of the box. Used to label keys that haven't been changed.

const KEY = 0x02000000
const key = (hid: number) => KEY | (hid << 8)

const NORMAL: Record<string, number> = {
  esc: key(0x29),
  minus: key(0x2d),
  equal: key(0x2e),
  backspace: key(0x2a),
  tab: key(0x2b),
  lbracket: key(0x2f),
  rbracket: key(0x30),
  backslash: key(0x31),
  caps: key(0x39),
  semicolon: key(0x33),
  quote: key(0x34),
  enter: key(0x28),
  lshift: KEY | Modifier.LShift,
  comma: key(0x36),
  period: key(0x37),
  slash: key(0x38),
  rshift: KEY | Modifier.RShift,
  up: key(0x52),
  delete: key(0x4c),
  lctrl: KEY | Modifier.LCtrl,
  lwin: KEY | Modifier.LWin,
  lalt: KEY | Modifier.LAlt,
  space: key(0x2c),
  menu: key(0x65),
  left: key(0x50),
  down: key(0x51),
  right: key(0x4f),
}

for (let i = 0; i < 26; i++) NORMAL[String.fromCharCode(97 + i)] = key(0x04 + i)
for (let i = 1; i <= 9; i++) NORMAL[String(i)] = key(0x1d + i)
NORMAL['0'] = key(0x27)

/**
 * The key's default function on the given layer, or null when unknown. Only F1–F12 are known
 * for the Fn layer; the rest of the Fn layer is defined inside the firmware.
 */
export function defaultValue(k: KeyDef, fnLayer: boolean): number | null {
  if (!fnLayer) return NORMAL[k.id] ?? null
  if (k.fnCode && /^F\d+$/.test(k.fnCode)) return key(0x39 + Number(k.fnCode.slice(1)))
  return null
}
