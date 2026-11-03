import type { ConnectionStatus } from '../hooks/useKeyboardConnection'

type Props = {
  status: ConnectionStatus
  onConnect: () => void
  onDisconnect: () => void
}

const LABELS: Record<ConnectionStatus['kind'], string> = {
  unsupported: 'Browser not supported',
  disconnected: 'Not connected',
  working: 'Connecting…',
  connected: 'Connected',
  error: 'Connection problem',
}

/** Status pill + connect/disconnect button. Sits in the app header. */
export function ConnectionBar({ status, onConnect, onDisconnect }: Props) {
  const name = status.kind === 'connected' ? status.info.knownModel?.name ?? `Model ${status.info.modelId}` : null

  return (
    <div className="connection-bar">
      <span className="status-pill" data-status={status.kind}>
        <span className="status-dot" aria-hidden />
        {name ?? LABELS[status.kind]}
      </span>
      {status.kind === 'connected' ? (
        <button className="secondary small" onClick={onDisconnect}>Disconnect</button>
      ) : status.kind !== 'unsupported' ? (
        <button className="small" onClick={onConnect} disabled={status.kind === 'working'}>
          {status.kind === 'working' ? 'Working…' : 'Connect'}
        </button>
      ) : null}
    </div>
  )
}
