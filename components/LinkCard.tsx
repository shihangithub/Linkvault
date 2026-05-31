'use client'

import { useState, useMemo } from 'react' // useState kept for imgError
import { Globe, ExternalLink, Copy, Check, Trash2, Pencil } from 'lucide-react'
import type { Link } from '@/lib/types'

function formatRelative(ts: string): string {
  const diff = Math.max(0, Date.now() - new Date(ts).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

function hashTint(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h * 31) + str.charCodeAt(i)) >>> 0
  const hue = 180 + (h % 90)
  return {
    a:    `hsla(${hue}, 70%, 55%, 0.20)`,
    b:    `hsla(${(hue + 30) % 360}, 65%, 55%, 0.10)`,
    fg:   `hsla(${hue}, 70%, 75%, 0.95)`,
    base1:`hsl(${hue}, 30%, 9%)`,
    base2:`hsl(${hue}, 25%, 13%)`,
  }
}

interface Props {
  entry: Link
  shape: 'gallery' | 'index'
  activeTag: string | null
  authed: boolean
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  onCopy: (id: string) => void
  copied: boolean
  removing: boolean
  onTagClick: (tag: string) => void
  tick: number // forces re-render for relative times
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function LinkCard({ entry, shape, activeTag, authed, onDelete, onEdit, onCopy, copied, removing, onTagClick, tick: _tick }: Props) {
  const [imgError, setImgError] = useState(false)
  const tint = useMemo(() => hashTint(entry.url), [entry.url])
  const initial = (entry.title || entry.domain || '?').replace(/^www\./, '').charAt(0).toUpperCase()
  const rel = formatRelative(entry.created_at)
  const showOgImg = !!entry.og_image && !imgError

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    onDelete(entry.id)
  }
  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    onEdit(entry.id)
  }
  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    onCopy(entry.id)
  }
  const handleTag = (e: React.MouseEvent, tag: string) => {
    e.preventDefault(); e.stopPropagation()
    onTagClick(tag)
  }
  const handleOpen = (e?: React.MouseEvent) => {
    e?.preventDefault(); e?.stopPropagation()
    window.open(entry.url, '_blank', 'noopener,noreferrer')
  }

  if (shape === 'index') {
    return (
      <div className={`card-wrap${removing ? ' removing' : ''}`}>
        <article className="asset-card shape-index" onClick={() => handleOpen()}>
          <span className="idx-dot" style={{ background: tint.fg }} />
          <span className="idx-text">
            <span className="idx-title">{entry.title}</span>
            <span className="idx-domain">{entry.domain}</span>
          </span>
          <span className="idx-tags">
            {(entry.tags ?? []).map(t => (
              <span
                key={t}
                className={`tag${activeTag === t ? ' active' : ''}`}
                onClick={e => handleTag(e, t)}
              >{t}</span>
            ))}
          </span>
          <span className="idx-meta">{rel}</span>
          <span className="idx-actions">
            <button className="btn btn-secondary btn-sm btn-icon" title={copied ? 'Copied' : 'Copy URL'} onClick={handleCopy} aria-label="Copy URL">
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
            {authed && (
              <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={handleEdit} aria-label="Edit link">
                <Pencil size={11} />
              </button>
            )}
            {authed && (
              <button className="btn btn-secondary btn-sm btn-icon danger-hover" title="Delete" onClick={handleDelete} aria-label="Delete">
                <Trash2 size={11} />
              </button>
            )}
          </span>
        </article>
      </div>
    )
  }

  // Gallery (default)
  return (
    <div className={`card-wrap${removing ? ' removing' : ''}`}>
      <article className="asset-card">
        <div
          className="preview"
          onClick={() => handleOpen()}
          style={!showOgImg ? {
            background: `radial-gradient(circle at 30% 40%, ${tint.a}, transparent 60%),
                         radial-gradient(circle at 70% 70%, ${tint.b}, transparent 55%),
                         linear-gradient(135deg, ${tint.base1}, ${tint.base2})`
          } : undefined}
        >
          <div className="preview-stripes" aria-hidden="true" />
          {showOgImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.og_image!}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="preview-og-img"
            />
          ) : (
            <div className="preview-glyph" style={{ color: tint.fg }}>{initial}</div>
          )}
          <div className="preview-meta">
            <Globe size={11} />
            {entry.domain}
          </div>
          {authed && (
            <button className="preview-delete" title="Delete" onClick={handleDelete} aria-label="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </div>
        <div className="body">
          <div className="title" onClick={() => handleOpen()}>{entry.title}</div>
          {(entry.tags ?? []).length > 0 && (
            <div className="tags">
              {(entry.tags ?? []).map(t => (
                <span
                  key={t}
                  className={`tag${activeTag === t ? ' active' : ''}`}
                  onClick={e => handleTag(e, t)}
                >{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="footer">
          <button className="btn btn-primary btn-sm btn-icon" title="Open" onClick={() => handleOpen()} aria-label="Open link">
            <ExternalLink size={13} />
          </button>
          <button className="btn btn-secondary btn-sm btn-icon" title={copied ? 'Copied' : 'Copy URL'} onClick={handleCopy} aria-label="Copy URL">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          {authed && (
            <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={handleEdit} aria-label="Edit link">
              <Pencil size={13} />
            </button>
          )}
          <span className="spacer" />
          <span className="meta">{rel}</span>
        </div>
      </article>
    </div>
  )
}
