import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BOARD_LAYERS,
  countDifferences,
  EMPTY_KEYMAP,
  EMPTY_KEYMAPS,
  setOverride,
  type BoardLayer,
  type Keymap,
  type Keymaps,
  type LayerName,
} from '../keyboard/keymap'

// Two sets of keymaps (one per keyboard layer):
//   draft   – what the user is editing
//   applied – what this browser last wrote to the keyboard
// Both are remembered in this browser so a refresh doesn't lose work. Export a profile file
// to move it elsewhere.

const DRAFT_KEY = 'sk64.keymap.draft.v2'
const APPLIED_KEY = 'sk64.keymap.applied.v2'
// Version 1 had the base layer only; it's read once and becomes the base layer.
const OLD_KEYS = { [DRAFT_KEY]: 'sk64.keymap.draft.v1', [APPLIED_KEY]: 'sk64.keymap.applied.v1' }

function parseKeymap(raw: unknown): Keymap {
  if (!raw || typeof raw !== 'object') return EMPTY_KEYMAP
  const map = raw as Partial<Keymap>
  return { normal: map.normal ?? {}, fn: map.fn ?? {} }
}

function load(storageKey: typeof DRAFT_KEY | typeof APPLIED_KEY): Keymaps {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<BoardLayer, unknown>>
      return Object.fromEntries(BOARD_LAYERS.map((l) => [l.id, parseKeymap(parsed[l.id])])) as Keymaps
    }
    const old = localStorage.getItem(OLD_KEYS[storageKey])
    return old ? { ...EMPTY_KEYMAPS, base: parseKeymap(JSON.parse(old)) } : EMPTY_KEYMAPS
  } catch {
    return EMPTY_KEYMAPS
  }
}

function save(storageKey: string, maps: Keymaps) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(maps))
  } catch {
    // Storage can be unavailable (private window, blocked site data); the app still works.
  }
}

export function useKeymap() {
  const [draft, setDraft] = useState<Keymaps>(() => load(DRAFT_KEY))
  const [applied, setApplied] = useState<Keymaps>(() => load(APPLIED_KEY))

  useEffect(() => save(DRAFT_KEY, draft), [draft])
  useEffect(() => save(APPLIED_KEY, applied), [applied])

  /** Changed keys per keyboard layer, not yet on the keyboard. */
  const pendingByLayer = useMemo(
    () => Object.fromEntries(BOARD_LAYERS.map((l) => [l.id, countDifferences(draft[l.id], applied[l.id])])) as Record<BoardLayer, number>,
    [draft, applied],
  )
  const pendingCount = Object.values(pendingByLayer).reduce((a, b) => a + b, 0)

  const setKey = useCallback((board: BoardLayer, layer: LayerName, keyId: string, value: number | null) => {
    setDraft((maps) => ({ ...maps, [board]: setOverride(maps[board], layer, keyId, value) }))
  }, [])

  /** Throw away edits since the last Apply. */
  const discard = useCallback(() => setDraft(applied), [applied])

  /** Call after a successful write: these keyboard layers now match `written`. */
  const markApplied = useCallback(
    (written: Partial<Keymaps>) => setApplied((maps) => ({ ...maps, ...written })),
    [],
  )

  /** Replace all edits (e.g. from an imported profile). */
  const replaceDraft = useCallback((maps: Keymaps) => setDraft(maps), [])

  return { draft, applied, pendingCount, pendingByLayer, setKey, discard, markApplied, replaceDraft }
}
