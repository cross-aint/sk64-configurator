import { crc16 } from './crc16'
import {
  buildPacket,
  Command,
  DATA_OFFSET,
  DATA_SIZE,
  hasValidCrc,
  InfoSub,
  LayerTable,
  PACKET_SIZE,
  type PacketHeader,
} from './packet'

export const VENDOR_ID = 0x1ea7
export const PRODUCT_ID = 0x0907
// The keyboard exposes several HID interfaces; settings go through the vendor-defined one.
export const CONFIG_USAGE_PAGE = 0xff00

// Model IDs and firmware IDs as reported by the keyboard. SK64 boards ship with either one:
// both have the same 64-key layout. 900000004 is a generic "64 RGB" firmware shared with
// other brands' 64-key boards (e.g. AK64) and was confirmed on a wired SK64 (firmware v2.101).
export const KNOWN_MODELS: Record<number, { name: string; firmwareId: number }> = {
  656801886: { name: 'SK64 RGB', firmwareId: 0x90219221 },
  900000004: { name: 'SK64 (generic "64 RGB" firmware)', firmwareId: 0x90219224 },
}

export type LogEntry = { direction: 'out' | 'in'; bytes: Uint8Array; time: number; note?: string }

export type KeyboardInfo = {
  productName: string
  bufferSizeA: number
  bufferSizeB: number
  firmwareId: number
  firmwareVersion: string
  modelId: number
  modelCrcValid: boolean
  knownModel?: { name: string; firmwareId: number }
}

const RESPONSE_TIMEOUT_MS = 1000

export function isWebHidSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator
}

function hasConfigInterface(device: HIDDevice): boolean {
  return device.collections.some((c) => c.usagePage === CONFIG_USAGE_PAGE)
}

/** Asks the user to pick the keyboard. Returns null if they cancel. */
export async function requestKeyboard(): Promise<HIDDevice | null> {
  const devices = await navigator.hid.requestDevice({
    filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID, usagePage: CONFIG_USAGE_PAGE }],
  })
  return devices.find(hasConfigInterface) ?? null
}

