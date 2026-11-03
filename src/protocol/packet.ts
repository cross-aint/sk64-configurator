import { crc16 } from './crc16'

// Packet layout (64 bytes, sent as HID report 0):
//   [0]    command
//   [1]    sub-command (for layer commands: the layer)
//   [2]    status in replies (1 = OK); in requests either an extra argument (e.g. which
//          table to reset) or the low byte of the data offset for multi-packet writes
//   [3]    high byte of the data offset
//   [4]    number of data bytes in this packet (multi-packet writes)
//   [6-7]  CRC-16 of the whole packet, computed with these two bytes set to 0
//   [8-63] data (up to 56 bytes)

export const PACKET_SIZE = 64
export const DATA_OFFSET = 8
export const DATA_SIZE = PACKET_SIZE - DATA_OFFSET

export const Command = {
  Info: 0x01,
  SetLayer: 0x0b,
  Ping: 0x0c,
  DriverKeyCallback: 0x18,
  /** Clears one table (keys, Fn keys, lighting…) of a layer. Table type goes in byte 2. */
  LayerResetTable: 0x21,
  LayerSetKeys: 0x22,
  LayerSetFnKeys: 0x31,
} as const

export const InfoSub = {
  FirmwareId: 0x01,
  ModelId: 0x08,
  InitBuffers: 0x09,
} as const

/** The keyboard's onboard layers. "Base" is the one in use unless the user switches. */
export const Layer = {
  Base: 1,
  Layer1: 2,
  Layer2: 3,
  Layer3: 4,
} as const

export const LayerTable = {
  Keys: 1,
  FnKeys: 7,
} as const

export type PacketHeader = {
  /** Value for byte 2 when it's used as an argument rather than an offset. */
  arg?: number
  /** Multi-packet writes: where this packet's data goes, and how many bytes it carries. */
  offset?: number
  length?: number
}

export function buildPacket(
  command: number,
  sub: number,
  data?: Uint8Array,
  header: PacketHeader = {},
): Uint8Array<ArrayBuffer> {
  const packet = new Uint8Array(PACKET_SIZE)
  packet[0] = command
  packet[1] = sub
  if (header.arg !== undefined) packet[2] = header.arg
  if (header.offset !== undefined) {
    packet[2] = header.offset & 0xff
    packet[3] = (header.offset >> 8) & 0xff
  }
  if (header.length !== undefined) packet[4] = header.length
  if (data) packet.set(data.subarray(0, DATA_SIZE), DATA_OFFSET)
  writeCrc(packet)
  return packet
}

function writeCrc(packet: Uint8Array) {
  packet[6] = 0
  packet[7] = 0
  const crc = crc16(packet)
  packet[6] = crc & 0xff
  packet[7] = crc >> 8
}

export function hasValidCrc(packet: Uint8Array): boolean {
  const copy = packet.slice()
  const expected = copy[6] | (copy[7] << 8)
  copy[6] = 0
  copy[7] = 0
  return crc16(copy) === expected
}

export function toHex(bytes: Uint8Array, max = bytes.length): string {
  const parts = Array.from(bytes.subarray(0, max), (b) => b.toString(16).padStart(2, '0'))
  return parts.join(' ') + (bytes.length > max ? ' …' : '')
}

export function hex32(value: number): string {
  return '0x' + (value >>> 0).toString(16).toUpperCase().padStart(8, '0')
}
