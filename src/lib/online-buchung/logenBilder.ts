// Fotos der Logen (Spalte logen.bild_url, Migration 012) für das Online-Widget.
// Getrennt von der gemeinsamen Verfügbarkeitslogik, damit die Lena-Route unverändert bleibt.
// Solange Migration 012 nicht ausgeführt ist (Spalte fehlt), gibt es einfach keine Fotos.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sichereBildUrl } from './validierung'

export async function ladeLogenBilder(standortId: string): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin
    .from('logen')
    .select('id, bild_url')
    .eq('standort_id', standortId)
    .not('bild_url', 'is', null)
  if (error) {
    // 42703 = Spalte existiert (noch) nicht → ohne Fotos weiter
    if (error.code !== '42703') console.error('[online-buchung] Logen-Fotos laden fehlgeschlagen:', error.message)
    return new Map()
  }
  const bilder = new Map<string, string>()
  for (const zeile of (data ?? []) as Array<{ id: string; bild_url: unknown }>) {
    const url = sichereBildUrl(zeile.bild_url)
    if (url) bilder.set(zeile.id, url)
  }
  return bilder
}
