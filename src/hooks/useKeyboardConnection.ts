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
   * Writes the base layer's normal and Fn key tables, then re-selects the base layer so the
   * keyboard starts using them. Each table must have one entry per firmware slot.
   */
  const writeBaseLayer = useCallback(
    async (tables: { normal: Uint32Array; fn: Uint32Array }, onStep?: (step: string) => void) => {
      const conn = connection.current
      if (!conn) throw new Error('The keyboard is not connected.')
      onStep?.('Writing normal layer…')
      await conn.writeKeyTable(Layer.Base, false, tables.normal)
      onStep?.('Writing Fn layer…')
      await conn.writeKeyTable(Layer.Base, true, tables.fn)
      onStep?.('Activating…')
      await conn.setLayer(Layer.Base)
    },
    [],
  )

  return { status, log, connect, disconnect, readInfo, writeBaseLayer }
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
