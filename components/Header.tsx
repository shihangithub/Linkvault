'use client'

import Link from 'next/link'
import { LayoutGrid, List, Sun, Moon } from 'lucide-react'
import type { Shape, Theme } from '@/lib/types'

interface Props {
  count: number
  shape: Shape
  setShape: (s: Shape) => void
  theme: Theme
  setTheme: (t: Theme) => void
}

export default function Header({ count, shape, setShape, theme, setTheme }: Props) {
  return (
    <header className="header">
      <Link className="brand" href="/" aria-label="LinkVault">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={theme === 'light' ? '/linkvault-wordmark-light.svg' : '/linkvault-wordmark.svg'}
          alt="LinkVault"
          width={150}
          height={30}
        />
      </Link>
      <div className="header-meta">
        <span className="count">
          <b>{count}</b> {count === 1 ? 'entry' : 'entries'}
        </span>
        <div className="view-toggle" role="tablist" aria-label="View">
          <button
            className={shape === 'gallery' ? 'active' : ''}
            onClick={() => setShape('gallery')}
            title="Gallery view"
            aria-label="Gallery view"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            className={shape === 'index' ? 'active' : ''}
            onClick={() => setShape('index')}
            title="List view"
            aria-label="List view"
          >
            <List size={14} />
          </button>
        </div>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  )
}
