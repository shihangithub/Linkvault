import { fetchLinks } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'
import VaultApp from '@/components/VaultApp'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [links, authed] = await Promise.all([fetchLinks(), isAuthed()])
  return <VaultApp initial={links} initialAuthed={authed} />
}
