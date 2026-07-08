-- One-time fix: the live websites table is missing updated_at, which schema.sql
-- defines but was never applied to this project. Run this once in the
-- Supabase SQL editor (Project > SQL Editor > New query).

alter table public.websites
  add column if not exists updated_at timestamptz not null default now();

-- Keep updated_at current automatically on every UPDATE (e.g. once the
-- crawl workflow's "Create a row" step is changed to upsert instead of insert).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists websites_set_updated_at on public.websites;

create trigger websites_set_updated_at
  before update on public.websites
  for each row
  execute function public.set_updated_at();
