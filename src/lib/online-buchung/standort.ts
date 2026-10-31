import { supabaseAdmin } from '@/lib/supabase/admin'

export interface OnlineStandort {
  id: string
  name: string
  slug: string
}

// Löst den öffentlichen Slug (/buchen/[standort]) auf. null → Route antwortet mit 404
// (unbekannter Slug oder Online-Buchung für diesen Standort ausgeschaltet).
// Nur für lokale Entwicklung: ONLINE_BUCHUNG_SCHALTER_IGNORIEREN=true ignoriert den Schalter
// (wirkt nie in Produktion).
export async function ladeOnlineStandort(slug: string): Promise<OnlineStandort | null> {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return null
  const { data, error } = await supabaseAdmin
    .from('standorte')
    .select('id, name, slug, aktiv, online_buchung_aktiv')
    .eq('slug', slug)
    .maybeSingle()
  if (error) {
    console.error('[online-buchung] Standort laden fehlgeschlagen:', error.message)
    return null
  }
  if (!data || !data.aktiv) return null
  const devOverride = process.env.NODE_ENV === 'development' && process.env.ONLINE_BUCHUNG_SCHALTER_IGNORIEREN === 'true'
  if (!data.online_buchung_aktiv && !devOverride) return null
  return { id: data.id, name: data.name, slug: data.slug }
}