/** Keyboards the user already allowed on an earlier visit, so we can skip the picker. */
export async function getAllowedKeyboard(): Promise<HIDDevice | null> {
  const devices = await navigator.hid.getDevices()
  return (
    devices.find((d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID && hasConfigInterface(d)) ?? null
  )
}

type Pending = { command: number; resolve: (data: Uint8Array) => void; reject: (err: Error) => void }

export class KeyboardConnection {
  private pending: Pending | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private readonly device: HIDDevice
  private readonly onLog: (entry: LogEntry) => void

  constructor(device: HIDDevice, onLog: (entry: LogEntry) => void) {
    this.device = device
    this.onLog = onLog
  }

  get hidDevice() {
    return this.device
  }

  async open() {
    if (!this.device.opened) await this.device.open()
    this.device.addEventListener('inputreport', this.handleReport)
  }

  async close() {
    this.device.removeEventListener('inputreport', this.handleReport)
    this.pending?.reject(new Error('Disconnected'))
    this.pending = null
    if (this.device.opened) await this.device.close()
  }

  private handleReport = (event: HIDInputReportEvent) => {
    const bytes = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength).slice()
    const isReply = this.pending !== null && bytes[0] === this.pending.command
    this.onLog({
      direction: 'in',
      bytes,
      time: performance.now(),
      note: isReply ? undefined : bytes[0] === Command.DriverKeyCallback ? 'key event (ignored)' : 'unrequested (ignored)',
    })
    if (!isReply || !this.pending) return
    const { resolve, reject } = this.pending
    this.pending = null
    if (event.reportId !== 0) reject(new Error(`Unexpected report ID ${event.reportId}`))
    else if (!hasValidCrc(bytes)) reject(new Error('Reply failed its checksum'))
    else resolve(bytes)
  }

  /** Sends one packet and waits for the reply with the same command byte. Commands run one at a time. */
  send(command: number, sub: number, data?: Uint8Array, header?: PacketHeader): Promise<Uint8Array> {
    const run = () =>
      new Promise<Uint8Array>((resolve, reject) => {
        const packet = buildPacket(command, sub, data, header)
        const timer = setTimeout(() => {
          if (this.pending?.command === command) this.pending = null
          reject(new Error(`No reply to command ${command.toString(16)} ${sub.toString(16)} within ${RESPONSE_TIMEOUT_MS} ms`))
        }, RESPONSE_TIMEOUT_MS)
        this.pending = {
          command,
          resolve: (reply) => {
            clearTimeout(timer)
            resolve(reply)
          },
          reject: (err) => {
            clearTimeout(timer)
            reject(err)
          },
        }
        this.onLog({ direction: 'out', bytes: packet, time: performance.now() })
        this.device.sendReport(0, packet).catch((err: unknown) => {
          this.pending = null
          clearTimeout(timer)
          reject(err instanceof Error ? err : new Error(String(err)))
        })
      })
    const result = this.queue.then(run, run)
    this.queue = result.catch(() => undefined)
    return result
  }

  /** Read-only info request. Every handshake reply has status byte 1. */
  private async info(sub: number): Promise<DataView> {
    const reply = await this.send(Command.Info, sub)
    if (reply[1] !== sub) throw new Error(`Reply was for sub-command ${reply[1]}, expected ${sub}`)
    if (reply[2] !== 1) throw new Error(`Keyboard reported status ${reply[2]} for info request ${sub}`)
    return new DataView(reply.buffer, reply.byteOffset + DATA_OFFSET, PACKET_SIZE - DATA_OFFSET)
  }

  /** The same three read-only requests the official software makes on connect. */
  async handshake(): Promise<KeyboardInfo> {
    const buffers = await this.info(InfoSub.InitBuffers)
    const bufferSizeA = buffers.getUint8(0)
    const bufferSizeB = buffers.getUint8(1)

    const firmware = await this.info(InfoSub.FirmwareId)
    const firmwareId = firmware.getUint32(0, true)
    const minor = firmware.getUint8(4)
    const major = firmware.getUint8(5)

    const model = await this.info(InfoSub.ModelId)
    const modelId = model.getUint32(0, true)
    const modelBytes = new Uint8Array(model.buffer, model.byteOffset, 6)
    const modelCrcValid = crc16(modelBytes) === model.getUint16(6, true)

    return {
      productName: this.device.productName,
      bufferSizeA,
      bufferSizeB,
      firmwareId,
      firmwareVersion: `${major}.${minor} (raw 0x${((major << 8) | minor).toString(16).padStart(4, '0')})`,
      modelId,
      modelCrcValid,
      knownModel: KNOWN_MODELS[modelId],
    }
  }

  /**
   * Sends a block of data split across as many packets as needed (56 bytes each), each
   * tagged with its offset and length. Like the official software, this always sends
   * floor(n / 56) + 1 packets, so a block that's an exact multiple of 56 bytes ends with
   * an empty packet. Returns the status byte of each reply (what it means for writes isn't
   * documented; it's recorded so hardware tests can look for rejections).
   */
  private async sendBlock(command: number, sub: number, block: Uint8Array, wide = false): Promise<number[]> {
    const packets = Math.floor(block.length / DATA_SIZE) + 1
    const statuses: number[] = []
    for (let i = 0; i < packets; i++) {
      const offset = i * DATA_SIZE
      const chunk = block.subarray(offset, offset + DATA_SIZE)
      const reply = await this.send(command, sub, chunk, { offset, length: chunk.length, wide })
      statuses.push(reply[2])
    }
    return statuses
  }

  /** Switches the active layer. Also makes the keyboard pick up freshly written key tables. */
  async setLayer(layer: number) {
    await this.send(Command.SetLayer, layer)
  }

  /**
   * Replaces a layer's whole key table (normal or Fn). `values` has one entry per firmware
   * slot; UNCHANGED_KEY (0xFFFFFFFF) means "use the firmware's built-in default".
   */
  async writeKeyTable(layer: number, fn: boolean, values: Uint32Array) {
    await this.send(Command.LayerResetTable, layer, undefined, { arg: fn ? LayerTable.FnKeys : LayerTable.Keys })
    const block = new Uint8Array(values.length * 4)
    const view = new DataView(block.buffer)
    values.forEach((value, i) => view.setUint32(i * 4, value, true))
    await this.sendBlock(fn ? Command.LayerSetFnKeys : Command.LayerSetKeys, layer, block)
  }

  /**
   * Replaces a layer's key-press lighting table: one byte per key slot naming the lighting effect
   * to play when that key is pressed (0xFF = none). With null, the table is just cleared.
   * Experimental: seen in the official software's traffic, not documented.
   */
  async writeKeyPressLighting(layer: number, table: Uint8Array | null): Promise<number[]> {
    await this.send(Command.LayerResetTable, layer, undefined, { arg: LayerTable.KeyPressLighting })
    return table ? this.sendBlock(Command.LayerSetKeyPressLighting, layer, table) : []
  }

  /**
   * Replaces a layer's lighting. With no effects block, the layer goes back to the lighting
   * effects built into the firmware. Returns the reply status of each lighting data packet.
   */
  async writeLighting(layer: number, effects: Uint8Array | null): Promise<number[]> {
    await this.send(Command.LayerResetTable, layer, undefined, { arg: LayerTable.Lighting })
    return effects ? this.sendBlock(Command.LayerSetLighting, layer, effects, true) : []
  }
}

/** Key table value meaning "this slot keeps the firmware's default function". */
export const UNCHANGED_KEY = 0xffffffff
