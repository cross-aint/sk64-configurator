// Physical layout of the Skyloong SK64 (64 keys, 15 units wide, 5 rows).
//
// Positions are in key units (1u = one standard key). Each key also carries the two numbers
// the keyboard's firmware uses to address it:
//   slot – index into the key-mapping table (used for remapping; "logic code" in GK6X)
//   led  – index of the key's LED (used for per-key lighting; "location code" in GK6X)
// `code` is the browser's KeyboardEvent.code for the key's default function, used by the
// key tester. Fn has no code because it never reaches the computer.
// `fnCode` is what the key sends while Fn is held, by default. Only F1–F12 are listed:
// the SK64 has no F-row, so seeing one of those proves Fn is held (used to test Fn).

export type KeyDef = {
  id: string
  label: string
  /** Longer name for tooltips, screen readers and the details panel. */
  name: string
  x: number
  y: number
  w: number
  slot: number
  led: number
  code?: string
  fnCode?: string
  /** Additional LEDs under wide keys (lit together with `led`). */
  extraLeds?: number[]
}

export type KeyboardLayout = {
  name: string
  width: number
  height: number
  /** id of the Fn key */
  fnKeyId: string
  keys: KeyDef[]
}

// LED numbers 58 and 60 aren't assigned to any key; they sit either side of the space bar's
// LED (59), so we assume they light the space bar too.
const EXTRA_LEDS: Record<string, number[]> = { space: [58, 60] }

// Default Fn layer: number row becomes F1–F12.
const FN_CODES: Record<string, string> = {
  '1': 'F1', '2': 'F2', '3': 'F3', '4': 'F4', '5': 'F5', '6': 'F6',
  '7': 'F7', '8': 'F8', '9': 'F9', '0': 'F10', minus: 'F11', equal: 'F12',
}

type Row = [id: string, label: string, name: string, w: number, slot: number, led: number, code?: string][]

