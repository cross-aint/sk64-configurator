import { useCallback, useEffect, useMemo, useState } from 'react'
import { BUILTIN_LIGHTING, parseLighting, sameLighting, slotsUsed, type Lighting } from '../keyboard/lighting'
import type { KeyboardLayout } from '../keyboard/layout'
import { MAX_MODES, newSlot, newSlotId, type EffectKind, type EffectSlot, type PaintSlot } from '../keyboard/presets'
import { newReaction, type Reaction, type ReactionKind } from '../keyboard/reactions'
import { MAX_EFFECTS } from '../keyboard/effects'

// Same draft / applied idea as useKeymap, for lighting. The draft is a list of effects; one of
// them is selected for editing.

const DRAFT_KEY = 'sk64.lighting.draft.v1'
const APPLIED_KEY = 'sk64.lighting.applied.v1'
/** Stored as the applied value when the keyboard holds lighting this app didn't make (e.g. test effects). */
const OTHER = 'other'

function load(storageKey: string, layout: KeyboardLayout): Lighting {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? parseLighting(JSON.parse(raw), layout) : BUILTIN_LIGHTING
  } catch {
    return BUILTIN_LIGHTING
  }
}

function store(storageKey: string, value: string) {
  try {
    localStorage.setItem(storageKey, value)
  } catch {
    // Storage unavailable; the app still works without it.
  }
}

function loadApplied(layout: KeyboardLayout): Lighting | null {
  try {
    if (localStorage.getItem(APPLIED_KEY) === OTHER) return null
  } catch {
    // Storage unavailable; fall through.
  }
  return load(APPLIED_KEY, layout)
}

type Custom = { slots: EffectSlot[]; reactions: Reaction[] }

const slotsOf = (l: Lighting): readonly EffectSlot[] => (l.kind === 'custom' ? l.slots : [])
const reactionsOf = (l: Lighting): readonly Reaction[] => (l.kind === 'custom' ? l.reactions : [])
const custom = (c: Custom): Lighting => ({ kind: 'custom', ...c })
/** No room for another mode: the app's mode limit, or the keyboard's slots are all used. */
const full = (c: Custom) => c.slots.length >= MAX_MODES || slotsUsed(custom(c)) >= MAX_EFFECTS

