import { SearchX, FilterX, Inbox } from 'lucide-react'

interface Props {
  mode: 'empty' | 'no-results' | 'no-tag'
  query?: string
}

export default function EmptyState({ mode, query }: Props) {
  if (mode === 'no-results') {
    return (
      <div className="empty">
        <div className="glyph"><SearchX size={22} /></div>
        <div className="msg">no matches for <span style={{ color: 'var(--fg)' }}>&ldquo;{query}&rdquo;</span></div>
        <div className="hint">try a shorter query or clear filters</div>
      </div>
    )
  }
  if (mode === 'no-tag') {
    return (
      <div className="empty">
        <div className="glyph"><FilterX size={22} /></div>
        <div className="msg">no entries with this tag</div>
        <div className="hint">click the active tag again to clear it</div>
      </div>
    )
  }
  return (
    <div className="empty">
      <div className="glyph"><Inbox size={22} /></div>
      <div className="msg">nothing here yet</div>
      <div className="hint">
        switch the dock to <kbd>Add</kbd> and drop in a url —<br />
        or press <kbd>⌘N</kbd> to start
      </div>
    </div>
  )
}
