# SK64 Configurator

A browser-based replacement for the official Skyloong software, for the wired **Skyloong SK64**
(USB `1EA7:0907`). It talks to the keyboard directly using WebHID, so it needs desktop
**Chrome or Edge**.

SK64 boards report one of two model IDs; both have the same 64-key layout:

| Model ID | Firmware ID | Name in GK6X data | Notes |
|---|---|---|---|
| `900000004` | `0x90219224` | "64 RGB" | Confirmed on our wired SK64, firmware v2.101 |
| `656801886` | `0x90219221` | "SK64 RGB" | Reported by other GK6X users (v1.37) |

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 in Chrome or Edge. Close the official Skyloong software first.

## Status

- **Step 1 – connection test (done):** connects and reads the keyboard's model, firmware ID and
  version. Read-only.
- **Step 2 – on-screen keyboard (done):** clickable SK64 layout and a key tester that lights up
  keys as you press them.
- **Step 3 – key remapping (done):** remap any key except Fn on the
  normal and Fn layers, combos like Ctrl+C, Apply / Discard, factory reset, profile export/import.
  Normal-layer remaps are confirmed on hardware; Fn-layer remaps are not yet.
- **Step 4 – lighting (done):** a list of custom lighting modes the keyboard steps through with Fn + ]:
  painted colors (MS Paint style palette, hex input, eyedropper, or colors taken from a picture you
  place over the keyboard), waves, rain, breathing and rainbow, with a live preview. Key reactions
  (ripple in four shapes, key glow, flash, sweep) play when chosen keys are pressed. Animated modes
  can borrow painted colors (dark bar, spotlight, painted rain) and run on chosen keys over a painted
  background. Or go back to
  the keyboard's built-in modes. Includes a map of the keyboard's Fn lighting shortcuts.
  Painted colors and animated modes are confirmed on hardware.
- Step 5 – macros

## Protocol notes

Based on the reverse-engineering in [pixeltris/GK6X](https://github.com/pixeltris/GK6X) (MIT).
GK6X's `Build/Data` files are proprietary to the keyboard maker and are **not** copied here.

- Settings go through the vendor-defined HID interface (usage page `0xFF00`), report ID 0,
  64-byte packets.
- Packet: `[0]` command, `[1]` sub-command, `[2]` status in replies (1 = OK),
  `[6-7]` CRC-16/CCITT-FALSE of the packet with those bytes zeroed, `[8-63]` data.
- Handshake (all read-only): `01 09` buffer sizes, `01 01` firmware ID + version,
  `01 08` model ID (+ its own CRC).
- Each key has two firmware numbers: a **slot** in the key-mapping table (112 slots on the
  SK64) and an **LED index** for lighting. Both are in `src/keyboard/layout.ts`.
- Writing a layer: `21 <layer> 01` resets its key table (`07` for the Fn table), then `22 <layer>`
  (`31` for Fn) sends 112 four-byte values in 56-byte chunks, then `0B <layer>` re-selects the
  layer. `0xFFFFFFFF` means "firmware default", so only changed keys need real values.
- Key values: `0x0200KKMM` normal key (KK = USB HID code, MM = modifier bits), `0x0300xxxx`
  media, `0x0101000B` mouse button, `0x09xxxxxx` lighting controls. Fn can't be remapped.
- Lighting: `21 <layer> 06` resets a layer's lighting (that alone restores the built-in effects),
  then `27 <layer>` sends the effect block: a table of 32 effect slots (16 bytes each), then each
  effect's data. A static effect is `uint16 0`, `uint16 704`, then one `[R, G, B, FF]` color per
  LED (176). This command's header uses a 24-bit offset in bytes 2–4 and the length in byte 5.
- Animated effects (type 3, confirmed on hardware): one entry per frame tick, each a 22-byte bit
  mask of lit LEDs, then color groups (fixed, rainbow or breathing) over sets of LEDs. Frames
  only switch LEDs on and off. Fn + ] steps through every filled slot and wraps around.
- All 32 slots work (tested with 32 static effects, about 23 KB). The app allows up to 10 modes;
  key reactions use the remaining slots.
- Key-press lighting (confirmed on an SK64): `26 <layer>` sends one byte per key slot naming the
  lighting effect to play when that key is pressed, counting from 0 (`0xFF` = none);
  `21 <layer> 05` clears it. The numbers point into the same effect table as the Fn + ] modes, so
  reaction animations also show up as modes. Pressing a linked key plays its animation, then the
  keyboard settles on the first mode, whichever mode was showing before. Reactions that ended
  without a closing frame kept repeating in testing, so the app ends each one with a one-tick
  frame. A fully dark one showed as a brief blank, so when the reaction keeps the base colors the
  closing frame shows them too (confirmed: no blank, and it still stops the repeat).
- Color groups: Skyloong's own effects use at most 30. Animations with more (one per color of a
  colorful painting) lit later keys white on an SK64, so the app merges the closest colors until an
  animation has at most 30 groups (confirmed: the white keys are gone).
- At default speed the keyboard plays about 15 ticks per second; Fn + ← / → change how long an
  animation takes, from about 1.75× the default (slowest) to 0.35× (fastest).

## Code layout

- `src/protocol/` – talking to the keyboard (packets, checksum, WebHID connection)
- `src/keyboard/` – SK64 layout, key value catalog, defaults, keymaps, lighting, Fn shortcuts and profile files
- `src/hooks/` – app state (connection, keymap and lighting edits, paint palette, key tester)
- `src/components/` – UI, purely presentational
- `src/styles/tokens.css` – all colors, sizes and fonts

See [DESIGN.md](DESIGN.md) for notes on redesigning the interface.
