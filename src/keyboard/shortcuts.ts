// The keyboard's own lighting shortcuts (hold Fn, then press the key). They're handled inside
// the keyboard and never reach the computer, so this app can only document them.
//
// Source: Skyloong's RGB guide, GK64 chart. The GK64 shares the SK64's 64-key layout.

export type Shortcut = {
  /** Key pressed together with Fn (a key id from the layout). */
  keyId: string
  /** Short legend drawn on the key in the shortcut map. */
  cap: string
  label: string
  detail?: string
}

export const LIGHTING_SHORTCUTS: readonly Shortcut[] = [
  { keyId: 'backslash', cap: 'On/Off', label: 'Backlight on / off' },
  { keyId: 'p', cap: 'Pause', label: 'Pause / play the mode', detail: 'Freezes the animation where it is.' },
  {
    keyId: 'rbracket',
    cap: 'Custom',
    label: 'Next custom mode',
    detail: 'The modes you make here, in list order (the 5 factory modes while Built-in modes is selected).',
  },
  { keyId: 'lbracket', cap: 'Built-in', label: 'Next built-in mode', detail: 'Built-in modes 1–4, which can’t be changed.' },
  { keyId: 'up', cap: '☀+', label: 'Brightness up' },
  { keyId: 'down', cap: '☀−', label: 'Brightness down' },
  { keyId: 'right', cap: 'Fast', label: 'Animation speed up' },
  { keyId: 'left', cap: 'Slow', label: 'Animation speed down' },
]

/** How to reach each layer. Skyloong's manual marks them with a number in a hexagon (`mode`). */
export type LayerShortcut = {
  mode: 1 | 2 | 3
  name: string
  /** Key pressed together with Fn, or null for the FNX layer, which is held. */
  fnKeyId: string | null
  /** Short legend drawn on that key in the shortcut map. */
  cap: string
  detail: string
}

export const LAYER_SHORTCUTS: readonly LayerShortcut[] = [
  { mode: 1, name: 'Windows layer', fnKeyId: 'w', cap: 'Win', detail: 'Switches the keyboard to its Windows layer.' },
  {
    mode: 2,
    name: 'macOS layer',
    fnKeyId: 'e',
    cap: 'Mac',
    detail: 'Switches to the macOS layer, where Win acts as Option and Alt as Command, as printed on the keys.',
  },
  {
    mode: 3,
    name: 'FNX layer',
    fnKeyId: null,
    cap: 'FNX',
    detail: 'Active while you hold a key set to FNX on the Windows or macOS layer. Hold FNX and Fn for its Fn layer.',
  },
]

export const SHORTCUT_SOURCE = {
  name: 'Skyloong’s RGB guide (GK64 chart)',
  url: 'https://skyloong.vip/blogs/news/skyloong-keyboard-rgb-user-guide',
}
