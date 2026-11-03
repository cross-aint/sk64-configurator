type Props = {
  /** Why the test can't run right now, or null. */
  blockedReason: string | null
  busy: boolean
  /** The test is on the keyboard (its key links haven't been cleared yet). */
  active: boolean
  /** Summary of the keyboard's replies from the last run, if any. */
  result: string | null
  issuesUrl: string
  onRun: () => void
  onUndo: () => void
}

/** Hardware test: can keys trigger lighting animations when pressed? */
export function KeyPressTestPanel({ blockedReason, busy, active, result, issuesUrl, onRun, onUndo }: Props) {
  return (
    <div className="hardware-tests">
      <h3>Can keys trigger animations when pressed?</h3>
      <p>
        Skyloong’s software can link a key to a lighting animation that plays when it’s pressed, but how it behaves
        isn’t documented. This writes 4 lighting modes and links 4 keys to them:
      </p>
      <ul>
        <li>
          Mode 1: dim blue on every key (the keyboard shows this right after writing)
        </li>
        <li>Mode 2: a white flash on every key</li>
        <li>Mode 3: a red burst spreading out from Enter</li>
        <li>Mode 4: a green sweep from left to right</li>
      </ul>
      <ol>
        <li>
          Click <b>Write key-press test</b>. The keyboard should turn dim blue.
        </li>
        <li>
          Press <kbd>Esc</kbd>, <kbd>Enter</kbd>, <kbd>Space</kbd> and <kbd>Q</kbd>, one at a time, and note what each
          does. If the numbers count from 0, Esc flashes white, Enter bursts red and Space sweeps green. If they count
          from 1, it’s shifted: Enter flashes white and Space bursts red.
        </li>
        <li>Does an animation play once per press, keep going, or only while the key is held?</li>
        <li>
          Press <kbd>Fn</kbd> + <kbd>]</kbd> a few times: do the flash, burst and sweep show up as modes 2–4?
        </li>
        <li>
          Click <b>Undo key-press test</b>, or <b>Apply to keyboard</b> (which also clears the key links), to go back to
          your own modes.
        </li>
      </ol>
      <div className="effect-test-actions">
        <button className="small" onClick={onRun} disabled={busy || !!blockedReason}>
          {busy ? 'Writing…' : 'Write key-press test'}
        </button>
        <button className="secondary small" onClick={onUndo} disabled={busy || !!blockedReason || !active}>
          Undo key-press test
        </button>
        {blockedReason && <span className="muted">{blockedReason}</span>}
      </div>
      {result && <p className="hardware-result">{result}</p>}
      <p className="muted small-print">
        This uses a command no open-source tool has written before. If the keyboard misbehaves, unplug it and plug it
        back in, then use <b>Reset keyboard to defaults</b>, which also clears the key links.{' '}
        <a href={issuesUrl} target="_blank" rel="noreferrer">
          Share what you saw
        </a>
        .
      </p>
    </div>
  )
}
