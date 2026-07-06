-- One-time fix: crawled_pages.embedding was created as vector(768)
-- (likely a leftover from an nomic-embed-text-based template) instead of
-- vector(3072), which is what gemini-embedding-001 actually returns.
-- Run this once in the Supabase SQL editor.

drop index if exists public.crawled_pages_embedding_idx;

alter table public.crawled_pages
  drop column embedding;

alter table public.crawled_pages
  add column embedding vector(3072);

create index if not exists crawled_pages_embedding_idx
  on public.crawled_pages
  using hnsw (embedding vector_cosine_ops);
