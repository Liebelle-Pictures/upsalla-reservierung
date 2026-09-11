'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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
