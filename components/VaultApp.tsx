'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { X, Plus } from 'lucide-react'
import Header from './Header'
import Dock from './Dock'
import LinkCard from './LinkCard'
import PendingCard from './PendingCard'
import EmptyState from './EmptyState'
import { addLink, deleteLink, updateLink, renameTag, deleteTag } from '@/app/actions'
import type { Link, Shape, Theme, SortKey } from '@/lib/types'

interface PendingLink { id: string; domain: string; tags: string[] }

interface Props {
  initial: Link[]
  initialAuthed: boolean
  initialTags: string[]
}

export default function VaultApp({ initial, initialAuthed, initialTags }: Props) {
  const [links, setLinks] = useState<Link[]>(initial)
  const [dbTags, setDbTags] = useState<string[]>(initialTags)
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([])
  const [mode, setMode] = useState<'search' | 'add'>('search')
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [authed, setAuthed] = useState(initialAuthed)
  const [status, setStatus] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; domain: string; snapshot: Link } | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmDeleteTag, setConfirmDeleteTag] = useState<{ name: string } | null>(null)
  const [confirmRenameTag, setConfirmRenameTag] = useState<{ oldName: string; newName: string } | null>(null)
  // Edit link dialog state
  const [editingLink, setEditingLink] = useState<Link | null>(null)
  const [editUrl, setEditUrl] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editNewTag, setEditNewTag] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Server-safe defaults — must match SSR output to avoid hydration mismatch
  const [theme, setThemeState] = useState<Theme>('dark')
  const [shape, setShapeState] = useState<Shape>('gallery')

  // Hydrate from localStorage after mount (client-only, one-time sync)
  useEffect(() => {
    const t = localStorage.getItem('lv.theme') as Theme | null
    const s = localStorage.getItem('lv.shape') as Shape | null
    if (t) setThemeState(t) // eslint-disable-line react-hooks/set-state-in-effect
    if (s) setShapeState(s)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem('lv.theme', t)
    document.documentElement.classList.toggle('light', t === 'light')
  }, [])

  const setShape = useCallback((s: Shape) => {
    setShapeState(s)
    localStorage.setItem('lv.shape', s)
  }, [])

  // Apply theme class on mount and whenever theme changes
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  // Relative-time tick
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // Auto-clear status toast
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 2500)
    return () => clearTimeout(t)
  }, [status])

  // Count how many links each tag has (for display in search mode)
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>()
    links.forEach(e => (e.tags ?? []).forEach(t => map.set(t, (map.get(t) ?? 0) + 1)))
    return map
  }, [links])

  // Filtered + sorted list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let result = links.filter(e => {
      if (activeTag && !(e.tags ?? []).includes(activeTag)) return false
      if (!q) return true
      return (
        e.title?.toLowerCase().includes(q) ||
        e.domain.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q) ||
        (e.tags ?? []).some(t => t.toLowerCase().includes(q))
      )
    })
    if (sortKey === 'oldest') result = [...result].sort((a, b) => a.created_at.localeCompare(b.created_at))
    else if (sortKey === 'az') result = [...result].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
    return result
  }, [links, query, activeTag, sortKey])

  const handleAdd = useCallback(async (url: string, tags: string[]) => {
    const pendingId = 'pending-' + Date.now()
    const domain = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]
    setPendingLinks(prev => [{ id: pendingId, domain, tags }, ...prev])
    setMode('search')

    const result = await addLink(url, tags)

    if ('needPin' in result) {
      setPendingLinks(prev => prev.filter(p => p.id !== pendingId))
      return { needPin: true as const }
    }
    if ('error' in result) {
      setPendingLinks(prev => prev.filter(p => p.id !== pendingId))
      setStatus(result.error)
      return
    }
    setLinks(prev => [result.link, ...prev])
    setPendingLinks(prev => prev.filter(p => p.id !== pendingId))
    // Merge any newly created tags into the client-side DB tag list
    if (tags.length > 0) {
      setDbTags(prev => {
        const merged = new Set([...prev, ...tags])
        return [...merged].sort()
      })
    }
    setStatus('saved · just now')
  }, [])

  // Step 1: show confirmation dialog
  const handleDelete = useCallback((id: string) => {
    const link = links.find(e => e.id === id)
    if (!link) return
    setConfirmDelete({ id, domain: link.domain, snapshot: link })
  }, [links])

  // Step 2: user confirmed — animate card out, remove from UI, then hit DB; rollback on failure
  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete) return
    const { id, snapshot } = confirmDelete
    setConfirmDelete(null)
    // Trigger the cardOut animation on the card
    setRemovingId(id)
    // Wait for animation to finish before removing from DOM
    await new Promise(r => setTimeout(r, 220))
    setLinks(prev => prev.filter(e => e.id !== id))
    setRemovingId(null)
    // Hit the database
    const result = await deleteLink(id)
    if ('error' in result || 'needPin' in result) {
      // Restore the card at its original position
      setLinks(prev => {
        if (prev.some(e => e.id === id)) return prev
        return [...prev, snapshot].sort((a, b) => b.created_at.localeCompare(a.created_at))
      })
      setStatus('needPin' in result ? 'sign in to delete' : 'delete failed')
    }
  }, [confirmDelete])

  const handleCopy = useCallback((id: string) => {
    const e = links.find(x => x.id === id)
    if (!e) return
    try { navigator.clipboard?.writeText(e.url) } catch { /* ignore */ }
    setCopiedId(id)
    setStatus('copied · ' + e.domain)
    setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1400)
  }, [links])

  const handleTagClick = useCallback((tag: string) => {
    setActiveTag(prev => prev === tag ? null : tag)
    if (mode === 'add') setMode('search')
  }, [mode])

  // Tag rename: open confirmation dialog with the pending new name
  const handleRenameTagRequest = useCallback((oldName: string, newName: string) => {
    setConfirmRenameTag({ oldName, newName })
  }, [])

  // Confirmed rename — call server action, optimistically update client state
  const handleConfirmRenameTag = useCallback(async () => {
    if (!confirmRenameTag) return
    const { oldName, newName } = confirmRenameTag
    setConfirmRenameTag(null)
    const result = await renameTag(oldName, newName)
    if ('error' in result) { setStatus(result.error); return }
    if ('needPin' in result) { setStatus('sign in to edit tags'); return }
    setDbTags(prev => prev.map(t => t === oldName ? result.newName : t).sort())
    setLinks(prev => prev.map(link => ({
      ...link,
      tags: link.tags.map(t => t === oldName ? result.newName : t),
    })))
    setActiveTag(prev => prev === oldName ? result.newName : prev)
    setStatus(`renamed · ${result.newName}`)
  }, [confirmRenameTag])

  // Tag delete: open confirmation dialog
  const handleDeleteTagRequest = useCallback((name: string) => {
    setConfirmDeleteTag({ name })
  }, [])

  // Confirmed delete — call server action, optimistically update client state
  const handleConfirmDeleteTag = useCallback(async () => {
    if (!confirmDeleteTag) return
    const { name } = confirmDeleteTag
    setConfirmDeleteTag(null)
    const result = await deleteTag(name)
    if ('error' in result) { setStatus(result.error); return }
    if ('needPin' in result) { setStatus('sign in to edit tags'); return }
    setDbTags(prev => prev.filter(t => t !== name))
    setLinks(prev => prev.map(link => ({ ...link, tags: link.tags.filter(t => t !== name) })))
    setActiveTag(prev => prev === name ? null : prev)
    setStatus(`deleted · ${name}`)
  }, [confirmDeleteTag])

  // Open edit dialog pre-filled with the link's current data
  const handleEditOpen = useCallback((id: string) => {
    const link = links.find(e => e.id === id)
    if (!link) return
    setEditingLink(link)
    setEditUrl(link.url)
    setEditTags([...(link.tags ?? [])])
    setEditNewTag(null)
    setEditError(null)
  }, [links])

  // Save edited link
  const handleSaveEdit = useCallback(async () => {
    if (!editingLink) return
    setEditSaving(true)
    setEditError(null)
    const result = await updateLink(editingLink.id, editUrl, editTags)
    setEditSaving(false)
    if ('error' in result) { setEditError(result.error); return }
    if ('needPin' in result) { setEditError('sign in to edit'); return }
    setLinks(prev => prev.map(e => e.id === result.link.id ? result.link : e))
    // Merge any newly typed tags into the DB tag list
    if (editTags.length > 0) {
      setDbTags(prev => [...new Set([...prev, ...editTags])].sort())
    }
    setEditingLink(null)
    setStatus('saved · ' + result.link.domain)
  }, [editingLink, editUrl, editTags])

  let emptyMode: 'empty' | 'no-results' | 'no-tag' | null = null
  if (filtered.length === 0 && pendingLinks.length === 0) {
    if (links.length === 0) emptyMode = 'empty'
    else if (query) emptyMode = 'no-results'
    else if (activeTag) emptyMode = 'no-tag'
  }

  const totalVisible = filtered.length + pendingLinks.length

  return (
    <div className="app">
      <Header shape={shape} setShape={setShape} theme={theme} setTheme={setTheme} />
      <main className="page">
        {!emptyMode && (
          <div className="section-bar">
            <span className="eyebrow">
              <b>{totalVisible}</b>
              {query
                ? `result${totalVisible === 1 ? '' : 's'}`
                : activeTag
                  ? `tagged ${activeTag}`
                  : 'recently saved'}
            </span>
            <div className="section-bar-right">
              {activeTag && (
                <span className="filter-chip">
                  #{activeTag}
                  <button onClick={() => setActiveTag(null)} aria-label="Clear filter">
                    <X size={11} />
                  </button>
                </span>
              )}
              <select
                className="sort-select"
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                aria-label="Sort order"
              >
                <option value="recent">Recent</option>
                <option value="oldest">Oldest</option>
                <option value="az">A – Z</option>
              </select>
            </div>
          </div>
        )}

        {emptyMode ? (
          <EmptyState mode={emptyMode} query={query} />
        ) : (
          <div className={`grid shape-${shape}`}>
            {pendingLinks.map(p => (
              <PendingCard key={p.id} domain={p.domain} shape={shape} />
            ))}
            {filtered.map(e => (
              <LinkCard
                key={e.id}
                entry={e}
                shape={shape}
                activeTag={activeTag}
                authed={authed}
                onDelete={handleDelete}
                onEdit={handleEditOpen}
                onCopy={handleCopy}
                copied={copiedId === e.id}
                removing={removingId === e.id}
                onTagClick={handleTagClick}
                tick={tick}
              />
            ))}
          </div>
        )}
      </main>

      <Dock
        mode={mode}
        setMode={setMode}
        query={query}
        setQuery={setQuery}
        onAdd={handleAdd}
        dbTags={dbTags}
        tagCounts={tagCounts}
        activeTag={activeTag}
        onTagClick={handleTagClick}
        status={status}
        authed={authed}
        onAuthSuccess={() => setAuthed(true)}
        onRenameTagRequest={handleRenameTagRequest}
        onDeleteTagRequest={handleDeleteTagRequest}
      />

      {/* Edit link dialog */}
      {editingLink && (
        <div className="confirm-overlay" onClick={() => !editSaving && setEditingLink(null)}>
          <div className="edit-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Edit link">
            <p className="confirm-title">Edit link</p>

            {/* URL field */}
            <label className="edit-field-label">URL</label>
            <input
              className="edit-url-input"
              value={editUrl}
              onChange={e => setEditUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !editSaving) handleSaveEdit() }}
              spellCheck={false}
              autoComplete="off"
              inputMode="url"
              disabled={editSaving}
              autoFocus
            />

            {/* Tags multi-select */}
            <label className="edit-field-label">Tags</label>
            <div className="edit-tags-row">
              {dbTags.map(t => {
                const selected = editTags.includes(t)
                return (
                  <button
                    key={t}
                    className={`tag${selected ? ' active' : ''}`}
                    onClick={() => setEditTags(prev =>
                      selected ? prev.filter(x => x !== t) : [...prev, t]
                    )}
                    disabled={editSaving}
                  >{t}</button>
                )
              })}
              {/* New tag inline input */}
              {editNewTag !== null ? (
                <input
                  className="new-tag-input"
                  placeholder="tag name…"
                  value={editNewTag}
                  autoFocus
                  onChange={e => setEditNewTag(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      const t = editNewTag.trim().toLowerCase().replace(/\s+/g, '-')
                      if (t && !editTags.includes(t)) setEditTags(prev => [...prev, t])
                      setEditNewTag(null)
                    }
                    if (e.key === 'Escape') setEditNewTag(null)
                  }}
                  onBlur={() => {
                    const t = (editNewTag ?? '').trim().toLowerCase().replace(/\s+/g, '-')
                    if (t && !editTags.includes(t)) setEditTags(prev => [...prev, t])
                    setEditNewTag(null)
                  }}
                  maxLength={30}
                  disabled={editSaving}
                />
              ) : (
                <button
                  className="tag tag-plus"
                  onClick={() => setEditNewTag('')}
                  disabled={editSaving}
                  title="Add new tag"
                >
                  <Plus size={10} /> tag
                </button>
              )}
            </div>

            {editError && <p className="edit-error">{editError}</p>}

            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setEditingLink(null)} disabled={editSaving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={editSaving || !editUrl.trim()}>
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename tag confirmation */}
      {confirmRenameTag && (
        <div className="confirm-overlay" onClick={() => setConfirmRenameTag(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirm rename tag">
            <p className="confirm-title">Rename this tag?</p>
            <p className="confirm-body">
              <span className="confirm-tag-old">#{confirmRenameTag.oldName}</span>
              {' → '}
              <span className="confirm-tag-new">#{confirmRenameTag.newName}</span>
            </p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmRenameTag(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmRenameTag} autoFocus>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete tag confirmation */}
      {confirmDeleteTag && (
        <div className="confirm-overlay" onClick={() => setConfirmDeleteTag(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirm delete tag">
            <p className="confirm-title">Delete this tag?</p>
            <p className="confirm-body">#{confirmDeleteTag.name} will be removed from all links.</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteTag(null)}>Cancel</button>
              <button className="btn btn-delete" onClick={handleConfirmDeleteTag} autoFocus>Delete</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirm delete">
            <p className="confirm-title">Delete this link?</p>
            <p className="confirm-body">{confirmDelete.domain}</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-delete" onClick={handleConfirmDelete} autoFocus>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
