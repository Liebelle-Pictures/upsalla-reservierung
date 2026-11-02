// Schutz der öffentlichen Buchungs-API: Cloudflare Turnstile + Rate-Limit pro IP-Hash.
// Siehe docs/module/online-buchung.md, 5.3 und 5.7.
//
// Env:
//   TURNSTILE_SECRET_KEY            Server-Schlüssel (Cloudflare)
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY  Site-Schlüssel (Widget im Browser)
//   IP_HASH_SALT                    Geheimer Salt für den IP-Hash (DSGVO: IP nie im Klartext)
// Fehlen sie: in development wird übersprungen (Warnung im Log), sonst schlägt die Anfrage
// fehl (503), damit Production/Preview nie ungeschützt laufen.
import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { RATE_LIMIT } from './konfiguration'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const IST_DEV = process.env.NODE_ENV === 'development'

export type SchutzErgebnis =
  | { ok: true }
  | { ok: false; status: 400 | 429 | 503; hinweis: string; feld?: string }

// ─── IP ─────────────────────────────────────────────────────────────────────────

// Vercel setzt x-real-ip; sonst erster Eintrag aus x-forwarded-for
export function ermittleIp(headers: Headers): string {
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const weitergeleitet = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return weitergeleitet || 'unbekannt'
}

export function ipHash(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

function ladeSalt(): string | null {
  const salt = process.env.IP_HASH_SALT
  if (salt) return salt
  if (IST_DEV) {
    console.warn('[Online-Buchung] IP_HASH_SALT fehlt — nur in development erlaubt (fester Dev-Salt).')
    return 'dev-salt-nur-lokal'
  }
  return null
}

// ─── Rate-Limit ─────────────────────────────────────────────────────────────────

// Rein: darf ein weiterer Versuch erfolgen, wenn im Zeitfenster schon `bisher` gezählt wurden?
export function rateLimitErlaubt(bisher: number, limit: number = RATE_LIMIT.anzahl): boolean {
  return bisher < limit
}

// Zählt die Versuche dieses IP-Hashes im Fenster und protokolliert den aktuellen.
// DB-Fehler → durchlassen (Turnstile schützt weiterhin), aber loggen.
export async function pruefeRateLimit(hash: string, jetzt: Date = new Date()): Promise<boolean> {
  const seit = new Date(jetzt.getTime() - RATE_LIMIT.minuten * 60_000).toISOString()
  const { count, error } = await supabaseAdmin
    .from('online_buchung_versuche')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', hash)
    .gte('erstellt_am', seit)
  if (error) {
    console.error('[Online-Buchung] Rate-Limit zählen fehlgeschlagen:', error.message)
    return true
  }
  if (!rateLimitErlaubt(count ?? 0)) return false
  const { error: insErr } = await supabaseAdmin.from('online_buchung_versuche').insert({ ip_hash: hash })
  if (insErr) console.error('[Online-Buchung] Rate-Limit protokollieren fehlgeschlagen:', insErr.message)
  return true
}

// ─── Turnstile ──────────────────────────────────────────────────────────────────

export interface TurnstileAntwort {
  success: boolean
  'error-codes'?: string[]
  hostname?: string
  action?: string
}

// Prüft das Token bei Cloudflare. secret als Parameter, damit der Test die Test-Schlüssel nutzen kann.
export async function pruefeTurnstileToken(token: string, secret: string, ip?: string): Promise<TurnstileAntwort> {
  const form = new URLSearchParams({ secret, response: token })
  if (ip && ip !== 'unbekannt') form.set('remoteip', ip)
  try {
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return { success: false, 'error-codes': [`http-${res.status}`] }
    return (await res.json()) as TurnstileAntwort
  } catch (e) {
    console.error('[Online-Buchung] Turnstile nicht erreichbar:', e)
    return { success: false, 'error-codes': ['nicht-erreichbar'] }
  }
}

const HINWEIS_TURNSTILE = 'Die Sicherheitsprüfung ist abgelaufen oder fehlgeschlagen. Bitte tippt noch einmal auf „Zahlungspflichtig buchen“.'
const HINWEIS_RATE_LIMIT = 'Zu viele Versuche in kurzer Zeit. Bitte wartet ein paar Minuten und versucht es dann erneut, oder ruft uns an: 0202 2623339.'
const HINWEIS_NICHT_VERFUEGBAR = 'Die Online-Buchung ist gerade nicht verfügbar. Bitte ruft uns an: 0202 2623339.'

// Komplette Prüfung für einen neuen Buchungsversuch: Rate-Limit, dann Turnstile.
export async function pruefeSchutz(headers: Headers, token: unknown): Promise<SchutzErgebnis> {
  const ip = ermittleIp(headers)

  const salt = ladeSalt()
  if (!salt) {
    console.error('[Online-Buchung] IP_HASH_SALT fehlt — Buchungen werden abgelehnt.')
    return { ok: false, status: 503, hinweis: HINWEIS_NICHT_VERFUEGBAR }
  }
  if (!(await pruefeRateLimit(ipHash(ip, salt)))) {
    return { ok: false, status: 429, hinweis: HINWEIS_RATE_LIMIT }
  }

  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    if (IST_DEV) {
      console.warn('[Online-Buchung] TURNSTILE_SECRET_KEY fehlt — Turnstile in development übersprungen.')
      return { ok: true }
    }
    console.error('[Online-Buchung] TURNSTILE_SECRET_KEY fehlt — Buchungen werden abgelehnt.')
    return { ok: false, status: 503, hinweis: HINWEIS_NICHT_VERFUEGBAR }
  }
  if (typeof token !== 'string' || !token || token.length > 2048) {
    return { ok: false, status: 400, hinweis: HINWEIS_TURNSTILE, feld: 'turnstile_token' }
  }
  const antwort = await pruefeTurnstileToken(token, secret, ip)
  if (!antwort.success) {
    console.warn('[Online-Buchung] Turnstile abgelehnt:', antwort['error-codes']?.join(',') ?? '-')
    return { ok: false, status: 400, hinweis: HINWEIS_TURNSTILE, feld: 'turnstile_token' }
  }
  return { ok: true }
}
