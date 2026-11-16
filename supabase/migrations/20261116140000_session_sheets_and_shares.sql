-- Fiche de séance (en-tête par projet, fiche d'exercice par tableau) et liens publics.

alter table public.projects
  add column sheet jsonb not null default '{}'::jsonb check (octet_length(sheet::text) < 20000);
alter table public.boards
  add column sheet jsonb not null default '{}'::jsonb check (octet_length(sheet::text) < 40000);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 122 bits aléatoires : impossible à deviner.
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index shares_project_idx on public.shares (project_id);
create index shares_owner_idx on public.shares (owner_id);

alter table public.shares enable row level security;

create policy "shares_owner_all" on public.shares
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

-- Seule porte d'entrée publique : renvoie un projet partagé, en lecture, à partir de son jeton.
-- SECURITY DEFINER volontaire (signalé par le conseiller Supabase) : sans jeton valide et
-- actif, la fonction ne renvoie rien.
create function public.get_shared_project(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', p.name,
    'sheet', p.sheet,
    'updated_at', p.updated_at,
    'boards', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', b.id, 'name', b.name, 'notes', b.notes, 'video_url', b.video_url, 'sheet', b.sheet, 'scene', b.scene)
        order by b.position
      )
      from public.boards b
      where b.project_id = p.id and b.deleted_at is null
    ), '[]'::jsonb)
  )
  from public.shares s
  join public.projects p on p.id = s.project_id
  where s.token = p_token
    and s.revoked_at is null
    and p.deleted_at is null
  limit 1;
$$;

revoke execute on function public.get_shared_project(text) from public;
grant execute on function public.get_shared_project(text) to anon, authenticated;

-- La duplication copie aussi les fiches.
create or replace function public.duplicate_project(
  p_id uuid,
  p_name text,
  p_as_template boolean default false
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.projects (name, folder_id, tags, is_template, sheet)
  select p_name, s.folder_id, s.tags, p_as_template, s.sheet
  from public.projects s
  where s.id = p_id
  returning id into v_id;

  if v_id is null then
    raise exception 'project not found';
  end if;

  insert into public.boards (project_id, name, notes, video_url, scene, sheet, position)
  select v_id, b.name, b.notes, b.video_url, b.scene, b.sheet, b.position
  from public.boards b
  where b.project_id = p_id and b.deleted_at is null
  order by b.position;

  return v_id;
end;
$$;
