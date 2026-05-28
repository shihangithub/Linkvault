import { createClient } from '@supabase/supabase-js'
import type { Link } from './types'

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  return createClient(url, key, { auth: { persistSession: false } })
}

export function getSupabase() {
  return getSupabaseClient()
}

export async function fetchLinks(): Promise<Link[]> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('links')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('fetchLinks error:', error.message)
      return []
    }
    return (data as Link[]) ?? []
  } catch (err) {
    console.error('fetchLinks exception:', err)
    return []
  }
}
