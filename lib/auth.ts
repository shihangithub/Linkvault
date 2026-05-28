import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'lv_session'
const SESSION_DAYS = 30

// In-memory rate limiter (per serverless instance — acceptable for personal use)
interface RateEntry { count: number; lockedUntil: number; lastAttempt: number }
const rateMap = new Map<string, RateEntry>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000
const WINDOW_MS  = 10 * 60 * 1000

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry) {
    rateMap.set(ip, { count: 1, lockedUntil: 0, lastAttempt: now })
    return { allowed: true }
  }
  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - now }
  }
  if (now - entry.lastAttempt > WINDOW_MS) {
    rateMap.set(ip, { count: 1, lockedUntil: 0, lastAttempt: now })
    return { allowed: true }
  }
  entry.count++
  entry.lastAttempt = now
  if (entry.count > MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS
    return { allowed: false, retryAfterMs: LOCKOUT_MS }
  }
  return { allowed: true }
}

export function verifyPin(input: string): boolean {
  const pin = process.env.LINKVAULT_PIN
  if (!pin) return false
  // HMAC comparison: constant-time, handles variable-length inputs safely
  const hmac = (s: string) =>
    createHmac('sha256', 'lv-pin-salt').update(s).digest('hex')
  const a = Buffer.from(hmac(input))
  const b = Buffer.from(hmac(pin))
  try { return timingSafeEqual(a, b) } catch { return false }
}

function getSecret(): string {
  const s = process.env.LINKVAULT_SESSION_SECRET
  if (!s) throw new Error('LINKVAULT_SESSION_SECRET must be set')
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

export function makeSessionToken(): string {
  const expiry = Date.now() + SESSION_DAYS * 24 * 3600 * 1000
  const payload = `lv:${expiry}`
  return `${payload}.${sign(payload)}`
}

export function isValidToken(token: string): boolean {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  try {
    const expected = sign(payload)
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
  } catch { return false }
  const [, expiry] = payload.split(':')
  return Date.now() < parseInt(expiry, 10)
}

export async function isAuthed(): Promise<boolean> {
  try {
    const store = await cookies()
    const token = store.get(COOKIE_NAME)?.value
    if (!token) return false
    return isValidToken(token)
  } catch { return false }
}

export function getCookieName() { return COOKIE_NAME }
export function getSessionMaxAge() { return SESSION_DAYS * 24 * 3600 }