const rows: Row[] = [
  [
    ['esc', 'Esc', 'Escape', 1, 47, 0, 'Escape'],
    ['1', '1', '1', 1, 36, 1, 'Digit1'],
    ['2', '2', '2', 1, 37, 2, 'Digit2'],
    ['3', '3', '3', 1, 38, 3, 'Digit3'],
    ['4', '4', '4', 1, 39, 4, 'Digit4'],
    ['5', '5', '5', 1, 40, 5, 'Digit5'],
    ['6', '6', '6', 1, 41, 6, 'Digit6'],
    ['7', '7', '7', 1, 42, 7, 'Digit7'],
    ['8', '8', '8', 1, 43, 8, 'Digit8'],
    ['9', '9', '9', 1, 44, 9, 'Digit9'],
    ['0', '0', '0', 1, 45, 10, 'Digit0'],
    ['minus', '-', 'Minus', 1, 51, 11, 'Minus'],
    ['equal', '=', 'Equals', 1, 52, 12, 'Equal'],
    ['backspace', 'Backspace', 'Backspace', 2, 48, 13, 'Backspace'],
  ],
  [
    ['tab', 'Tab', 'Tab', 1.5, 49, 14, 'Tab'],
    ['q', 'Q', 'Q', 1, 26, 15, 'KeyQ'],
    ['w', 'W', 'W', 1, 32, 16, 'KeyW'],
    ['e', 'E', 'E', 1, 14, 17, 'KeyE'],
    ['r', 'R', 'R', 1, 27, 18, 'KeyR'],
    ['t', 'T', 'T', 1, 29, 19, 'KeyT'],
    ['y', 'Y', 'Y', 1, 34, 20, 'KeyY'],
    ['u', 'U', 'U', 1, 30, 21, 'KeyU'],
    ['i', 'I', 'I', 1, 18, 22, 'KeyI'],
    ['o', 'O', 'O', 1, 24, 23, 'KeyO'],
    ['p', 'P', 'P', 1, 25, 24, 'KeyP'],
    ['lbracket', '[', 'Left bracket', 1, 53, 25, 'BracketLeft'],
    ['rbracket', ']', 'Right bracket', 1, 54, 26, 'BracketRight'],
    ['backslash', '\\', 'Backslash', 1.5, 55, 27, 'Backslash'],
  ],
  [
    ['caps', 'Caps', 'Caps Lock', 1.75, 62, 28, 'CapsLock'],
    ['a', 'A', 'A', 1, 10, 29, 'KeyA'],
    ['s', 'S', 'S', 1, 28, 30, 'KeyS'],
    ['d', 'D', 'D', 1, 13, 31, 'KeyD'],
    ['f', 'F', 'F', 1, 15, 32, 'KeyF'],
    ['g', 'G', 'G', 1, 16, 33, 'KeyG'],
    ['h', 'H', 'H', 1, 17, 34, 'KeyH'],
    ['j', 'J', 'J', 1, 19, 35, 'KeyJ'],
    ['k', 'K', 'K', 1, 20, 36, 'KeyK'],
    ['l', 'L', 'L', 1, 21, 37, 'KeyL'],
    ['semicolon', ';', 'Semicolon', 1, 56, 38, 'Semicolon'],
    ['quote', "'", 'Quote', 1, 57, 39, 'Quote'],
    ['enter', 'Enter', 'Enter', 2.25, 46, 40, 'Enter'],
  ],
  [
    ['lshift', 'Shift', 'Left Shift', 2, 3, 41, 'ShiftLeft'],
    ['z', 'Z', 'Z', 1, 35, 42, 'KeyZ'],
    ['x', 'X', 'X', 1, 33, 43, 'KeyX'],
    ['c', 'C', 'C', 1, 12, 44, 'KeyC'],
    ['v', 'V', 'V', 1, 31, 45, 'KeyV'],
    ['b', 'B', 'B', 1, 11, 46, 'KeyB'],
    ['n', 'N', 'N', 1, 23, 47, 'KeyN'],
    ['m', 'M', 'M', 1, 22, 48, 'KeyM'],
    ['comma', ',', 'Comma', 1, 59, 49, 'Comma'],
    ['period', '.', 'Period', 1, 60, 50, 'Period'],
    ['slash', '/', 'Slash', 1, 61, 51, 'Slash'],
    ['rshift', 'Shift', 'Right Shift', 1, 7, 52, 'ShiftRight'],
    ['up', '↑', 'Up arrow', 1, 87, 53, 'ArrowUp'],
    ['delete', 'Del', 'Delete', 1, 81, 54, 'Delete'],
  ],
  [
    ['lctrl', 'Ctrl', 'Left Control', 1.25, 2, 55, 'ControlLeft'],
    ['lwin', 'Win', 'Left Windows', 1.25, 5, 56, 'MetaLeft'],
    ['lalt', 'Alt', 'Left Alt', 1.25, 4, 57, 'AltLeft'],
    ['space', '', 'Space', 6.25, 50, 59, 'Space'],
    ['fn', 'Fn', 'Fn', 1, 0, 61],
    ['menu', 'Menu', 'Menu (App)', 1, 1, 62, 'ContextMenu'],
    ['left', '←', 'Left arrow', 1, 85, 63, 'ArrowLeft'],
    ['down', '↓', 'Down arrow', 1, 86, 64, 'ArrowDown'],
    ['right', '→', 'Right arrow', 1, 84, 65, 'ArrowRight'],
  ],
]

function buildKeys(): KeyDef[] {
  const keys: KeyDef[] = []
  rows.forEach((row, y) => {
    let x = 0
    for (const [id, label, name, w, slot, led, code] of row) {
      keys.push({ id, label, name, x, y, w, slot, led, code, fnCode: FN_CODES[id], extraLeds: EXTRA_LEDS[id] })
      x += w
    }
  })
  return keys
}

export const SK64_LAYOUT: KeyboardLayout = {
  name: 'SK64',
  width: 15,
  height: 5,
  fnKeyId: 'fn',
  keys: buildKeys(),
}
