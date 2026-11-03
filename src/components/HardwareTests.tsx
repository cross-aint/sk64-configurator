type Props = {
  /** Number of modes the test writes. */
  count: number
  /** Landmarks to help count: "mode n's row ends on key". */
  landmarks: readonly { n: number; key: string }[]
  /** Why the test can't run right now, or null. */
  blockedReason: string | null
  busy: boolean
  /** Summary of the keyboard's replies from the last run, if any. */
  result: string | null
  issuesUrl: string
  onRun: () => void
}

/** Tests that need a real keyboard to answer an open question. Shown in a collapsed section. */
export function HardwareTests({ count, landmarks, blockedReason, busy, result, issuesUrl, onRun }: Props) {
  return (
    <div className="hardware-tests">
      <h3>How many custom modes does the keyboard hold?</h3>
      <p>
        The keyboard’s mode table has room for {count}. An SK64 with firmware v2.101 kept all {count} (about 23 KB); the
        app itself lets you add 10 to keep things simple. Run this if your keyboard has different firmware. It writes{' '}
        {count} test modes: mode 1 lights 1 key, mode 2 lights 2 keys, and so on in reading order (Esc, 1, 2, …), each in
        its own color.
      </p>
      <ol>
        <li>
          Click <b>Write {count} test modes</b>, then press <kbd>Fn</kbd> + <kbd>]</kbd> again and again. The lit row
          grows by one key each press.
        </li>
        <li>
          When it jumps back to a single key, note the longest row. To help count:{' '}
          {landmarks.map((l, i) => (
            <span key={l.n}>
              {i > 0 && ', '}
              {l.n} ends on <b>{l.key}</b>
            </span>
          ))}
          .
        </li>
        <li>
          Afterwards, click <b>Apply to keyboard</b> to put your own modes back.
        </li>
      </ol>
      <div className="effect-test-actions">
        <button className="small" onClick={onRun} disabled={busy || !!blockedReason}>
          {busy ? 'Writing…' : `Write ${count} test modes`}
        </button>
        {blockedReason && <span className="muted">{blockedReason}</span>}
      </div>
      {result && <p className="hardware-result">{result}</p>}
      <p className="muted small-print">
        If the keyboard shows garbage or stops responding, unplug it and plug it back in, then use <b>Reset keyboard to
        defaults</b>.{' '}
        <a href={issuesUrl} target="_blank" rel="noreferrer">
          Share what you saw
        </a>{' '}
        so the limit can be set for everyone.
      </p>
    </div>
  )
}
