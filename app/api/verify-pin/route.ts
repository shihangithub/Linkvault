import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, verifyPin, makeSessionToken, getCookieName, getSessionMaxAge } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const rateCheck = checkRateLimit(ip)
  if (!rateCheck.allowed) {
    const retryAfter = Math.ceil((rateCheck.retryAfterMs ?? 60_000) / 1000)
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  let pin: string
  try {
    const body = await req.json()
    pin = String(body.pin ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!pin) {
    return NextResponse.json({ error: 'PIN is required' }, { status: 400 })
  }

  if (!verifyPin(pin)) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
  }

  const token = makeSessionToken()
  const res = NextResponse.json({ success: true })
  res.cookies.set(getCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: getSessionMaxAge(),
    path: '/',
  })
  return res
}
