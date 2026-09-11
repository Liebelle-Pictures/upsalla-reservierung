'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Fuer das Badge in der Navigation — kein Auth-Check noetig, wird nur innerhalb des
// bereits geschuetzten Dashboards aufgerufen (Sidebar/MobileNav rendern nur eingeloggt)
export async function getOffeneAnfragenAnzahl(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('kunden_anfragen')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'OFFEN')
  return count ?? 0
}

export async function anfrageErledigt(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet.')

  await supabaseAdmin
    .from('kunden_anfragen')
    .update({ status: 'ERLEDIGT', erledigt_am: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/anfragen')
}
