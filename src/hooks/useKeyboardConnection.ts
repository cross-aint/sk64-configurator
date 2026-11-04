import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getAllowedKeyboard,
  isWebHidSupported,
  KeyboardConnection,
  requestKeyboard,
  type KeyboardInfo,
  type LogEntry,
} from '../protocol/device'
import { Layer } from '../protocol/packet'

export type ConnectionStatus =
  | { kind: 'unsupported' }
  | { kind: 'disconnected' }
  | { kind: 'working'; message: string }
  | { kind: 'connected'; info: KeyboardInfo }
  | { kind: 'error'; message: string }

const MAX_LOG = 200

/** What to write to the base layer. Leave a part out to keep what's on the keyboard. */
export type BaseLayerWrite = {
  /** Full key tables, one entry per firmware slot (leave out `fn` to keep the Fn table). */
  keys?: { normal: Uint32Array; fn?: Uint32Array }
  /** Lighting block, or null to restore the built-in effects. */
  lighting?: Uint8Array | null
  /** Key-press lighting table (experimental), or null to clear it. */
  keyPress?: Uint8Array | null
  /** Macros block (experimental), or null to clear them. */
  macros?: Uint8Array | null
}

/** Reply status of each data packet sent, by part (empty for parts not written). */
export type LayerWriteReplies = {
  macroReplies: number[]
  /** Normal key table only. */
  keyReplies: number[]
  lightingReplies: number[]
  keyPressReplies: number[]
}

/** Owns the WebHID connection. UI components only read `status` / `log` and call the actions. */
export function useKeyboardConnection() {
  const supported = isWebHidSupported()
  const [status, setStatus] = useState<ConnectionStatus>(supported ? { kind: 'disconnected' } : { kind: 'unsupported' })
  const [log, setLog] = useState<LogEntry[]>([])
  const connection = useRef<KeyboardConnection | null>(null)
  const logStart = useRef(0)

  // Log times are stored relative to when "Connect" was clicked.
  const addLog = useCallback((entry: LogEntry) => {
    const relative = { ...entry, time: entry.time - logStart.current }
    setLog((prev) => [...prev.slice(-(MAX_LOG - 1)), relative])
  }, [])

  const readInfo = useCallback(async () => {
    const conn = connection.current
    if (!conn) return
    setStatus({ kind: 'working', message: 'Reading keyboard info…' })
    try {
      setStatus({ kind: 'connected', info: await conn.handshake() })
    } catch (err) {
      setStatus({ kind: 'error', message: errorText(err) })
    }
  }, [])

  const connect = useCallback(async () => {
    setLog([])
    logStart.current = performance.now()
    try {
      setStatus({ kind: 'working', message: 'Waiting for you to pick the keyboard…' })
      const device = (await getAllowedKeyboard()) ?? (await requestKeyboard())
      if (!device) {
        setStatus({ kind: 'disconnected' })
        return
      }
      setStatus({ kind: 'working', message: 'Opening connection…' })
      await connection.current?.close()
      const conn = new KeyboardConnection(device, addLog)
      await conn.open()
      connection.current = conn
      await readInfo()
    } catch (err) {
      setStatus({ kind: 'error', message: errorText(err) })
    }
  }, [addLog, readInfo])

  const disconnect = useCallback(async () => {
    await connection.current?.close()
    connection.current = null
    setStatus({ kind: 'disconnected' })
  }, [])

  // Notice when the keyboard is unplugged.
  useEffect(() => {
    if (!supported) return
    const onDisconnect = (event: HIDConnectionEvent) => {
      if (connection.current?.hidDevice === event.device) {
        connection.current = null
        setStatus({ kind: 'error', message: 'The keyboard was unplugged.' })
      }
    }
    navigator.hid.addEventListener('disconnect', onDisconnect)
    return () => navigator.hid.removeEventListener('disconnect', onDisconnect)
  }, [supported])

  useEffect(() => () => void connection.current?.close(), [])

  /**
   * Writes macros, key tables and/or lighting to a layer, then selects that layer so the keyboard
   * starts using them. Returns the reply status of each data packet, by part.
   */
  const writeLayer = useCallback(
    async (layer: number, changes: BaseLayerWrite, onStep?: (step: string) => void): Promise<LayerWriteReplies> => {
      const conn = connection.current
      if (!conn) throw new Error('The keyboard is not connected.')
      const replies: LayerWriteReplies = { macroReplies: [], keyReplies: [], lightingReplies: [], keyPressReplies: [] }
      // Macros before keys, so a key never points at a macro that isn't there yet.
      if (changes.macros !== undefined) {
        onStep?.('Writing macros…')
        replies.macroReplies = await conn.writeMacros(layer, changes.macros)
      }
      if (changes.keys) {
        onStep?.('Writing normal layer…')
        replies.keyReplies = await conn.writeKeyTable(layer, false, changes.keys.normal)
        if (changes.keys.fn) {
          onStep?.('Writing Fn layer…')
          await conn.writeKeyTable(layer, true, changes.keys.fn)
        }
      }
      if (changes.lighting !== undefined) {
        onStep?.('Writing lighting…')
        replies.lightingReplies = await conn.writeLighting(layer, changes.lighting)
      }
      if (changes.keyPress !== undefined) {
        onStep?.('Writing key-press lighting…')
        replies.keyPressReplies = await conn.writeKeyPressLighting(layer, changes.keyPress)
      }
      onStep?.('Activating…')
      await conn.setLayer(layer)
      return replies
    },
    [],
  )

  /** writeLayer for the base layer, the one the app edits. */
  const writeBaseLayer = useCallback(
    (changes: BaseLayerWrite, onStep?: (step: string) => void) => writeLayer(Layer.Base, changes, onStep),
    [writeLayer],
  )

  return { status, log, connect, disconnect, readInfo, writeLayer, writeBaseLayer }
}

function errorText(err: unknown) {
  if (err instanceof DOMException && err.name === 'NotAllowedError') {
    return 'The browser blocked access to the keyboard. Another program (like the official software) may be using it.'
  }
  if (err instanceof DOMException && err.name === 'InvalidStateError') {
    return 'Could not open the keyboard. Close the official Skyloong software and try again.'
  }
  return err instanceof Error ? err.message : String(err)
}
