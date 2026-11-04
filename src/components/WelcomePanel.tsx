type Props = {
  /** Connecting isn't possible here (browser without WebHID). */
  unsupported: boolean
  connecting: boolean
  onConnect: () => void
  onPlan: () => void
}

/** First visit, not connected: how to connect, or plan without connecting. */
export function WelcomePanel({ unsupported, connecting, onConnect, onPlan }: Props) {
  return (
    <section className="tile welcome" aria-labelledby="welcome-title">
      <div>
        <h2 id="welcome-title">Set up your SK64</h2>
        <p className="muted">Remap keys, design lighting and record macros, right here in the browser.</p>
      </div>
      <ol className="welcome-steps">
        <li>
          <span className="welcome-num">1</span>
          <span>
            <b>Close Skyloong's own software.</b> Only one program can talk to the keyboard at a time.
          </span>
        </li>
        <li>
          <span className="welcome-num">2</span>
          <span>
            <b>Plug in the keyboard and click Connect.</b> Pick the SK64 in the list your browser shows. Works in Chrome and
            Edge on a computer.
          </span>
        </li>
        <li>
          <span className="welcome-num">3</span>
          <span>
            <b>Make your changes, then Apply to keyboard.</b> Nothing reaches the keyboard before that, and you can always
            reset it.
          </span>
        </li>
      </ol>
      {unsupported && (
        <p className="notice" data-tone="bad">
          <b>This browser can't talk to USB keyboards.</b> Open this page in Chrome or Edge on a computer.
        </p>
      )}
      <div className="button-row">
        {!unsupported && (
          <button type="button" onClick={onConnect} disabled={connecting}>
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        )}
        <button type="button" className="secondary" onClick={onPlan}>
          Plan without connecting
        </button>
      </div>
      <p className="label">Your changes are kept in this browser until you apply them. Export a profile to keep a copy elsewhere.</p>
    </section>
  )
}
