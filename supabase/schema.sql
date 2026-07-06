-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).

create extension if not exists vector;

create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  website_id text unique not null,
  source_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- gemini-embedding-001 returns 3072-dimension vectors; the column must match.
create table if not exists public.crawled_pages (
  id bigint generated always as identity primary key,
  content text,
  metadata jsonb,
  embedding vector(3072)
);

create index if not exists crawled_pages_embedding_idx
  on public.crawled_pages
  using hnsw (embedding vector_cosine_ops);

create index if not exists crawled_pages_website_id_idx
  on public.crawled_pages
  using btree ((metadata ->> 'website_id'));

-- Tenant-scoped similarity search, called by n8n's Supabase Vector Store node.
create or replace function public.match_documents (
  query_embedding vector(3072),
  match_count int default null,
  filter jsonb default '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    cp.id,
    cp.content,
    cp.metadata,
    1 - (cp.embedding <=> query_embedding) as similarity
  from public.crawled_pages cp
  where cp.metadata @> filter
  order by cp.embedding <=> query_embedding
  limit match_count;
end;
$$;
