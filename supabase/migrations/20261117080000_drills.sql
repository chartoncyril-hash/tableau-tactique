-- Phase 9c : bibliothèque d'exercices. Un exercice est personnel (club_id nul) ou rattaché à un
-- club, avec les mêmes droits que les projets : les membres le consultent et le réutilisent,
-- admins et entraîneurs l'ajoutent, le modifient et le suppriment.

create table public.drills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  club_id uuid references public.clubs (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null default '' check (char_length(category) <= 40),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  scene jsonb not null check (octet_length(scene::text) < 2000000),
  sheet jsonb not null default '{}'::jsonb check (octet_length(sheet::text) < 50000),
  notes text not null default '' check (char_length(notes) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(notes, ''))
  ) stored
);

create index drills_club_updated_idx on public.drills (club_id, updated_at desc);
create index drills_owner_idx on public.drills (owner_id);
create index drills_search_idx on public.drills using gin (search);

alter table public.drills enable row level security;

create trigger drills_set_updated_at before update on public.drills
  for each row execute function public.set_updated_at();
create trigger drills_keep_owner before update on public.drills
  for each row execute function public.keep_owner();

create policy "drills_select" on public.drills for select to authenticated
  using (public.can_read(club_id, owner_id));
create policy "drills_insert" on public.drills for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.can_edit(club_id, owner_id));
create policy "drills_update" on public.drills for update to authenticated
  using (public.can_edit(club_id, owner_id)) with check (public.can_edit(club_id, owner_id));
create policy "drills_delete" on public.drills for delete to authenticated
  using (public.can_edit(club_id, owner_id));

-- La corbeille quotidienne vide aussi les exercices supprimés depuis plus de 30 jours.
create or replace function public.purge_trash()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.boards where deleted_at < now() - interval '30 days';
  delete from public.projects where deleted_at < now() - interval '30 days';
  delete from public.folders where deleted_at < now() - interval '30 days';
  delete from public.teams where deleted_at < now() - interval '30 days';
  delete from public.drills where deleted_at < now() - interval '30 days';
end;
$$;
revoke execute on function public.purge_trash() from public, anon, authenticated;
