-- Phase 5 : effectifs (équipes, joueurs, maillots) et photos privées des joueurs.

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  club text not null default '' check (char_length(club) <= 80),
  category text not null default '' check (char_length(category) <= 40),
  -- Maillot : { color, color2, pattern } (voir docs/SCENE_FORMAT.md, équipes).
  kit jsonb not null default '{}'::jsonb check (octet_length(kit::text) < 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 60),
  last_name text not null default '' check (char_length(last_name) <= 60),
  number text not null default '' check (char_length(number) <= 3),
  position text not null default '' check (position in ('', 'G', 'D', 'M', 'A')),
  foot text not null default '' check (foot in ('', 'left', 'right', 'both')),
  notes text not null default '' check (char_length(notes) <= 1000),
  photo_path text check (photo_path is null or char_length(photo_path) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teams_owner_idx on public.teams (owner_id);
create index players_team_idx on public.players (team_id);
create index players_owner_idx on public.players (owner_id);

alter table public.teams enable row level security;
alter table public.players enable row level security;

create policy "teams_owner_all" on public.teams
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "players_owner_all" on public.players
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.teams t where t.id = team_id and t.owner_id = (select auth.uid()))
    -- Une photo ne peut pointer que vers le dossier de son propriétaire.
    and (photo_path is null or split_part(photo_path, '/', 1) = (select auth.uid())::text)
  );

create trigger teams_set_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger players_set_updated_at before update on public.players
  for each row execute function public.set_updated_at();

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
end;
$$;
revoke execute on function public.purge_trash() from public, anon, authenticated;

-- Photos : espace privé, 1 Mo et images seulement ; chacun ne voit que son dossier `<uid>/...`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-photos', 'player-photos', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "player_photos_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'player-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "player_photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'player-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "player_photos_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'player-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'player-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "player_photos_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'player-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
