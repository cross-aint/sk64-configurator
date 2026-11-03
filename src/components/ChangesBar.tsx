import { useRef, useState } from 'react'

export type ApplyState =
  | { kind: 'idle' }
  | { kind: 'writing'; step: string }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string }

type Props = {
  pendingCount: number
  /** Why writing is impossible right now (not connected, unknown model…), or null if it's allowed. */
  blockedReason: string | null
  applyState: ApplyState
  onApply: () => void
  onDiscard: () => void
  onResetKeyboard: () => void
  onExport: () => void
  onImport: (text: string) => void
}

/** Pending-changes summary with Apply / Discard, factory reset, and profile import/export. */
export function ChangesBar(props: Props) {
  const { pendingCount, blockedReason, applyState, onApply, onDiscard, onResetKeyboard, onExport, onImport } = props
  const [confirmReset, setConfirmReset] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const writing = applyState.kind === 'writing'

  const summary =
    applyState.kind === 'writing'
      ? applyState.step
      : pendingCount > 0
        ? `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} not on the keyboard yet`
        : 'Keyboard is up to date'

  return (
    <div className="changes" data-pending={pendingCount > 0 || undefined}>
      <div className="changes-main">
        <div className="changes-text">
          <strong>{summary}</strong>
          {blockedReason && pendingCount > 0 && !writing && <span className="muted">{blockedReason}</span>}
          {applyState.kind === 'done' && <span className="changes-ok">{applyState.message}</span>}
          {applyState.kind === 'error' && <span className="changes-bad">{applyState.message}</span>}
        </div>
        <div className="changes-actions">
          <button className="secondary small" onClick={onDiscard} disabled={pendingCount === 0 || writing}>
            Discard
          </button>
          <button className="small" onClick={onApply} disabled={pendingCount === 0 || writing || !!blockedReason}>
            {writing ? 'Applying…' : 'Apply to keyboard'}
          </button>
        </div>
      </div>

      <div className="changes-secondary">
        <button className="link" onClick={onExport} disabled={writing}>Export profile</button>
        <button className="link" onClick={() => fileInput.current?.click()} disabled={writing}>Import profile</button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onImport(await file.text())
          }}
        />
        <span className="spacer" />
        {confirmReset ? (
          <span className="confirm">
            <span className="muted">Restore every key on the keyboard to factory defaults?</span>
            <button
              className="danger small"
              onClick={() => {
                setConfirmReset(false)
                onResetKeyboard()
              }}
            >
              Yes, reset
            </button>
            <button className="secondary small" onClick={() => setConfirmReset(false)}>Cancel</button>
          </span>
        ) : (
          <button className="link danger-text" onClick={() => setConfirmReset(true)} disabled={writing || !!blockedReason}>
            Reset keyboard to defaults
          </button>
        )}
      </div>
    </div>
  )
}
