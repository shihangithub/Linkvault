'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Search, Plus, CornerDownLeft, X, Lock } from 'lucide-react'

interface TagInfo { name: string; count: number }

interface Props {
  mode: 'search' | 'add'
  setMode: (m: 'search' | 'add') => void
  query: string
  setQuery: (q: string) => void
  onAdd: (url: string, tags: string[]) => Promise<{ needPin?: true } | void>
  tags: TagInfo[]       // for search-mode tag bar (with counts)
  allTags: string[]     // for add-mode tag selector
  activeTag: string | null
  onTagClick: (tag: string) => void
  status: string | null
  authed: boolean
  onAuthSuccess: () => void
}

export default function Dock({
  mode, setMode, query, setQuery,
  onAdd, tags, allTags, activeTag, onTagClick,
  status, authed, onAuthSuccess,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const newTagRef = useRef<HTMLInputElement>(null)
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

  // PIN state
  const [showPin, setShowPin] = useState(false)
  const [pinDigits, setPinDigits] = useState(['', '', '', ''])
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinSubmitting, setPinSubmitting] = useState(false)
  const pendingAdd = useRef<{ url: string; tags: string[] } | null>(null)

  const cancelPin = useCallback(() => {
    setShowPin(false)
    setPinDigits(['', '', '', ''])
    setPinError(null)
    pendingAdd.current = null
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setMode('search')
        requestAnimationFrame(() => inputRef.current?.focus())
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault(); setMode('add')
        requestAnimationFrame(() => inputRef.current?.focus())
      }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); setMode('search')
        requestAnimationFrame(() => inputRef.current?.focus())
      }
      if (e.key === 'Escape') {
        if (showPin) { cancelPin(); return }
        if (document.activeElement?.tagName === 'INPUT') (document.activeElement as HTMLInputElement).blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setMode, showPin, cancelPin])

  // Measure capsule
  useEffect(() => {
    const btn = mode === 'add' ? addBtnRef.current : searchBtnRef.current
    if (!btn) return
    setCapsule({ left: btn.offsetLeft, width: btn.offsetWidth })
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (btn.isConnected) setCapsule({ left: btn.offsetLeft, width: btn.offsetWidth })
      })
    }
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
        setPinRefs0Focus()
      } else {
        onAuthSuccess()
        setShowPin(false)
        setPinDigits(['', '', '', ''])
        // Retry the queued add
        if (pendingAdd.current) {
          const { url, tags } = pendingAdd.current
          pendingAdd.current = null
          await onAdd(url, tags)
          setAddUrl('')
          setSelectedTags([])
        }
      }
    } catch {
      setPinError('Network error. Try again.')
      setPinDigits(['', '', '', ''])
      setPinRefs0Focus()
    } finally {
      setPinSubmitting(false)
    }
  }

  const setPinRefs0Focus = () => setTimeout(() => pinRefs[0].current?.focus(), 0)

  const handlePinDigit = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...pinDigits]
    next[i] = digit
    setPinDigits(next)
    setPinError(null)
    if (digit && i < 3) pinRefs[i + 1].current?.focus()
    if (digit && i === 3) {
      // last digit — auto-submit if all filled
      const full = [...next].join('')
      if (full.length === 4) setTimeout(submitPin, 0)
    }
  }

  const handlePinKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[i] && i > 0) pinRefs[i - 1].current?.focus()
    if (e.key === 'Enter') submitPin()
  }

  return (
    <>
      <div className="dock-protect" />
      <div className="dock-wrap">
        {(status || err) && (
          <div className={`dock-status${err ? ' err' : ''}`}>{err || status}</div>
        )}

        {/* Search-mode tag filter bar */}
        {!isAdd && tags.length > 0 && (
          <div className="dock-tagbar">
            {tags.map(t => (
              <button
                key={t.name}
                className={`tag${activeTag === t.name ? ' active' : ''}`}
                onClick={() => onTagClick(t.name)}
              >
                {t.name}
                <span className="count">{t.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Add-mode tag selector bar */}
        {isAdd && !showPin && (
          <div className="add-tagbar">
            {/* Show allTags + any newly typed tags not yet saved */}
            {[...new Set([...allTags, ...selectedTags])].sort().map(t => (
              <button
                key={t}
                className={`atag${selectedTags.includes(t) ? ' sel' : ''}`}
                onClick={() => toggleTag(t)}
              >
                {selectedTags.includes(t) && <X size={9} />}
                {t}
              </button>
            ))}
            {showNewTagInput ? (
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
                className="atag atag-plus"
                onClick={() => { setShowNewTagInput(true); setTimeout(() => newTagRef.current?.focus(), 0) }}
                title="Add new tag"
              >
                <Plus size={10} /> tag
              </button>
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
              <Search size={13} /> Search
            </button>
            <button
              ref={addBtnRef}
              className={`mode-btn${isAdd ? ' active' : ''}`}
              onClick={() => { setMode('add'); requestAnimationFrame(() => inputRef.current?.focus()) }}
            >
              <Plus size={13} /> Add
            </button>
          </div>

          {isAdd && showPin ? (
            /* PIN prompt replaces the input area */
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
            /* Add mode */
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
