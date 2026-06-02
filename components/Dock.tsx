'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Search, Plus, CornerDownLeft, X, Lock, Pencil } from 'lucide-react'

interface Props {
  mode: 'search' | 'add'
  setMode: (m: 'search' | 'add') => void
  query: string
  setQuery: (q: string) => void
  onAdd: (url: string, tags: string[]) => Promise<{ needPin?: true } | void>
  dbTags: string[]                       // all tags from DB
  tagCounts: Map<string, number>         // link-count per tag (for search mode)
  activeTag: string | null
  onTagClick: (tag: string) => void
  status: string | null
  authed: boolean
  onAuthSuccess: () => void
  onRenameTagRequest: (oldName: string, newName: string) => void
  onDeleteTagRequest: (name: string) => void
}

export default function Dock({
  mode, setMode, query, setQuery,
  onAdd, dbTags, tagCounts, activeTag, onTagClick,
  status, authed, onAuthSuccess,
  onRenameTagRequest, onDeleteTagRequest,
}: Props) {
  const inputRef    = useRef<HTMLInputElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)
  const addBtnRef   = useRef<HTMLButtonElement>(null)
  const newTagRef   = useRef<HTMLInputElement>(null)
  const committingNewTag = useRef(false)
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const [addUrl, setAddUrl] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showNewTagInput, setShowNewTagInput] = useState(false)
  const [newTagValue, setNewTagValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [capsule, setCapsule] = useState({ left: 3, width: 80 })

  // Tag edit mode
  const [tagEditMode, setTagEditMode] = useState(false)
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editTagValue, setEditTagValue] = useState('')
  const editTagRef = useRef<HTMLInputElement>(null)
  const committingEditTag = useRef(false)

  // PIN state
  const [showPin, setShowPin] = useState(false)
  const [pinDigits, setPinDigits] = useState(['', '', '', ''])
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinSubmitting, setPinSubmitting] = useState(false)
  const pendingAdd = useRef<{ url: string; tags: string[] } | null>(null)

  const cancelPin = useCallback(() => {
    const hadPending = pendingAdd.current !== null
    setShowPin(false)
    setPinDigits(['', '', '', ''])
    setPinError(null)
    pendingAdd.current = null
    // If PIN was shown pre-emptively (no URL queued), return to search mode
    if (!hadPending) setMode('search')
  }, [setMode])

  const startEditTag = useCallback((tag: string) => {
    setEditingTag(tag)
    setEditTagValue(tag)
    setTimeout(() => editTagRef.current?.focus(), 0)
  }, [])

  const commitEditTag = useCallback(() => {
    if (!editingTag) return
    const cleaned = editTagValue.trim().toLowerCase().replace(/\s+/g, '-')
    if (cleaned && cleaned !== editingTag) {
      onRenameTagRequest(editingTag, cleaned)
    }
    setEditingTag(null)
    setEditTagValue('')
    committingEditTag.current = false
  }, [editingTag, editTagValue, onRenameTagRequest])

  const cancelEditTag = useCallback(() => {
    setEditingTag(null)
    setEditTagValue('')
    committingEditTag.current = false
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setMode('search')
        requestAnimationFrame(() => inputRef.current?.focus())
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        if (!authed) { setMode('add'); setShowPin(true) }
        else { setMode('add'); requestAnimationFrame(() => inputRef.current?.focus()) }
      }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); setMode('search')
        requestAnimationFrame(() => inputRef.current?.focus())
      }
      if (e.key === 'Escape') {
        if (showPin) { cancelPin(); return }
        if (editingTag) { cancelEditTag(); return }
        if (tagEditMode) { setTagEditMode(false); return }
        if (document.activeElement?.tagName === 'INPUT') (document.activeElement as HTMLInputElement).blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setMode, showPin, cancelPin, authed, editingTag, cancelEditTag, tagEditMode])

  // Measure capsule — re-runs on mode change AND whenever the toggle container
  // resizes (e.g. viewport crosses the mobile breakpoint, hiding button labels)
  useEffect(() => {
    const measure = () => {
      const btn = mode === 'add' ? addBtnRef.current : searchBtnRef.current
      if (btn?.isConnected) setCapsule({ left: btn.offsetLeft, width: btn.offsetWidth })
    }

    measure()
    document.fonts?.ready.then(measure)

    // Watch the mode-toggle container for any size change
    const toggle = searchBtnRef.current?.parentElement
    if (!toggle) return
    const ro = new ResizeObserver(measure)
    ro.observe(toggle)
    return () => ro.disconnect()
  }, [mode])

  // Auto-focus PIN box 0 when PIN prompt shows
  useEffect(() => {
    if (showPin) pinRefs[0].current?.focus()
  }, [showPin]) // eslint-disable-line react-hooks/exhaustive-deps

  const isAdd = mode === 'add'

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }, [])

  const commitNewTag = useCallback(() => {
    const t = newTagValue.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !selectedTags.includes(t)) {
      setSelectedTags(prev => [...prev, t])
    }
    setNewTagValue('')
    setShowNewTagInput(false)
    committingNewTag.current = false
  }, [newTagValue, selectedTags])

  const submit = async () => {
    const url = addUrl.trim()
    if (!url) return
    const ok = /^(https?:\/\/|www\.)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(url)
    if (!ok) { setErr("couldn't parse that url"); setTimeout(() => setErr(null), 2200); return }

    if (!authed) {
      pendingAdd.current = { url, tags: selectedTags }
      setShowPin(true)
      return
    }

    const result = await onAdd(url, selectedTags)
    if (result && 'needPin' in result) {
      pendingAdd.current = { url, tags: selectedTags }
      setShowPin(true)
      return
    }
    setAddUrl('')
    setSelectedTags([])
  }

  const submitPin = async () => {
    const pin = pinDigits.join('')
    if (pin.length < 4) return
    setPinSubmitting(true)
    setPinError(null)
    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const body = await res.json()
      if (!res.ok) {
        setPinError(body.error ?? 'Incorrect PIN')
        setPinDigits(['', '', '', ''])
        setTimeout(() => pinRefs[0].current?.focus(), 0)
      } else {
        onAuthSuccess()
        setShowPin(false)
        setPinDigits(['', '', '', ''])
        if (pendingAdd.current) {
          const { url, tags } = pendingAdd.current
          pendingAdd.current = null
          await onAdd(url, tags)
          setAddUrl('')
          setSelectedTags([])
        } else {
          // Pre-emptive PIN (no pending URL) — just show the URL input
          requestAnimationFrame(() => inputRef.current?.focus())
        }
      }
    } catch {
      setPinError('Network error. Try again.')
      setPinDigits(['', '', '', ''])
      setTimeout(() => pinRefs[0].current?.focus(), 0)
    } finally {
      setPinSubmitting(false)
    }
  }

  const handlePinDigit = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...pinDigits]
    next[i] = digit
    setPinDigits(next)
    setPinError(null)
    if (digit && i < 3) pinRefs[i + 1].current?.focus()
    if (digit && i === 3) {
      const full = next.join('')
      if (full.length === 4) setTimeout(submitPin, 0)
    }
  }

  const handlePinKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[i] && i > 0) pinRefs[i - 1].current?.focus()
    if (e.key === 'Enter') submitPin()
  }

  // All tags to show: DB tags + any newly typed ones not yet in DB
  const allDisplayTags = [...new Set([...dbTags, ...selectedTags])].sort()

  return (
    <>
      <div className="dock-protect" />
      <div className="dock-wrap">
        {(status || err) && (
          <div className={`dock-status${err ? ' err' : ''}`}>{err || status}</div>
        )}

        {/* Unified tag bar — shown when there are tags or the + button is needed */}
        {(allDisplayTags.length > 0 || (isAdd && !showPin)) && (
          <div className="dock-tagbar">
            {allDisplayTags.map(t => {
              const count = tagCounts.get(t) ?? 0
              const isActive = isAdd ? selectedTags.includes(t) : activeTag === t

              // Inline rename input (edit mode only, for this specific tag)
              if (tagEditMode && editingTag === t) {
                return (
                  <input
                    key={t}
                    ref={editTagRef}
                    className="new-tag-input tag-rename-input"
                    value={editTagValue}
                    onChange={e => setEditTagValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        committingEditTag.current = true
                        commitEditTag()
                      }
                      if (e.key === 'Escape') { e.preventDefault(); cancelEditTag() }
                    }}
                    onBlur={() => {
                      if (!committingEditTag.current) commitEditTag()
                      committingEditTag.current = false
                    }}
                    maxLength={30}
                    spellCheck={false}
                    autoComplete="off"
                  />
                )
              }

              return (
                <button
                  key={t}
                  className={`tag${isActive && !tagEditMode ? ' active' : ''}${tagEditMode ? ' tag-edit-mode' : ''}`}
                  onClick={() => {
                    if (tagEditMode) { startEditTag(t); return }
                    if (isAdd) toggleTag(t)
                    else onTagClick(t)
                  }}
                  title={tagEditMode ? `Rename "${t}"` : undefined}
                >
                  <span className="tag-label">{t}</span>
                  {!isAdd && !tagEditMode && count > 0 && <span className="count">{count}</span>}
                  {tagEditMode && (
                    <span
                      className="tag-delete-btn"
                      role="button"
                      aria-label={`Delete tag ${t}`}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); onDeleteTagRequest(t) }}
                    >×</span>
                  )}
                </button>
              )
            })}

            {/* Pencil / edit-tags toggle — visible in both modes when authed and not in PIN prompt */}
            {authed && !showPin && dbTags.length > 0 && (
              <button
                className={`tag tag-edit-toggle${tagEditMode ? ' active' : ''}`}
                onClick={() => { setTagEditMode(v => !v); cancelEditTag() }}
                title={tagEditMode ? 'Done' : 'Edit tags'}
                aria-label={tagEditMode ? 'Done editing tags' : 'Edit tags'}
              >
                <Pencil size={10} />
              </button>
            )}

            {/* + tag button — add mode only, not in edit mode */}
            {isAdd && !showPin && !tagEditMode && (
              showNewTagInput ? (
                <input
                  ref={newTagRef}
                  className="new-tag-input"
                  placeholder="tag name…"
                  value={newTagValue}
                  onChange={e => setNewTagValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      committingNewTag.current = true
                      commitNewTag()
                    }
                    if (e.key === 'Escape') { setShowNewTagInput(false); setNewTagValue('') }
                  }}
                  onBlur={() => {
                    if (!committingNewTag.current) commitNewTag()
                    committingNewTag.current = false
                  }}
                  autoFocus
                  maxLength={30}
                />
              ) : (
                <button
                  className="tag tag-plus"
                  onClick={() => { setShowNewTagInput(true); setTimeout(() => newTagRef.current?.focus(), 0) }}
                  title="Add new tag"
                >
                  <Plus size={10} /> tag
                </button>
              )
            )}
          </div>
        )}

        <div className={`dock${focused ? ' focused' : ''}`}>
          <div className="mode-toggle">
            <span className="mode-capsule" style={{ left: capsule.left, width: capsule.width }} />
            <button
              ref={searchBtnRef}
              className={`mode-btn${!isAdd ? ' active' : ''}`}
              onClick={() => { setMode('search'); requestAnimationFrame(() => inputRef.current?.focus()) }}
            >
              <Search size={13} /><span className="mode-label"> Search</span>
            </button>
            <button
              ref={addBtnRef}
              className={`mode-btn${isAdd ? ' active' : ''}`}
              onClick={() => {
                setMode('add')
                if (!authed) {
                  // Ask for PIN immediately before showing the URL input
                  setShowPin(true)
                } else {
                  requestAnimationFrame(() => inputRef.current?.focus())
                }
              }}
            >
              <Plus size={13} /><span className="mode-label"> Add</span>
            </button>
          </div>

          {isAdd && showPin ? (
            /* PIN prompt */
            <>
              <div className="pin-prompt">
                <span className="pin-label">
                  <Lock size={12} /> Enter PIN
                </span>
                <div className="pin-boxes">
                  {pinDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={pinRefs[i]}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      className={`pin-box${d ? ' pin-filled' : ''}${pinError ? ' pin-error' : ''}`}
                      value={d}
                      onChange={e => handlePinDigit(i, e.target.value)}
                      onKeyDown={e => handlePinKeyDown(i, e)}
                      disabled={pinSubmitting}
                      autoComplete="off"
                    />
                  ))}
                </div>
                {pinError && <span className="pin-error-msg">{pinError}</span>}
              </div>
              <button className="dock-trail" onClick={cancelPin} title="Cancel" aria-label="Cancel PIN">
                <X size={15} />
              </button>
            </>
          ) : isAdd ? (
            /* Add mode — URL input */
            <>
              <input
                ref={inputRef}
                className="dock-input"
                placeholder="paste a url…"
                value={addUrl}
                onChange={e => setAddUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit() }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoFocus
                spellCheck={false}
                inputMode="url"
                autoComplete="off"
              />
              <button
                className="dock-trail accent"
                onClick={submit}
                disabled={!addUrl.trim()}
                title="Save (Enter)"
                aria-label="Save link"
              >
                <CornerDownLeft size={15} />
              </button>
            </>
          ) : (
            /* Search mode */
            <>
              <input
                ref={inputRef}
                className="dock-input"
                placeholder="search the vault"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                spellCheck={false}
                autoComplete="off"
              />
              {query ? (
                <button className="dock-trail" onClick={() => setQuery('')} title="Clear" aria-label="Clear search">
                  <X size={15} />
                </button>
              ) : (
                <span className="dock-trail dock-kbd">
                  <kbd>⌘</kbd><kbd>K</kbd>
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
