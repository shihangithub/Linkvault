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
