import { describe, Modifier } from './actions'
import type { BoardLayer } from './keymap'
import type { KeyDef } from './layout'

// What each SK64 key does out of the box. Used to label keys that haven't been changed.
// The Fn layer and the macOS layer's defaults come from the SK64's printed manual.

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

/** A key's built-in function. `value` is null when we know what it does but not its key code. */
export type DefaultFunction = { value: number | null; cap: string; name: string }

const fromValue = (value: number): DefaultFunction => ({ value, ...describe(value) })
const named = (cap: string, name: string): DefaultFunction => ({ value: null, cap, name })

// macOS layer: "control, option, command in their original position", so Win is Option and Alt
// is Command (per the manual).
const MAC_NORMAL: Record<string, DefaultFunction> = {
  lwin: { value: KEY | Modifier.LAlt, cap: 'Opt', name: 'Option (Alt)' },
  lalt: { value: KEY | Modifier.LWin, cap: 'Cmd', name: 'Command (Win)' },
}

// Fn combinations on every layer (manual: "Combination function" and "Backlight settings").
const FN_COMMON: Record<string, DefaultFunction> = {
  esc: fromValue(key(0x35)), // ` (and ~ with Shift)
  backspace: fromValue(key(0x4c)),
  lwin: named('WinLk', 'Lock / unlock the Win key'),
  backslash: named('LED', 'Backlight on / off'),
  p: named('LED ⏯', 'Pause / play the lighting effect'),
  rbracket: named('Custom', 'Next custom lighting mode'),
  lbracket: named('Built-in', 'Next built-in lighting mode'),
  up: named('Bri+', 'Backlight brightness up'),
  down: named('Bri−', 'Backlight brightness down'),
  left: named('Spd−', 'Lighting effect speed down'),
  right: named('Spd+', 'Lighting effect speed up'),
}

// Number row with Fn on the macOS layer.
const MAC_FN_ROW: Record<string, DefaultFunction> = {
  '1': named('Scr−', 'Screen brightness down (Mac)'),
  '2': named('Scr+', 'Screen brightness up (Mac)'),
  '3': named('MCtl', 'Mission Control (Mac)'),
  '4': named('LPad', 'Launchpad (Mac)'),
  '5': named('Siri', 'Siri (Mac)'),
  '6': named('Shot', 'Screenshot (Mac)'),
  '7': fromValue(0x03000000 | 0xb6),
  '8': fromValue(0x03000000 | 0xcd),
  '9': fromValue(0x03000000 | 0xb5),
  '0': fromValue(0x03000000 | 0xe2),
  minus: fromValue(0x03000000 | 0xea),
  equal: fromValue(0x03000000 | 0xe9),
}

/**
 * The key's built-in function on the given keyboard layer and table, or null when unknown.
 * Untouched FNX-layer keys aren't listed: what they do isn't documented.
 */
export function defaultFunction(k: KeyDef, fnLayer: boolean, board: BoardLayer = 'base'): DefaultFunction | null {
  if (board === 'fnx') return null
  if (!fnLayer) {
    if (board === 'mac' && MAC_NORMAL[k.id]) return MAC_NORMAL[k.id]
    return NORMAL[k.id] !== undefined ? fromValue(NORMAL[k.id]) : null
  }
  if (board === 'mac' && MAC_FN_ROW[k.id]) return MAC_FN_ROW[k.id]
  if (FN_COMMON[k.id]) return FN_COMMON[k.id]
  if (k.fnCode && /^F\d+$/.test(k.fnCode)) return fromValue(key(0x39 + Number(k.fnCode.slice(1))))
  return null
}

/** The key's default key code (see defaultFunction), or null when unknown. */
export function defaultValue(k: KeyDef, fnLayer: boolean, board: BoardLayer = 'base'): number | null {
  return defaultFunction(k, fnLayer, board)?.value ?? null
}
