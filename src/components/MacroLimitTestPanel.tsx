import { KeyRecorder } from './KeyRecorder'

type Props = {
  /** Number of macros the test writes. */
  count: number
  /** Where each keyboard row starts and ends in the test's numbering. */
  rows: readonly { from: number; to: number; first: string; last: string }[]
  /** Why the test can't run right now, or null. */
  blockedReason: string | null
  busy: boolean
  /** The test is on the keyboard (not undone yet). */
  active: boolean
  /** Summary of the keyboard's replies from the last run, if any. */
  result: string | null
  issuesUrl: string
  onRun: () => void
  onUndo: () => void
}

/** Hardware test: how many macros does the keyboard keep? */
export function MacroLimitTestPanel({ count, rows, blockedReason, busy, active, result, issuesUrl, onRun, onUndo }: Props) {
  const disabled = busy || !!blockedReason
  return (
    <div className="hardware-tests">
      <h3>How many macros does the keyboard keep?</h3>
      <p>
        An SK64 with firmware v2.101 kept all {count}, so the app allows {count}. Run this if your keyboard has different
        firmware. It writes {count} test macros to the Windows layer, one per key (all but Fn),
        and switches the keyboard to that layer. Each key types its own number: Esc types <code>1</code>, the 1 key types{' '}
        <code>2</code>, and so on in reading order.
      </p>
      <ol>
        <li>
          Click <b>Write {count} test macros</b>. Writing about 32 KB takes a few seconds.
        </li>
        <li>
          Click in the box below and press the first key of each row:{' '}
          {rows.map((r, i) => (
            <span key={r.from}>
              {i > 0 && ', '}
              <b>{r.first}</b> ({r.from}–{r.to}, ending on {r.last})
            </span>
          ))}
          . Find the last row whose first key still types its number, then press along that row. The highest number that
          appears is how many macros the keyboard kept.
        </li>
        <li>
          Click <b>Undo macro test</b> to put your own macros and Windows-layer keys back and return to the base layer.
        </li>
      </ol>
      <div className="effect-test-actions">
        <button className="small" onClick={onRun} disabled={disabled || active}>
          {busy ? 'Writing…' : `Write ${count} test macros`}
        </button>
        <button className="secondary small" onClick={onUndo} disabled={disabled || !active}>
          Undo macro test
        </button>
        {blockedReason && <span className="muted">{blockedReason}</span>}
      </div>
      {result && <p className="hardware-result">{result}</p>}
      <KeyRecorder label="Typing area for the macro limit test" placeholder="Click here, then press keys on the Windows layer" />
      <p className="muted small-print">
        If the keyboard misbehaves, unplug it and plug it back in, then use <b>Reset keyboard to defaults</b>. Skyloong’s
        software also lists <kbd>Fn</kbd> + <kbd>Esc</kbd> + <kbd>Q</kbd> for clearing all of the keyboard’s settings.{' '}
        <a href={issuesUrl} target="_blank" rel="noreferrer">
          Share what you saw
        </a>{' '}
        so the limit can be set for everyone.
      </p>
    </div>
  )
}
