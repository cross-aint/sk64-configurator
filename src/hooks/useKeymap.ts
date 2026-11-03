import { useCallback, useEffect, useMemo, useState } from 'react'
import { countDifferences, EMPTY_KEYMAP, setOverride, type Keymap, type LayerName } from '../keyboard/keymap'

// Two keymaps:
//   draft   – what the user is editing
//   applied – what this browser last wrote to the keyboard
// Both are remembered in this browser so a refresh doesn't lose work. Export a profile file
// to move it elsewhere.

const DRAFT_KEY = 'sk64.keymap.draft.v1'
const APPLIED_KEY = 'sk64.keymap.applied.v1'

function load(storageKey: string): Keymap {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return EMPTY_KEYMAP
    const parsed = JSON.parse(raw) as Partial<Keymap>
    return { normal: parsed.normal ?? {}, fn: parsed.fn ?? {} }
  } catch {
    return EMPTY_KEYMAP
  }
}

function save(storageKey: string, map: Keymap) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(map))
  } catch {
    // Storage can be unavailable (private window, blocked site data); the app still works.
  }
}

export function useKeymap() {
  const [draft, setDraft] = useState<Keymap>(() => load(DRAFT_KEY))
  const [applied, setApplied] = useState<Keymap>(() => load(APPLIED_KEY))

  useEffect(() => save(DRAFT_KEY, draft), [draft])
  useEffect(() => save(APPLIED_KEY, applied), [applied])

  const pendingCount = useMemo(() => countDifferences(draft, applied), [draft, applied])

  const setKey = useCallback((layer: LayerName, keyId: string, value: number | null) => {
    setDraft((map) => setOverride(map, layer, keyId, value))
  }, [])

  /** Throw away edits since the last Apply. */
  const discard = useCallback(() => setDraft(applied), [applied])

  /** Call after a successful write: the keyboard now matches `written`. */
  const markApplied = useCallback((written: Keymap) => setApplied(written), [])

  /** Replace all edits (e.g. from an imported profile). */
  const replaceDraft = useCallback((map: Keymap) => setDraft(map), [])

  return { draft, applied, pendingCount, setKey, discard, markApplied, replaceDraft }
}
