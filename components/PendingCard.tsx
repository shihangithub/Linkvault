import { Globe } from 'lucide-react'

interface Props {
  domain: string
  shape: 'gallery' | 'index'
}

export default function PendingCard({ domain, shape }: Props) {
  if (shape === 'index') {
    return (
      <article className="asset-card shape-index pending">
        <span className="idx-dot" style={{ background: 'var(--accent)' }} />
        <span className="idx-text">
          <span className="idx-title"><div className="sk-line w-70" /></span>
          <span className="idx-domain">{domain}</span>
        </span>
        <span className="idx-tags"><div className="sk-tag" /></span>
        <span className="idx-meta pending-label" style={{ position: 'static', top: 'auto', right: 'auto' }}>fetching</span>
        <span />
      </article>
    )
  }

  return (
    <article className="asset-card pending">
      <div className="preview preview-pending">
        <div className="preview-stripes" aria-hidden="true" />
        <div className="preview-spinner" aria-hidden="true" />
        <div className="preview-meta">
          <Globe size={11} />
          {domain}
        </div>
        <div className="pending-label">fetching</div>
      </div>
      <div className="body">
        <div className="sk-line w-90" />
        <div className="sk-line w-50" style={{ height: 9 }} />
        <div className="tags">
          <div className="sk-tag" />
          <div className="sk-tag" style={{ width: 60 }} />
        </div>
      </div>
      <div className="footer">
        <div className="sk-line w-30" style={{ height: 9 }} />
      </div>
    </article>
  )
}
