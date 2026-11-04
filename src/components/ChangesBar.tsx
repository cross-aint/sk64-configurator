export type ApplyState =
  | { kind: 'idle' }
  | { kind: 'writing'; step: string }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string }

type Props = {
  /** What hasn't been applied yet, e.g. "2 key changes and new lighting", or null if nothing. */
  pending: string | null
  /** Which keyboard layers the pending key changes are on, e.g. "Windows layer (2) and Base layer (1)". */
  where: string | null
  /** Why writing is impossible right now (not connected, unknown model…), or null if it's allowed. */
  blockedReason: string | null
  applyState: ApplyState
  onApply: () => void
  onDiscard: () => void
  onDismiss: () => void
}

/**
 * The bar pinned to the bottom of the window while something isn't on the keyboard yet, or while
 * writing and right after: what's pending, Discard and Apply to keyboard.
 */
export function ChangesBar({ pending, where, blockedReason, applyState, onApply, onDiscard, onDismiss }: Props) {
  const writing = applyState.kind === 'writing'
  if (!pending && applyState.kind === 'idle') return null

  const summary = writing
    ? applyState.step
    : pending
      ? `${pending[0].toUpperCase()}${pending.slice(1)} not on the keyboard yet`
      : 'Keyboard is up to date'
  const detail =
    applyState.kind === 'done' ? (
      <span className="changes-ok">{applyState.message}</span>
    ) : applyState.kind === 'error' ? (
      <span className="changes-bad">{applyState.message}</span>
    ) : writing ? (
      <span className="label">Keep the keyboard plugged in.</span>
    ) : blockedReason ? (
      <span className="label">{blockedReason}</span>
    ) : (
      <span className="label">{where ? `${where}. ` : ''}Nothing reaches the keyboard until you apply.</span>
    )

  return (
    <div className="changes" data-pending={!!pending || undefined} role="region" aria-label="Changes" aria-live="polite">
      <div className="changes-text">
        <strong>{summary}</strong>
        {detail}
      </div>
      <div className="changes-actions">
        {pending || writing ? (
          <>
            <button type="button" className="neutral" onClick={onDiscard} disabled={!pending || writing}>
              Discard
            </button>
            <button type="button" onClick={onApply} disabled={!pending || writing || !!blockedReason}>
              {writing ? 'Applying…' : 'Apply to keyboard'}
            </button>
          </>
        ) : (
          <button type="button" className="ghost" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
