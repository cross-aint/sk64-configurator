import { useCallback, useEffect, useMemo, useState } from 'react'
import { MAX_MACROS, newMacro, parseMacros, type MacroDef } from '../keyboard/macroLibrary'

// Two macro lists, like the keymaps:
//   draft   – what the user is editing
//   applied – what this browser last wrote to the keyboard
// Both are remembered in this browser.

const DRAFT_KEY = 'sk64.macros.draft.v1'
const APPLIED_KEY = 'sk64.macros.applied.v1'

function load(key: string): MacroDef[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? parseMacros(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

function save(key: string, macros: readonly MacroDef[]) {
  try {
    localStorage.setItem(key, JSON.stringify(macros))
  } catch {
    // Storage can be unavailable; the app still works.
  }
}

const newId = () => Math.random().toString(36).slice(2, 10)

export function useMacros() {
  const [draft, setDraft] = useState<MacroDef[]>(() => load(DRAFT_KEY))
  const [applied, setApplied] = useState<MacroDef[]>(() => load(APPLIED_KEY))
  const [selectedId, setSelectedId] = useState<string | null>(() => draft[0]?.id ?? null)

  useEffect(() => save(DRAFT_KEY, draft), [draft])
  useEffect(() => save(APPLIED_KEY, applied), [applied])

  // Names don't reach the keyboard, so renaming alone isn't a change to apply.
  const changed = useMemo(() => {
    const strip = (list: readonly MacroDef[]) => JSON.stringify(list.map(({ steps, repeat, count }) => ({ steps, repeat, count })))
    return strip(draft) !== strip(applied)
  }, [draft, applied])

  const selected = draft.find((m) => m.id === selectedId) ?? null
  const full = draft.length >= MAX_MACROS

  /** Adds an empty macro and selects it. Returns its position, or null when the list is full. */
  const add = useCallback((): number | null => {
    if (draft.length >= MAX_MACROS) return null
    const used = new Set(draft.map((m) => m.name))
    let n = draft.length + 1
    while (used.has(`Macro ${n}`)) n++
    const macro = newMacro(newId(), n)
    setDraft([...draft, macro])
    setSelectedId(macro.id)
    return draft.length
  }, [draft])

  const update = useCallback((id: string, change: (m: MacroDef) => MacroDef) => {
    setDraft((list) => list.map((m) => (m.id === id ? change(m) : m)))
  }, [])

  /** Removes a macro and selects its neighbour. */
  const remove = useCallback(
    (id: string) => {
      const i = draft.findIndex((m) => m.id === id)
      if (i < 0) return
      const next = draft.filter((m) => m.id !== id)
      setDraft(next)
      setSelectedId(next[Math.min(i, next.length - 1)]?.id ?? null)
    },
    [draft],
  )

  const discard = useCallback(() => {
    setDraft(applied)
    setSelectedId((id) => (applied.some((m) => m.id === id) ? id : (applied[0]?.id ?? null)))
  }, [applied])

  const markApplied = useCallback((written: MacroDef[]) => setApplied(written), [])

  const replaceDraft = useCallback((list: MacroDef[]) => {
    setDraft(list)
    setSelectedId(list[0]?.id ?? null)
  }, [])

  return {
    draft,
    applied,
    changed,
    selected,
    full,
    select: setSelectedId,
    add,
    update,
    remove,
    discard,
    markApplied,
    replaceDraft,
  }
}