export function useLighting(layout: KeyboardLayout) {
  const [draft, setDraft] = useState<Lighting>(() => load(DRAFT_KEY, layout))
  /** What's on the keyboard, or null when it holds something else (so the draft counts as changed). */
  const [applied, setApplied] = useState<Lighting | null>(() => loadApplied(layout))
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => store(DRAFT_KEY, JSON.stringify(draft)), [draft])
  useEffect(() => store(APPLIED_KEY, applied ? JSON.stringify(applied) : OTHER), [applied])

  const changed = useMemo(() => applied === null || !sameLighting(draft, applied), [draft, applied])

  const slots = slotsOf(draft)
  const reactions = reactionsOf(draft)
  /** Effect slots in use by modes and reactions together (the keyboard has MAX_EFFECTS). */
  const used = slotsUsed(draft)
  // The selection is a reaction, or a mode (falling back to the first mode if it was removed).
  const selectedReaction = reactions.find((r) => r.id === selectedId) ?? null
  const selected = selectedReaction ? null : (slots.find((s) => s.id === selectedId) ?? slots[0] ?? null)

  /** Changes the custom lighting (switching to custom if needed). */
  const update = useCallback((change: (c: Custom) => Custom) => {
    setDraft((cur) => custom(change({ slots: [...slotsOf(cur)], reactions: [...reactionsOf(cur)] })))
  }, [])

  const updateSlots = useCallback(
    (change: (slots: EffectSlot[]) => EffectSlot[]) => update((c) => ({ ...c, slots: change(c.slots) })),
    [update],
  )

  /** Adds a mode if there's room. */
  const addMode = useCallback(
    (slot: EffectSlot) => {
      update((c) => (full(c) ? c : { ...c, slots: [...c.slots, slot] }))
      setSelectedId(slot.id)
    },
    [update],
  )

  /**
   * Sets (or with null, clears) the color of some keys in the selected painted-colors effect.
   * If a different kind of effect is selected, a new painted-colors effect is added.
   */
  const paint = useCallback(
    (keyIds: string[], color: string | null) => {
      const recolor = (colors: Readonly<Record<string, string>>) => {
        const next = { ...colors }
        for (const id of keyIds) {
          if (color === null) delete next[id]
          else next[id] = color.toLowerCase()
        }
        return next
      }
      if (selected?.kind === 'paint') {
        updateSlots((list) => list.map((s) => (s.id === selected.id && s.kind === 'paint' ? { ...s, colors: recolor(s.colors) } : s)))
        return
      }
      addMode({ id: newSlotId(), kind: 'paint', colors: recolor({}) } satisfies PaintSlot)
    },
    [selected, updateSlots, addMode],
  )

  /** Replaces all colors of the selected painted-colors effect (e.g. from a picture), or adds one. */
  const setPaintColors = useCallback(
    (colors: Record<string, string>) => {
      if (selected?.kind === 'paint') {
        updateSlots((list) => list.map((s) => (s.id === selected.id && s.kind === 'paint' ? { ...s, colors } : s)))
        return
      }
      addMode({ id: newSlotId(), kind: 'paint', colors } satisfies PaintSlot)
    },
    [selected, updateSlots, addMode],
  )

  const addSlot = useCallback((kind: EffectKind) => addMode(newSlot(kind)), [addMode])

  const updateSlot = useCallback(
    (id: string, change: (slot: EffectSlot) => EffectSlot) => updateSlots((list) => list.map((s) => (s.id === id ? change(s) : s))),
    [updateSlots],
  )

  /** Removes an effect and selects its neighbour (the next one, or the previous if it was last). */
  const removeSlot = useCallback(
    (id: string) => {
      const index = slots.findIndex((s) => s.id === id)
      const neighbour = slots[index + 1] ?? slots[index - 1]
      updateSlots((list) => list.filter((s) => s.id !== id))
      setSelectedId(neighbour?.id ?? null)
    },
    [slots, updateSlots],
  )

  /** Moves an effect earlier (-1) or later (+1) in the Fn + ] order. */
  const moveSlot = useCallback(
    (id: string, delta: -1 | 1) =>
      updateSlots((list) => {
        const from = list.findIndex((s) => s.id === id)
        const to = from + delta
        if (from < 0 || to < 0 || to >= list.length) return list
        ;[list[from], list[to]] = [list[to], list[from]]
        return list
      }),
    [updateSlots],
  )

  // ---- Key reactions ----

  const addReaction = useCallback(
    (kind: ReactionKind) => {
      const reaction = newReaction(kind, newSlotId())
      update((c) => ({ ...c, reactions: [...c.reactions, reaction] }))
      setSelectedId(reaction.id)
    },
    [update],
  )

  const updateReaction = useCallback(
    (id: string, change: (r: Reaction) => Reaction) =>
      update((c) => ({ ...c, reactions: c.reactions.map((r) => (r.id === id ? change(r) : r)) })),
    [update],
  )

  const removeReaction = useCallback(
    (id: string) => {
      const list = reactionsOf(draft)
      const index = list.findIndex((r) => r.id === id)
      const neighbour = list[index + 1] ?? list[index - 1]
      update((c) => ({ ...c, reactions: c.reactions.filter((r) => r.id !== id) }))
      setSelectedId(neighbour?.id ?? null)
    },
    [draft, update],
  )

  /**
   * Adds or removes a trigger key. A key can trigger only one reaction, so adding it takes it off
   * any other. Returns 'full' (and changes nothing) if there's no slot left for it.
   */
  const toggleReactionKey = useCallback(
    (reactionId: string, keyId: string): 'added' | 'removed' | 'full' => {
      const current = reactionsOf(draft)
      const target = current.find((r) => r.id === reactionId)
      if (!target) return 'removed'
      const removing = target.keys.includes(keyId)
      const next: Custom = {
        slots: [...slotsOf(draft)],
        reactions: current.map((r) => {
          if (r.id === reactionId) {
            return { ...r, keys: removing ? r.keys.filter((k) => k !== keyId) : [...r.keys, keyId] }
          }
          return removing ? r : { ...r, keys: r.keys.filter((k) => k !== keyId) }
        }),
      }
      if (!removing && slotsUsed(custom(next)) > MAX_EFFECTS) return 'full'
      setDraft(custom(next))
      return removing ? 'removed' : 'added'
    },
    [draft],
  )

  const setBuiltin = useCallback(() => setDraft(BUILTIN_LIGHTING), [])
  /** Switches to custom effects, starting with one painted-colors effect if there are none. */
  const setCustom = useCallback(() => {
    setDraft((cur) =>
      cur.kind === 'custom' && cur.slots.length ? cur : custom({ slots: [newSlot('paint')], reactions: [...reactionsOf(cur)] }),
    )
  }, [])

  const discard = useCallback(() => {
    if (applied) setDraft(applied)
  }, [applied])
  const markApplied = useCallback((written: Lighting) => setApplied(written), [])
  /** The keyboard now holds lighting that isn't the draft (e.g. test effects). */
  const markOverwritten = useCallback(() => setApplied(null), [])
  const replaceDraft = useCallback((lighting: Lighting) => setDraft(lighting), [])

  return {
    draft,
    applied,
    changed,
    slots,
    reactions,
    used,
    selected,
    selectedReaction,
    select: setSelectedId,
    paint,
    setPaintColors,
    addSlot,
    updateSlot,
    removeSlot,
    moveSlot,
    addReaction,
    updateReaction,
    removeReaction,
    toggleReactionKey,
    setBuiltin,
    setCustom,
    discard,
    markApplied,
    markOverwritten,
    replaceDraft,
  }
}
