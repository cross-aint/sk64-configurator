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
- Step 4 – lighting
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

## Code layout

- `src/protocol/` – talking to the keyboard (packets, checksum, WebHID connection)
- `src/keyboard/` – SK64 layout, key value catalog, defaults, keymaps and profile files
- `src/hooks/` – app state (connection, keymap edits, key tester)
- `src/components/` – UI, purely presentational
- `src/styles/tokens.css` – all colors, sizes and fonts

See [DESIGN.md](DESIGN.md) for notes on redesigning the interface.
