'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type LoginState = {
  fehler?: string
} | undefined

export async function anmelden(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get('email') as string
  const passwort = formData.get('passwort') as string

  if (!email || !passwort) {
    return { fehler: 'Bitte E-Mail und Passwort eingeben.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password: passwort })

  if (error) {
    return { fehler: 'E-Mail oder Passwort ungültig.' }
  }

  redirect('/')
}

export async function abmelden(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
