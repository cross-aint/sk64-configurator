import type { LogEntry } from '../protocol/device'
import { toHex } from '../protocol/packet'

/** Raw packets sent to / received from the keyboard. Meant for troubleshooting and bug reports. */
export function PacketLog({ log }: { log: LogEntry[] }) {
  const copy = () => {
    const text = log
      .map((e) => `${formatTime(e.time)} ${e.direction === 'out' ? '→' : '←'} ${toHex(e.bytes)}${e.note ? `  (${e.note})` : ''}`)
      .join('\n')
    void navigator.clipboard.writeText(text)
  }

  return (
    <div className="packet-log">
      <div className="packet-log-head">
        <p className="muted">Paste this into a bug report if something doesn't work.</p>
        <button className="secondary small" onClick={copy} disabled={log.length === 0}>Copy</button>
      </div>
      <div className="log">
        {log.length === 0 && <p className="muted">Nothing yet.</p>}
        {log.map((entry, i) => (
          <div key={i} className="log-row" data-direction={entry.direction}>
            <span className="log-time">{formatTime(entry.time)}</span>
            <span className="log-dir">{entry.direction === 'out' ? '→' : '←'}</span>
            <code className="log-bytes">{toHex(entry.bytes, 16)}</code>
            {entry.note && <span className="log-note">{entry.note}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatTime(ms: number) {
  return `${(ms / 1000).toFixed(3)}s`
}
