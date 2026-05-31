export interface Link {
  id: string
  url: string
  title: string
  description: string | null
  og_image: string | null
  favicon: string | null
  domain: string
  tags: string[]
  created_at: string
}

export type Shape = 'gallery' | 'index'
export type Theme = 'dark' | 'light'
export type SortKey = 'recent' | 'oldest' | 'az'

export type AddResult =
  | { success: true; link: Link }
  | { needPin: true }
  | { error: string }

export type DeleteResult =
  | { success: true }
  | { needPin: true }
  | { error: string }

export type UpdateResult =
  | { success: true; link: Link }
  | { needPin: true }
  | { error: string }

export type RenameTagResult =
  | { success: true; oldName: string; newName: string }
  | { needPin: true }
  | { error: string }

export type DeleteTagResult =
  | { success: true; tagName: string }
  | { needPin: true }
  | { error: string }
