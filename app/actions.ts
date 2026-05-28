'use server'

import { revalidatePath } from 'next/cache'
import { isAuthed } from '@/lib/auth'
import { fetchMetadata, normalizeUrl } from '@/lib/metadata'
import { getSupabase } from '@/lib/supabase'
import type { AddResult, DeleteResult } from '@/lib/types'

export async function addLink(url: string, tags: string[]): Promise<AddResult> {
  const authed = await isAuthed()
  if (!authed) return { needPin: true }

  const normalized = normalizeUrl(url)
  if (!normalized) return { error: "couldn't parse that url" }

  const supabase = getSupabase()

  // Dedupe check
  const { data: existing } = await supabase
    .from('links')
    .select('id')
    .eq('url', normalized.url)
    .maybeSingle()
  if (existing) return { error: 'already saved' }

  let metadata
  try {
    metadata = await fetchMetadata(normalized.url)
  } catch {
    metadata = {
      title: normalized.domain,
      description: null,
      ogImage: null,
      favicon: `https://www.google.com/s2/favicons?domain=${normalized.domain}&sz=64`,
      domain: normalized.domain,
    }
  }

  const { data, error } = await supabase
    .from('links')
    .insert({
      url: normalized.url,
      title: metadata.title,
      description: metadata.description,
      og_image: metadata.ogImage,
      favicon: metadata.favicon,
      domain: normalized.domain,
      tags: tags.filter(Boolean),
    })
    .select()
    .single()

  if (error) {
    // Unique constraint violation = already saved
    if (error.code === '23505') return { error: 'already saved' }
    return { error: error.message }
  }

  // Persist any new tags to the tags table (upsert, ignore duplicates)
  const cleanTags = tags.filter(Boolean)
  if (cleanTags.length > 0) {
    await supabase
      .from('tags')
      .upsert(cleanTags.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
  }

  revalidatePath('/')
  return { success: true, link: data }
}

export async function deleteLink(id: string): Promise<DeleteResult> {
  const authed = await isAuthed()
  if (!authed) return { needPin: true }

  const supabase = getSupabase()
  const { error } = await supabase.from('links').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/')
  return { success: true }
}
