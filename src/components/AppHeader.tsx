import { useRef } from 'react'
import type { ConnectionStatus } from '../hooks/useKeyboardConnection'
import { useCloseOnOutside } from '../hooks/useCloseOnOutside'
import { ChoiceLabel } from './controls'

export type Page = 'keys' | 'lighting' | 'macros' | 'developer'

type Props = {
  page: Page
  onPage: (page: Page) => void
  /** Number of macros, shown as a count on the Macros tab. */
  macroCount: number
  status: ConnectionStatus
  onConnect: () => void
  onDisconnect: () => void
  /** Writing to the keyboard right now: profile actions wait. */
  busy: boolean
  /** Why the keyboard can't be reset right now, or null. */
  resetBlocked: string | null
  onExport: () => void
  onImport: (text: string) => void
  onPicture: () => void
  onReset: () => void
  onShortcuts: () => void
  issuesUrl: string
  sourceUrl: string
}

const NAV: { page: Page; label: string }[] = [
  { page: 'keys', label: 'Keys' },
  { page: 'lighting', label: 'Lighting' },
  { page: 'macros', label: 'Macros' },
]

/** The app bar: name, the main sections, connection status, and the Profile / Help / Developer menus. */
export function AppHeader(props: Props) {
  const { page, onPage, macroCount, status } = props
  const profileMenu = useRef<HTMLDetailsElement>(null)
  const helpMenu = useRef<HTMLDetailsElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  useCloseOnOutside(profileMenu)
  useCloseOnOutside(helpMenu)
  const close = (menu: HTMLDetailsElement | null) => {
    if (menu) menu.open = false
  }

  return (
    <header className="app-header">
      <div className="app-brand">
        <img className="app-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={32} height={32} />
        <span className="app-name">SK64 Configurator</span>
        <span className="app-unofficial">unofficial</span>
      </div>
      <span className="app-divider" aria-hidden="true" />

      <nav className="app-nav" aria-label="Main">
        {NAV.map((n) => (
          <button
            key={n.page}
            type="button"
            className="app-nav-item"
            aria-current={page === n.page ? 'page' : undefined}
            onClick={() => onPage(n.page)}
          >
            <ChoiceLabel text={n.label} />
            {n.page === 'macros' && macroCount > 0 && <span className="app-nav-count">{macroCount}</span>}
          </button>
        ))}
      </nav>

      <div className="app-header-end">
        <ConnectionStatusText status={status} />
        {status.kind === 'connected' ? (
          <button type="button" className="app-header-action" onClick={props.onDisconnect}>
            Disconnect
          </button>
        ) : status.kind !== 'unsupported' ? (
          <button type="button" className="app-header-connect" onClick={props.onConnect} disabled={status.kind === 'working'}>
            {status.kind === 'working' ? 'Connecting…' : 'Connect'}
          </button>
        ) : null}

        <details className="menu" ref={profileMenu}>
          <summary className="ghost-summary">Profile</summary>
          <div className="menu-list" role="menu">
            <button type="button" role="menuitem" disabled={props.busy} onClick={() => (props.onExport(), close(profileMenu.current))}>
              Export profile
              <span className="label">Save keys, lighting and macros to a file</span>
            </button>
            <button type="button" role="menuitem" disabled={props.busy} onClick={() => fileInput.current?.click()}>
              Import profile
              <span className="label">Load a profile file for review</span>
            </button>
            <button type="button" role="menuitem" onClick={() => (props.onPicture(), close(profileMenu.current))}>
              Picture of my setup
              <span className="label">A PNG of your remaps and macros</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger-text"
              disabled={props.busy || !!props.resetBlocked}
              title={props.resetBlocked ?? undefined}
              onClick={() => (props.onReset(), close(profileMenu.current))}
            >
              Reset keyboard to defaults…
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              close(profileMenu.current)
              if (file) props.onImport(await file.text())
            }}
          />
        </details>

        <details className="menu" ref={helpMenu}>
          <summary className="ghost-summary">Help</summary>
          <div className="menu-list" role="menu">
            <button type="button" role="menuitem" onClick={() => (props.onShortcuts(), close(helpMenu.current))}>
              Built-in shortcuts
              <span className="label">Layers, lighting and the other Fn keys</span>
            </button>
            <a role="menuitem" className="menu-icon-item" href={props.issuesUrl} target="_blank" rel="noreferrer">
              <GitHubIcon />
              Report a problem
            </a>
            <a role="menuitem" className="menu-icon-item" href={props.sourceUrl} target="_blank" rel="noreferrer">
              <InfoIcon />
              This app is open source
            </a>
          </div>
        </details>

        <button
          type="button"
          className="app-header-action"
          aria-pressed={page === 'developer'}
          onClick={() => onPage(page === 'developer' ? 'keys' : 'developer')}
        >
          Developer
        </button>
      </div>
    </header>
  )
}

/** Connection state as a colored dot and text (the dot is decoration; the text says it all). */
function ConnectionStatusText({ status }: { status: ConnectionStatus }) {
  let tone = 'off'
  let text = 'Not connected'
  let title: string | undefined
  if (status.kind === 'connected') {
    const model = status.info.knownModel ? 'SK64' : `Model ${status.info.modelId}`
    tone = 'ok'
    text = `Connected · ${model} · v${status.info.firmwareVersion}`
    title = status.info.knownModel?.name
  } else if (status.kind === 'working') {
    tone = 'busy'
    text = 'Connecting…'
  } else if (status.kind === 'error') {
    tone = 'bad'
    text = 'Connection problem'
  } else if (status.kind === 'unsupported') {
    tone = 'bad'
    text = 'Browser not supported'
  }
  return (
    <span className="app-status" data-tone={tone} title={title}>
      <span className="app-status-dot" aria-hidden="true" />
      {text}
    </span>
  )
}

/** GitHub's mark (from Primer Octicons, MIT), for links that open GitHub. */
function GitHubIcon() {
  return (
    <svg className="icon-16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
      />
    </svg>
  )
}

/** Carbon's "information" icon. */
function InfoIcon() {
  return (
    <svg className="icon-16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8.5 11V6.5h-2v1h1V11H6v1h4v-1zM8 3.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z"
      />
      <path fill="currentColor" d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-13a6 6 0 1 0 0 12A6 6 0 0 0 8 2z" />
    </svg>
  )
}
