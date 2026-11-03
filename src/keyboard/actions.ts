// Everything a key can be set to, and how each one is encoded for the firmware.
//
// A key value is 32 bits: [type:16][data1:8][data2:8]
//   0x0200 normal key   data1 = USB HID key code, data2 = modifier bits (for combos)
//   0x0300 media/system data = USB HID consumer code
//   0x0101 mouse        data2 = button bit
//   0x0901..0x0906      lighting controls
//   0x0A02              special functions

export type ActionGroup =
  | 'Letters'
  | 'Numbers'
  | 'Symbols'
  | 'Editing'
  | 'Navigation'
  | 'Function keys'
  | 'Modifiers'
  | 'Media'
  | 'Apps & browser'
  | 'Mouse'
  | 'Lighting'
  | 'Numpad'
  | 'Special'

export type Action = {
  value: number
  /** Full name for lists and the details panel. */
  name: string
  /** Short text that fits on a keycap. */
  cap: string
  group: ActionGroup
  /** Extra words to match in search. */
  keywords?: string
}

export const ACTION_GROUPS: ActionGroup[] = [
  'Letters',
  'Numbers',
  'Symbols',
  'Editing',
  'Navigation',
  'Function keys',
  'Modifiers',
  'Media',
  'Apps & browser',
  'Mouse',
  'Lighting',
  'Numpad',
  'Special',
]

const KEY = 0x02000000
const key = (hid: number) => KEY | (hid << 8)
const media = (usage: number) => 0x03000000 | usage

export const Modifier = {
  LCtrl: 0x01,
  LShift: 0x02,
  LAlt: 0x04,
  LWin: 0x08,
  RCtrl: 0x10,
  RShift: 0x20,
  RAlt: 0x40,
  RWin: 0x80,
} as const

export const DISABLED = KEY

const list: Action[] = []
const add = (group: ActionGroup, value: number, name: string, cap = name, keywords?: string) =>
  list.push({ value, name, cap, group, keywords })

// Letters A–Z: HID 0x04–0x1D
for (let i = 0; i < 26; i++) {
  const letter = String.fromCharCode(65 + i)
  add('Letters', key(0x04 + i), letter)
}

// Numbers 1–9, 0: HID 0x1E–0x27
for (let i = 1; i <= 10; i++) add('Numbers', key(0x1d + i), String(i % 10))

add('Symbols', key(0x2d), 'Minus', '-', 'dash hyphen underscore')
add('Symbols', key(0x2e), 'Equals', '=', 'plus')
add('Symbols', key(0x2f), 'Left bracket', '[', 'brace')
add('Symbols', key(0x30), 'Right bracket', ']', 'brace')
add('Symbols', key(0x31), 'Backslash', '\\', 'pipe')
add('Symbols', key(0x33), 'Semicolon', ';', 'colon')
add('Symbols', key(0x34), 'Quote', "'", 'apostrophe double quote')
add('Symbols', key(0x35), 'Backtick', '`', 'grave tilde')
add('Symbols', key(0x36), 'Comma', ',', 'less than')
add('Symbols', key(0x37), 'Period', '.', 'dot greater than')
add('Symbols', key(0x38), 'Slash', '/', 'question mark')
add('Symbols', key(0x64), 'ISO backslash', '\\|', 'international non-us')

add('Editing', key(0x29), 'Escape', 'Esc')
add('Editing', key(0x2b), 'Tab')
add('Editing', key(0x28), 'Enter', 'Enter', 'return')
add('Editing', key(0x2c), 'Space', 'Space', 'spacebar')
add('Editing', key(0x2a), 'Backspace', 'Bksp')
add('Editing', key(0x4c), 'Delete', 'Del')
add('Editing', key(0x49), 'Insert', 'Ins')
add('Editing', key(0x39), 'Caps Lock', 'Caps')
add('Editing', key(0x65), 'Menu', 'Menu', 'application context')
add('Editing', key(0x46), 'Print Screen', 'PrtSc', 'screenshot')
add('Editing', key(0x47), 'Scroll Lock', 'ScrLk')
add('Editing', key(0x48), 'Pause', 'Pause', 'break')

add('Navigation', key(0x52), 'Up arrow', '↑')
add('Navigation', key(0x51), 'Down arrow', '↓')
add('Navigation', key(0x50), 'Left arrow', '←')
add('Navigation', key(0x4f), 'Right arrow', '→')
add('Navigation', key(0x4a), 'Home')
add('Navigation', key(0x4d), 'End')
add('Navigation', key(0x4b), 'Page Up', 'PgUp')
add('Navigation', key(0x4e), 'Page Down', 'PgDn')

// F1–F12: HID 0x3A–0x45, F13–F24: 0x68–0x73
for (let i = 1; i <= 12; i++) add('Function keys', key(0x39 + i), `F${i}`)
for (let i = 13; i <= 24; i++) add('Function keys', key(0x5b + i), `F${i}`)

// Modifiers on their own: data1 = 0, data2 = modifier bit
add('Modifiers', KEY | Modifier.LCtrl, 'Left Ctrl', 'Ctrl', 'control')
add('Modifiers', KEY | Modifier.LShift, 'Left Shift', 'Shift')
add('Modifiers', KEY | Modifier.LAlt, 'Left Alt', 'Alt', 'option')
add('Modifiers', KEY | Modifier.LWin, 'Left Windows', 'Win', 'super gui meta command')
add('Modifiers', KEY | Modifier.RCtrl, 'Right Ctrl', 'RCtrl', 'control')
add('Modifiers', KEY | Modifier.RShift, 'Right Shift', 'RShift')
add('Modifiers', KEY | Modifier.RAlt, 'Right Alt', 'RAlt', 'altgr option')
add('Modifiers', KEY | Modifier.RWin, 'Right Windows', 'RWin', 'super gui meta command')

