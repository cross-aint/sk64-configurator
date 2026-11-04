import { useEffect, useId, useState } from 'react'
import type { ChangeSheet } from '../keyboard/changeSheet'
import type { KeyboardLayout } from '../keyboard/layout'
import { loadLogo, renderChangeSheet } from './changeSheetImage'
import { Dialog } from './Dialog'

type Props = {
  layout: KeyboardLayout
  sheet: ChangeSheet
  /** Who made the app, for the picture's footer (a GitHub username). */
  author: string
  onClose: () => void
}

const DEFAULT_NAME = 'My SK64 setup'
const NAME_KEY = 'sk64.setupName.v1'

const today = () => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || DEFAULT_NAME
  } catch {
    return DEFAULT_NAME
  }
}

/** A file name from the setup's name, e.g. "Work laptop" → "work-laptop.png". */
function fileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'sk64-setup'}.png`
}

/**
 * The picture of the user's remaps and macros: first they name the setup (the picture's title),
 * then preview and download it. The picture redraws shortly after the name changes.
 */
export function ChangeSheetDialog({ layout, sheet, author, onClose }: Props) {
  const nameId = useId()
  const [name, setName] = useState(savedName)
  const [title, setTitle] = useState(() => name.trim() || DEFAULT_NAME)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const empty = sheet.sections.length === 0 && sheet.macros.length === 0

  // Settle on the typed name a moment after typing stops, then remember it.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = name.trim() || DEFAULT_NAME
      setTitle(next)
      try {
        localStorage.setItem(NAME_KEY, next)
      } catch {
        // Storage unavailable; the name just won't be remembered.
      }
    }, 300)
    return () => window.clearTimeout(t)
  }, [name])

  useEffect(() => {
    if (empty) return
    let objectUrl: string | null = null
    let cancelled = false
    const credit = `Made with SK64 Configurator (unofficial) by github.com/${author}`
    void loadLogo().then((logo) => {
      if (cancelled) return
      try {
        renderChangeSheet(sheet, layout, { title, date: today(), credit, logo }).toBlob((blob) => {
          if (cancelled) return
          if (!blob) {
            setError('The picture couldn’t be made.')
            return
          }
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        }, 'image/png')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [sheet, layout, title, author, empty])

  return (
    <Dialog
      title="Picture of your setup"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="neutral" onClick={onClose}>
            Close
          </button>
          {url && !empty && !error ? (
            <a className="button" href={url} download={fileName(title)}>
              Download PNG
            </a>
          ) : (
            <button type="button" disabled>
              Download PNG
            </button>
          )}
        </>
      }
    >
      <div className="field sheet-name">
        <label htmlFor={nameId} className="label">
          Name your setup
        </label>
        <input
          id={nameId}
          type="text"
          maxLength={60}
          value={name}
          placeholder={DEFAULT_NAME}
          data-autofocus
          onFocus={(e) => e.target.select()}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <p className="muted">
        The name goes at the top of the picture. It shows every remapped key, layer by layer, and your macros, as set up
        here (including changes not applied yet). Lighting isn’t included.
      </p>
      {empty ? (
        <p>Nothing to show yet: no keys are remapped and there are no macros.</p>
      ) : error ? (
        <p className="changes-bad">{error}</p>
      ) : url ? (
        <div className="sheet-preview">
          <img src={url} alt={`Picture of the setup “${title}”: remapped keys and macros`} />
        </div>
      ) : (
        <p className="muted">Drawing…</p>
      )}
    </Dialog>
  )
}
