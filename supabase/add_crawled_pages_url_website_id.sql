-- Run this once in Supabase SQL Editor if crawled_pages already exists.

alter table public.crawled_pages
  add column if not exists website_id text,
  add column if not exists url text;

update public.crawled_pages
set
  website_id = coalesce(website_id, metadata ->> 'website_id'),
  url = coalesce(url, metadata ->> 'url')
where metadata is not null;

create index if not exists crawled_pages_website_id_idx
  on public.crawled_pages
  using btree (website_id);

create index if not exists crawled_pages_url_idx
  on public.crawled_pages
  using btree (url);
