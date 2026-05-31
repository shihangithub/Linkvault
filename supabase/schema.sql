-- LinkVault schema
-- Run this in Supabase SQL editor after creating a new project.

create extension if not exists "pgcrypto";

create table public.links (
  id          uuid        primary key default gen_random_uuid(),
  url         text        not null,
  title       text        not null default '',
  description text,
  og_image    text,
  favicon     text,
  domain      text        not null,
  tags        text[]      not null default '{}',
  created_at  timestamptz not null default now()
);

-- Enforce URL uniqueness (server-side dedupe catches it first, but DB is the safety net)
create unique index links_url_key on public.links (url);
-- Fast descending time queries
create index links_created_idx on public.links (created_at desc);

-- Enable RLS with deny-by-default; the service-role key bypasses RLS entirely
alter table public.links enable row level security;

-- Tags table: master list of all tag names
create table public.tags (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,
  created_at timestamptz not null default now()
);
create index tags_name_idx on public.tags (name);
alter table public.tags enable row level security;

-- ── Tag management functions ──────────────────────────────────────────────

-- rename_tag: atomically renames a tag in both the tags table and all links
create or replace function public.rename_tag(old_name text, new_name text)
returns void language plpgsql security definer as $$
begin
  if trim(new_name) = '' then
    raise exception 'Tag name cannot be empty';
  end if;
  if lower(trim(new_name)) <> lower(trim(old_name)) then
    if exists (select 1 from public.tags where lower(name) = lower(trim(new_name))) then
      raise exception 'Tag "%" already exists', trim(new_name);
    end if;
  end if;
  update public.tags set name = trim(new_name) where name = old_name;
  update public.links
    set tags = array_replace(tags, old_name, trim(new_name))
    where old_name = any(tags);
end;
$$;

-- delete_tag: removes a tag from the tags table and strips it from all links
create or replace function public.delete_tag(tag_name text)
returns void language plpgsql security definer as $$
begin
  delete from public.tags where name = tag_name;
  update public.links
    set tags = array_remove(tags, tag_name)
    where tag_name = any(tags);
end;
$$;
