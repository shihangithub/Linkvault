import { fetchLinks, fetchTags } from '@/lib/supabase'
import { isAuthed } from '@/lib/auth'
import VaultApp from '@/components/VaultApp'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [links, authed, tags] = await Promise.all([fetchLinks(), isAuthed(), fetchTags()])
  return <VaultApp initial={links} initialAuthed={authed} initialTags={tags} />
}