add('Media', media(0xcd), 'Play / Pause', '⏯', 'music')
add('Media', media(0xb5), 'Next track', '⏭', 'music')
add('Media', media(0xb6), 'Previous track', '⏮', 'music')
add('Media', media(0xb7), 'Stop', '⏹', 'music')
add('Media', media(0xe9), 'Volume up', 'Vol+', 'sound louder')
add('Media', media(0xea), 'Volume down', 'Vol−', 'sound quieter')
add('Media', media(0xe2), 'Mute', 'Mute', 'sound')

add('Apps & browser', media(0x183), 'Media player', 'Player', 'music app')
add('Apps & browser', media(0x18a), 'Email', 'Mail')
add('Apps & browser', media(0x192), 'Calculator', 'Calc')
add('Apps & browser', media(0x194), 'This PC', 'PC', 'my computer explorer files')
add('Apps & browser', media(0x221), 'Search', 'Search', 'browser')
add('Apps & browser', media(0x223), 'Browser home', 'Home', 'web')
add('Apps & browser', media(0x224), 'Browser back', 'Back', 'web')
add('Apps & browser', media(0x225), 'Browser forward', 'Fwd', 'web')
add('Apps & browser', media(0x227), 'Browser refresh', 'Reload', 'web')
add('Apps & browser', media(0x226), 'Browser stop', 'Stop', 'web')
add('Apps & browser', media(0x22a), 'Browser favorites', 'Favs', 'web bookmarks')

add('Mouse', 0x01010001, 'Left click', 'LClick', 'mouse button')
add('Mouse', 0x01010002, 'Right click', 'RClick', 'mouse button')
add('Mouse', 0x01010004, 'Middle click', 'MClick', 'mouse button wheel')
add('Mouse', 0x01010008, 'Mouse back', 'M4', 'mouse button')
add('Mouse', 0x01010010, 'Mouse forward', 'M5', 'mouse button')

add('Lighting', 0x09020001, 'Brightness up', 'Bri+', 'light led rgb')
add('Lighting', 0x09020002, 'Brightness down', 'Bri−', 'light led rgb')
add('Lighting', 0x09030001, 'Effect speed up', 'Spd+', 'light led rgb')
add('Lighting', 0x09030002, 'Effect speed down', 'Spd−', 'light led rgb')
add('Lighting', 0x09060002, 'Lighting on / off', 'LED', 'light led rgb toggle')
add('Lighting', 0x09060001, 'Pause / resume effect', 'LED ⏯', 'light led rgb')
add('Lighting', 0x09010010, 'Next effect', 'FX', 'light led rgb mode')
add('Lighting', 0x09010011, 'Next reactive effect', 'FX*', 'light led rgb mode press')

add('Numpad', key(0x53), 'Num Lock', 'NumLk')
add('Numpad', key(0x54), 'Numpad /', 'N/')
add('Numpad', key(0x55), 'Numpad *', 'N*')
add('Numpad', key(0x56), 'Numpad −', 'N−')
add('Numpad', key(0x57), 'Numpad +', 'N+')
add('Numpad', key(0x58), 'Numpad Enter', 'NEnt')
for (let i = 1; i <= 9; i++) add('Numpad', key(0x58 + i), `Numpad ${i}`, `N${i}`)
add('Numpad', key(0x62), 'Numpad 0', 'N0')
add('Numpad', key(0x63), 'Numpad .', 'N.')

add('Special', DISABLED, 'Disabled', '∅', 'off nothing none block')
add('Special', 0x0a020002, 'Lock Windows key', 'WinLk', 'toggle game mode')

export const ACTIONS: readonly Action[] = list

const byValue = new Map(list.map((a) => [a.value, a]))

const MOD_NAMES: [bit: number, short: string][] = [
  [Modifier.LCtrl, 'Ctrl'],
  [Modifier.RCtrl, 'Ctrl'],
  [Modifier.LShift, 'Shift'],
  [Modifier.RShift, 'Shift'],
  [Modifier.LAlt, 'Alt'],
  [Modifier.RAlt, 'Alt'],
  [Modifier.LWin, 'Win'],
  [Modifier.RWin, 'Win'],
]

export function isKeyValue(value: number) {
  return value >>> 16 === 0x0200
}

/** Splits a normal-key value into its key part and modifier bits. */
export function splitCombo(value: number): { base: number; mods: number } {
  if (!isKeyValue(value) || ((value >> 8) & 0xff) === 0) return { base: value, mods: 0 }
  return { base: (value & ~0xff) >>> 0, mods: value & 0xff }
}

export function makeCombo(base: number, mods: number): number {
  return isKeyValue(base) && ((base >> 8) & 0xff) !== 0 ? ((base & ~0xff) | (mods & 0xff)) >>> 0 : base
}

/** Describes any value, including combos like Ctrl+C and values we don't have names for. */
export function describe(value: number): { name: string; cap: string } {
  const exact = byValue.get(value)
  if (exact) return exact
  const { base, mods } = splitCombo(value)
  const baseAction = byValue.get(base)
  if (baseAction && mods) {
    const prefix = [...new Set(MOD_NAMES.filter(([bit]) => mods & bit).map(([, n]) => n))].join('+')
    return { name: `${prefix}+${baseAction.name}`, cap: `${prefix}+${baseAction.cap}` }
  }
  const hex = '0x' + (value >>> 0).toString(16).toUpperCase().padStart(8, '0')
  return { name: `Unknown (${hex})`, cap: '?' }
}

export function findAction(value: number): Action | undefined {
  return byValue.get(value)
}
