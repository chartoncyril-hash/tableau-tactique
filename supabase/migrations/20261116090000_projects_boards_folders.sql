-- Phase 3 : dossiers, projets, tableaux et versions.

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  tags text[] not null default '{}',
  favorite boolean not null default false,
  is_template boolean not null default false,
  search tsvector generated always as (to_tsvector('simple', name)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null default 0,
  name text not null check (char_length(name) between 1 and 120),
  notes text not null default '' check (char_length(notes) <= 20000),
  video_url text check (video_url is null or char_length(video_url) <= 500),
  scene jsonb not null check (octet_length(scene::text) < 2000000),
  search tsvector generated always as (to_tsvector('simple', name || ' ' || notes)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.board_versions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scene jsonb not null check (octet_length(scene::text) < 2000000),
  created_at timestamptz not null default now()
);

create index folders_owner_idx on public.folders (owner_id);
create index folders_parent_idx on public.folders (parent_id);
create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);
create index projects_folder_idx on public.projects (folder_id);
create index projects_search_idx on public.projects using gin (search);
create index boards_project_position_idx on public.boards (project_id, position);
create index boards_owner_idx on public.boards (owner_id);
create index boards_search_idx on public.boards using gin (search);
create index board_versions_board_created_idx on public.board_versions (board_id, created_at desc);
create index board_versions_owner_idx on public.board_versions (owner_id);

alter table public.folders enable row level security;
alter table public.projects enable row level security;
alter table public.boards enable row level security;
alter table public.board_versions enable row level security;

create policy "folders_owner_all" on public.folders
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "projects_owner_all" on public.projects
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (
      folder_id is null
      or exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = (select auth.uid()))
    )
  );

create policy "boards_owner_all" on public.boards
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

create policy "board_versions_owner_all" on public.board_versions
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.boards b where b.id = board_id and b.owner_id = (select auth.uid()))
  );

create trigger folders_set_updated_at before update on public.folders
  for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger boards_set_updated_at before update on public.boards
  for each row execute function public.set_updated_at();

-- Modifier un tableau fait remonter son projet dans la liste.
create function public.touch_project()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.projects set updated_at = now() where id = new.project_id;
  return new;
end;
$$;
revoke execute on function public.touch_project() from public, anon, authenticated;

create trigger boards_touch_project after insert or update on public.boards
  for each row execute function public.touch_project();

-- On garde les 50 dernières versions de chaque tableau.
create function public.prune_board_versions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.board_versions v
  where v.board_id = new.board_id
    and v.id not in (
      select k.id from public.board_versions k
      where k.board_id = new.board_id
      order by k.created_at desc
      limit 50
    );
  return new;
end;
$$;
revoke execute on function public.prune_board_versions() from public, anon, authenticated;

create trigger board_versions_prune after insert on public.board_versions
  for each row execute function public.prune_board_versions();

create function public.create_project(
  p_name text,
  p_board_name text,
  p_scene jsonb,
  p_folder uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.projects (name, folder_id) values (p_name, p_folder) returning id into v_id;
  insert into public.boards (project_id, name, scene, position) values (v_id, p_board_name, p_scene, 0);
  return v_id;
end;
$$;

create function public.duplicate_project(
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
  insert into public.projects (name, folder_id, tags, is_template)
  select p_name, s.folder_id, s.tags, p_as_template
  from public.projects s
  where s.id = p_id
  returning id into v_id;

  if v_id is null then
    raise exception 'project not found';
  end if;

  insert into public.boards (project_id, name, notes, video_url, scene, position)
  select v_id, b.name, b.notes, b.video_url, b.scene, b.position
  from public.boards b
  where b.project_id = p_id and b.deleted_at is null
  order by b.position;

  return v_id;
end;
$$;

create function public.search_projects(q text)
returns setof public.projects
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.projects p
  where p.deleted_at is null
    and (
      p.name ilike '%' || q || '%'
      or exists (select 1 from unnest(p.tags) t where t ilike '%' || q || '%')
      or exists (
        select 1 from public.boards b
        where b.project_id = p.id
          and b.deleted_at is null
          and (b.name ilike '%' || q || '%' or b.search @@ websearch_to_tsquery('simple', q))
      )
    )
  order by p.updated_at desc
  limit 100;
$$;

revoke execute on function public.create_project(text, text, jsonb, uuid) from public, anon;
revoke execute on function public.duplicate_project(uuid, text, boolean) from public, anon;
revoke execute on function public.search_projects(text) from public, anon;
grant execute on function public.create_project(text, text, jsonb, uuid) to authenticated;
grant execute on function public.duplicate_project(uuid, text, boolean) to authenticated;
grant execute on function public.search_projects(text) to authenticated;
