import { useEffect, useRef, useState } from 'react'
import type { ChangeSheet } from '../keyboard/changeSheet'
import type { KeyboardLayout } from '../keyboard/layout'
import { renderChangeSheet } from './changeSheetImage'

type Props = {
  layout: KeyboardLayout
  sheet: ChangeSheet
  onClose: () => void
}

const today = () => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

/** Preview of the picture of the user's remaps and macros, with a download button. */
export function ChangeSheetDialog({ layout, sheet, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const close = useRef<HTMLButtonElement>(null)
  const empty = sheet.sections.length === 0 && sheet.macros.length === 0

  useEffect(() => {
    if (empty) return
    let objectUrl: string | null = null
    let cancelled = false
    try {
      renderChangeSheet(sheet, layout, 'My SK64 setup', today()).toBlob((blob) => {
        if (cancelled) return
        if (!blob) {
          setError('The picture couldn’t be made.')
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      }, 'image/png')
    } catch (err) {
      queueMicrotask(() => setError(err instanceof Error ? err.message : String(err)))
    }
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [sheet, layout, empty])

  useEffect(() => {
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog sheet-dialog" role="dialog" aria-modal="true" aria-labelledby="sheet-dialog-title">
        <div className="dialog-head">
          <h2 id="sheet-dialog-title">Picture of your setup</h2>
          <button ref={close} className="secondary small" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="muted">
          Every remapped key, layer by layer, and your macros, as set up here (including changes not applied yet).
          Lighting isn’t included.
        </p>
        {empty ? (
          <p>Nothing to show yet: no keys are remapped and there are no macros.</p>
        ) : error ? (
          <p className="changes-bad">{error}</p>
        ) : url ? (
          <>
            <div className="sheet-preview">
              <img src={url} alt="Picture of the remapped keys and macros" />
            </div>
            <div className="dialog-actions">
              <a className="button small" href={url} download="sk64-setup.png">
                Download PNG
              </a>
            </div>
          </>
        ) : (
          <p className="muted">Drawing…</p>
        )}
      </div>
    </div>
  )
}
