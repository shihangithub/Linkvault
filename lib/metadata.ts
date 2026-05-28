import * as cheerio from 'cheerio'

export interface Metadata {
  title: string
  description: string | null
  ogImage: string | null
  favicon: string
  domain: string
}

const KNOWN_TITLES: Record<string, string> = {
  'tailwindcss.com': 'Tailwind CSS – Rapidly build modern websites without ever leaving your HTML.',
  'github.com': 'GitHub – Where the world builds software',
  'notion.so': 'Notion – The connected workspace where better, faster work happens',
  'react.dev': 'React – The library for web and native user interfaces',
  'linear.app': 'Linear – Built for modern software development',
  'news.ycombinator.com': 'Hacker News',
  'figma.com': 'Figma – The collaborative interface design tool',
  'vercel.com': 'Vercel – Develop. Preview. Ship.',
  'nextjs.org': 'Next.js – The React framework for the web',
  'vitejs.dev': 'Vite – Next generation frontend tooling',
  'svelte.dev': 'Svelte – Cybernetically enhanced web apps',
  'developer.mozilla.org': 'MDN Web Docs',
  'stackoverflow.com': 'Stack Overflow – Where developers learn & share',
  'stripe.com': 'Stripe – Financial infrastructure for the internet',
}

export function normalizeUrl(raw: string): { url: string; domain: string } | null {
  let url = raw.trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  try {
    const u = new URL(url)
    return { url: u.toString(), domain: u.hostname.replace(/^www\./, '') }
  } catch {
    return null
  }
}

function synthesizeTitle(url: string, domain: string): string {
  if (KNOWN_TITLES[domain]) return KNOWN_TITLES[domain]
  const noSub = domain.replace(/^[^.]+\./, '')
  if (KNOWN_TITLES[noSub]) return KNOWN_TITLES[noSub]
  try {
    const u = new URL(url)
    const segs = u.pathname.split('/').filter(Boolean)
    if (segs.length) {
      const last = decodeURIComponent(segs[segs.length - 1])
        .replace(/[-_]+/g, ' ')
        .replace(/\.(html?|php|aspx?)$/i, '')
        .trim()
      if (last && last.length > 2) {
        const titled = last.charAt(0).toUpperCase() + last.slice(1)
        const root = domain.split('.').slice(-2, -1)[0] || domain
        return `${titled} · ${root.charAt(0).toUpperCase() + root.slice(1)}`
      }
    }
  } catch { /* ignore */ }
  const root = domain.split('.').slice(-2, -1)[0] || domain
  return root.charAt(0).toUpperCase() + root.slice(1)
}

function resolveUrl(href: string | undefined, base: string): string | null {
  if (!href) return null
  try { return new URL(href, base).toString() } catch { return null }
}

export async function fetchMetadata(url: string): Promise<Metadata> {
  const parsed = normalizeUrl(url)
  if (!parsed) throw new Error('Invalid URL')
  const { domain } = parsed
  const googleFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 8000)
    const resp = await fetch(parsed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkVaultBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en',
      },
      redirect: 'follow',
    })
    clearTimeout(id)

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    const html = await resp.text()
    const $ = cheerio.load(html)

    const og = (prop: string) => $(`meta[property="${prop}"]`).attr('content')?.trim()
    const mt = (name: string) => $(`meta[name="${name}"]`).attr('content')?.trim()

    let title =
      og('og:title') ||
      mt('twitter:title') ||
      $('title').text()?.trim() ||
      synthesizeTitle(parsed.url, domain)
    if (title.length > 160) title = title.slice(0, 157) + '…'

    const description = og('og:description') || mt('description') || null

    const rawOgImg = og('og:image') || mt('twitter:image')
    const ogImage = rawOgImg ? resolveUrl(rawOgImg, parsed.url) : null

    // Best favicon: try <link rel~=icon> first, fallback to Google S2
    const faviconHref = $('link[rel="icon"]').attr('href') ||
                        $('link[rel="shortcut icon"]').attr('href') ||
                        $('link[rel*="icon"]').first().attr('href')
    const favicon = resolveUrl(faviconHref, parsed.url) ?? googleFavicon

    return { title, description, ogImage, favicon, domain }
  } catch {
    return {
      title: synthesizeTitle(parsed.url, domain),
      description: null,
      ogImage: null,
      favicon: googleFavicon,
      domain,
    }
  }
}
