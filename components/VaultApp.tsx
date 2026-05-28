'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import Header from './Header'
import Dock from './Dock'
import LinkCard from './LinkCard'
import PendingCard from './PendingCard'
import EmptyState from './EmptyState'
import { addLink, deleteLink } from '@/app/actions'
import type { Link, Shape, Theme, SortKey } from '@/lib/types'

interface PendingLink { id: string; domain: string; tags: string[] }

interface Props {
  initial: Link[]
  initialAuthed: boolean
}

export default function VaultApp({ initial, initialAuthed }: Props) {
  const [links, setLinks] = useState<Link[]>(initial)
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([])
  const [mode, setMode] = useState<'search' | 'add'>('search')
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [authed, setAuthed] = useState(initialAuthed)
  const [status, setStatus] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('lv.theme') as Theme | null) ?? 'dark' : 'dark'
  )
  const [shape, setShapeState] = useState<Shape>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('lv.shape') as Shape | null) ?? 'gallery' : 'gallery'
  )

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

  // Tag list for search-mode bar (top 12 by count)
  const tagList = useMemo(() => {
    const map = new Map<string, number>()
    links.forEach(e => (e.tags ?? []).forEach(t => map.set(t, (map.get(t) ?? 0) + 1)))
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 12)
  }, [links])

  // All unique tags for add-mode selector
  const allTags = useMemo(() => {
    const set = new Set<string>()
    links.forEach(e => (e.tags ?? []).forEach(t => set.add(t)))
    return [...set].sort()
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
    setStatus('saved · just now')
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    // Optimistic removal
    setLinks(prev => prev.filter(e => e.id !== id))
    const result = await deleteLink(id)
    if ('error' in result) setStatus('delete failed')
  }, [])

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

  let emptyMode: 'empty' | 'no-results' | 'no-tag' | null = null
  if (filtered.length === 0 && pendingLinks.length === 0) {
    if (links.length === 0) emptyMode = 'empty'
    else if (query) emptyMode = 'no-results'
    else if (activeTag) emptyMode = 'no-tag'
  }

  const totalVisible = filtered.length + pendingLinks.length

  return (
    <div className="app">
      <Header count={links.length} shape={shape} setShape={setShape} theme={theme} setTheme={setTheme} />
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
                onDelete={handleDelete}
                onCopy={handleCopy}
                copied={copiedId === e.id}
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
        tags={tagList}
        allTags={allTags}
        activeTag={activeTag}
        onTagClick={handleTagClick}
        status={status}
        authed={authed}
        onAuthSuccess={() => setAuthed(true)}
      />
    </div>
  )
}
