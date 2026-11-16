-- Phase 9 : espaces club. Un dossier, un projet ou un effectif est soit personnel (club_id nul,
-- visible de son seul créateur), soit rattaché à un club : tous les membres le voient, les
-- admins et entraîneurs le modifient, les lecteurs le consultent. Tableaux, versions, liens
-- publics, joueurs et photos héritent des droits de leur projet ou de leur équipe.

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'coach', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

-- Invitation = lien à usage unique, valable 14 jours, révocable (aucun e-mail n'est envoyé).
create table public.club_invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  role text not null default 'coach' check (role in ('admin', 'coach', 'viewer')),
  label text not null default '' check (char_length(label) <= 80),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz
);

create index club_members_user_idx on public.club_members (user_id);
create index club_invites_club_idx on public.club_invites (club_id);
create index club_invites_invited_by_idx on public.club_invites (invited_by);
create index club_invites_accepted_by_idx on public.club_invites (accepted_by);
create index clubs_created_by_idx on public.clubs (created_by);

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_invites enable row level security;

create trigger clubs_set_updated_at before update on public.clubs
  for each row execute function public.set_updated_at();

-- Rôle de l'utilisateur connecté dans un club (null s'il n'en est pas membre). SECURITY DEFINER
-- volontaire : lit club_members sans repasser par sa propre RLS (évite la récursion) et ne
-- renvoie jamais que le rôle de l'appelant.
create function public.club_role(p_club uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.club_members m where m.club_id = p_club and m.user_id = (select auth.uid());
$$;
revoke execute on function public.club_role(uuid) from public, anon;
grant execute on function public.club_role(uuid) to authenticated;

-- Droits sur un contenu, selon qu'il est personnel ou rattaché à un club.
create function public.can_read(p_club uuid, p_owner uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when p_club is null then p_owner = (select auth.uid())
    else public.club_role(p_club) is not null
  end;
$$;

create function public.can_edit(p_club uuid, p_owner uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when p_club is null then p_owner = (select auth.uid())
    else coalesce(public.club_role(p_club) in ('admin', 'coach'), false)
  end;
$$;
revoke execute on function public.can_read(uuid, uuid) from public, anon;
revoke execute on function public.can_edit(uuid, uuid) from public, anon;
grant execute on function public.can_read(uuid, uuid) to authenticated;
grant execute on function public.can_edit(uuid, uuid) to authenticated;

-- --- Clubs, membres, invitations ----------------------------------------------

create policy "clubs_member_select" on public.clubs
  for select to authenticated using (public.club_role(id) is not null);
create policy "clubs_admin_update" on public.clubs
  for update to authenticated
  using (public.club_role(id) = 'admin') with check (public.club_role(id) = 'admin');
create policy "clubs_admin_delete" on public.clubs
  for delete to authenticated using (public.club_role(id) = 'admin');

create policy "club_members_member_select" on public.club_members
  for select to authenticated using (public.club_role(club_id) is not null);
create policy "club_members_admin_update" on public.club_members
  for update to authenticated
  using (public.club_role(club_id) = 'admin') with check (public.club_role(club_id) = 'admin');
-- Un admin retire un membre ; chacun peut quitter le club.
create policy "club_members_admin_or_self_delete" on public.club_members
  for delete to authenticated
  using (public.club_role(club_id) = 'admin' or user_id = (select auth.uid()));

create policy "club_invites_admin_all" on public.club_invites
  for all to authenticated
  using (public.club_role(club_id) = 'admin')
  with check (public.club_role(club_id) = 'admin' and invited_by = (select auth.uid()));

-- Un club garde toujours au moins un admin (sauf quand le club ou le compte disparaît).
create function public.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'
    and (tg_op = 'DELETE' or new.role <> 'admin')
    and exists (select 1 from public.clubs c where c.id = old.club_id)
    and exists (select 1 from auth.users u where u.id = old.user_id)
    and not exists (
      select 1 from public.club_members m
      where m.club_id = old.club_id and m.role = 'admin' and m.user_id <> old.user_id
    )
  then
    raise exception 'last_admin' using errcode = 'P0001', hint = 'Nommez un autre admin avant.';
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.keep_one_admin() from public, anon, authenticated;

create trigger club_members_keep_admin before update or delete on public.club_members
  for each row execute function public.keep_one_admin();

create function public.create_club(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  insert into public.clubs (name, created_by) values (p_name, v_uid) returning id into v_id;
  insert into public.club_members (club_id, user_id, role) values (v_id, v_uid, 'admin');
  return v_id;
end;
$$;
revoke execute on function public.create_club(text) from public, anon;
grant execute on function public.create_club(text) to authenticated;

-- Page d'invitation : nom du club et état du lien, même avant connexion.
create function public.get_invite(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'club_id', i.club_id,
    'club_name', c.name,
    'role', i.role,
    'status', case
      when i.revoked_at is not null then 'revoked'
      when i.accepted_at is not null then 'used'
      when i.expires_at < now() then 'expired'
      else 'valid'
    end,
    'member', exists (
      select 1 from public.club_members m where m.club_id = i.club_id and m.user_id = (select auth.uid())
    )
  )
  from public.club_invites i
  join public.clubs c on c.id = i.club_id
  where i.token = p_token;
$$;
revoke execute on function public.get_invite(text) from public;
grant execute on function public.get_invite(text) to anon, authenticated;

create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.club_invites;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_invite from public.club_invites where token = p_token for update;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  -- Déjà membre : on n'utilise pas le lien, on ne change pas le rôle.
  if exists (select 1 from public.club_members m where m.club_id = v_invite.club_id and m.user_id = v_uid) then
    return v_invite.club_id;
  end if;
  if v_invite.revoked_at is not null or v_invite.accepted_at is not null or v_invite.expires_at < now() then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;
  insert into public.club_members (club_id, user_id, role) values (v_invite.club_id, v_uid, v_invite.role);
  update public.club_invites set accepted_by = v_uid, accepted_at = now() where id = v_invite.id;
  return v_invite.club_id;
end;
$$;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- Membres d'un club avec leur adresse et leur nom, visibles des seuls membres.
create function public.club_members_list(p_club uuid)
returns table (user_id uuid, role text, email text, display_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.role, u.email::text, p.display_name, m.created_at
  from public.club_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.club_id = p_club
    and exists (select 1 from public.club_members me where me.club_id = p_club and me.user_id = (select auth.uid()))
  order by case m.role when 'admin' then 0 when 'coach' then 1 else 2 end, m.created_at;
$$;
revoke execute on function public.club_members_list(uuid) from public, anon;
grant execute on function public.club_members_list(uuid) to authenticated;

-- --- Contenus rattachés à un club ---------------------------------------------

alter table public.folders add column club_id uuid references public.clubs (id) on delete cascade;
alter table public.projects add column club_id uuid references public.clubs (id) on delete cascade;
alter table public.teams add column club_id uuid references public.clubs (id) on delete cascade;
create index folders_club_idx on public.folders (club_id);
create index projects_club_updated_idx on public.projects (club_id, updated_at desc);
create index teams_club_idx on public.teams (club_id);

-- Le créateur d'une ligne ne change jamais (personne ne s'approprie le contenu d'un autre).
create function public.keep_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.owner_id := old.owner_id;
  return new;
end;
$$;
revoke execute on function public.keep_owner() from public, anon, authenticated;
create trigger folders_keep_owner before update on public.folders for each row execute function public.keep_owner();
create trigger projects_keep_owner before update on public.projects for each row execute function public.keep_owner();
create trigger boards_keep_owner before update on public.boards for each row execute function public.keep_owner();
create trigger teams_keep_owner before update on public.teams for each row execute function public.keep_owner();
create trigger players_keep_owner before update on public.players for each row execute function public.keep_owner();

drop policy "folders_owner_all" on public.folders;
drop policy "projects_owner_all" on public.projects;
drop policy "boards_owner_all" on public.boards;
drop policy "board_versions_owner_all" on public.board_versions;
drop policy "shares_owner_all" on public.shares;
drop policy "teams_owner_all" on public.teams;
drop policy "players_owner_all" on public.players;

-- Dossiers, projets, équipes : même règle, d'après club_id et le créateur.
create policy "folders_select" on public.folders for select to authenticated
  using (public.can_read(club_id, owner_id));
create policy "folders_insert" on public.folders for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.can_edit(club_id, owner_id));
create policy "folders_update" on public.folders for update to authenticated
  using (public.can_edit(club_id, owner_id)) with check (public.can_edit(club_id, owner_id));
create policy "folders_delete" on public.folders for delete to authenticated
  using (public.can_edit(club_id, owner_id));

-- Un projet ne se range que dans un dossier du même espace.
create policy "projects_select" on public.projects for select to authenticated
  using (public.can_read(club_id, owner_id));
create policy "projects_insert" on public.projects for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.can_edit(club_id, owner_id)
    and (folder_id is null or exists (
      select 1 from public.folders f where f.id = folder_id and f.club_id is not distinct from projects.club_id
    ))
  );
create policy "projects_update" on public.projects for update to authenticated
  using (public.can_edit(club_id, owner_id))
  with check (
    public.can_edit(club_id, owner_id)
    and (folder_id is null or exists (
      select 1 from public.folders f where f.id = folder_id and f.club_id is not distinct from projects.club_id
    ))
  );
create policy "projects_delete" on public.projects for delete to authenticated
  using (public.can_edit(club_id, owner_id));

create policy "teams_select" on public.teams for select to authenticated
  using (public.can_read(club_id, owner_id));
create policy "teams_insert" on public.teams for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.can_edit(club_id, owner_id));
create policy "teams_update" on public.teams for update to authenticated
  using (public.can_edit(club_id, owner_id)) with check (public.can_edit(club_id, owner_id));
create policy "teams_delete" on public.teams for delete to authenticated
  using (public.can_edit(club_id, owner_id));

-- Tableaux : droits du projet.
create policy "boards_select" on public.boards for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));
create policy "boards_insert" on public.boards for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and public.can_edit(p.club_id, p.owner_id))
  );
create policy "boards_update" on public.boards for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.can_edit(p.club_id, p.owner_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.can_edit(p.club_id, p.owner_id)));
create policy "boards_delete" on public.boards for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.can_edit(p.club_id, p.owner_id)));

create policy "board_versions_select" on public.board_versions for select to authenticated
  using (exists (select 1 from public.boards b where b.id = board_id));
create policy "board_versions_insert" on public.board_versions for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.boards b join public.projects p on p.id = b.project_id
      where b.id = board_id and public.can_edit(p.club_id, p.owner_id)
    )
  );
-- Suppression : purge des anciennes versions par le déclencheur, quel que soit l'auteur.
create policy "board_versions_delete" on public.board_versions for delete to authenticated
  using (exists (
    select 1 from public.boards b join public.projects p on p.id = b.project_id
    where b.id = board_id and public.can_edit(p.club_id, p.owner_id)
  ));

-- Liens publics : gérés par ceux qui peuvent modifier le projet.
create policy "shares_editor_all" on public.shares for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.can_edit(p.club_id, p.owner_id)))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and public.can_edit(p.club_id, p.owner_id))
  );

-- Joueurs : droits de l'équipe.
create policy "players_select" on public.players for select to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id));
create policy "players_insert" on public.players for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.teams t where t.id = team_id and public.can_edit(t.club_id, t.owner_id))
  );
create policy "players_update" on public.players for update to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and public.can_edit(t.club_id, t.owner_id)))
  with check (exists (select 1 from public.teams t where t.id = team_id and public.can_edit(t.club_id, t.owner_id)));
create policy "players_delete" on public.players for delete to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and public.can_edit(t.club_id, t.owner_id)));

-- Une nouvelle photo doit être rangée dans le dossier de son espace : `<uid>/…` pour une équipe
-- personnelle, `clubs/<club>/…` pour une équipe de club. Vérifié seulement quand le chemin change,
-- pour qu'un entraîneur puisse modifier un joueur dont la photo a été déposée par un autre.
create function public.check_player_photo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_club uuid;
begin
  if new.photo_path is null or (tg_op = 'UPDATE' and new.photo_path is not distinct from old.photo_path) then
    return new;
  end if;
  select t.club_id into v_club from public.teams t where t.id = new.team_id;
  if v_club is null and split_part(new.photo_path, '/', 1) = (select auth.uid())::text then
    return new;
  end if;
  if v_club is not null and new.photo_path like 'clubs/' || v_club::text || '/%' then
    return new;
  end if;
  raise exception 'photo_path_outside_scope' using errcode = '42501';
end;
$$;
revoke execute on function public.check_player_photo() from public, anon, authenticated;
create trigger players_check_photo before insert or update on public.players
  for each row execute function public.check_player_photo();

-- --- Fonctions existantes : espace de création, de copie et de recherche ---------

drop function public.create_project(text, text, jsonb, uuid);
create function public.create_project(
  p_name text,
  p_board_name text,
  p_scene jsonb,
  p_folder uuid default null,
  p_club uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.projects (name, folder_id, club_id) values (p_name, p_folder, p_club) returning id into v_id;
  insert into public.boards (project_id, name, scene, position) values (v_id, p_board_name, p_scene, 0);
  return v_id;
end;
$$;

-- Copie vers l'espace demandé (un lecteur peut copier un projet du club dans son espace perso).
drop function public.duplicate_project(uuid, text, boolean);
create function public.duplicate_project(
  p_id uuid,
  p_name text,
  p_as_template boolean default false,
  p_club uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.projects (name, folder_id, tags, is_template, sheet, club_id)
  select p_name, case when s.club_id is not distinct from p_club then s.folder_id end, s.tags, p_as_template, s.sheet, p_club
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

drop function public.search_projects(text);
create function public.search_projects(q text, p_club uuid default null)
returns setof public.projects
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.projects p
  where p.deleted_at is null
    and p.club_id is not distinct from p_club
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

revoke execute on function public.create_project(text, text, jsonb, uuid, uuid) from public, anon;
revoke execute on function public.duplicate_project(uuid, text, boolean, uuid) from public, anon;
revoke execute on function public.search_projects(text, uuid) from public, anon;
grant execute on function public.create_project(text, text, jsonb, uuid, uuid) to authenticated;
grant execute on function public.duplicate_project(uuid, text, boolean, uuid) to authenticated;
grant execute on function public.search_projects(text, uuid) to authenticated;

-- --- Photos : dossier personnel ou dossier du club ------------------------------

drop policy "player_photos_owner_select" on storage.objects;
drop policy "player_photos_owner_insert" on storage.objects;
drop policy "player_photos_owner_update" on storage.objects;
drop policy "player_photos_owner_delete" on storage.objects;

-- `clubs/<club>/…` : lecture pour les membres, écriture pour admins et entraîneurs.
create function public.photo_folder_role(p_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when (storage.foldername(p_name))[1] = (select auth.uid())::text then 'admin'
    when (storage.foldername(p_name))[1] = 'clubs'
      and (storage.foldername(p_name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.club_role(((storage.foldername(p_name))[2])::uuid)
  end;
$$;
revoke execute on function public.photo_folder_role(text) from public, anon;
grant execute on function public.photo_folder_role(text) to authenticated;

create policy "player_photos_select" on storage.objects for select to authenticated
  using (bucket_id = 'player-photos' and public.photo_folder_role(name) is not null);
create policy "player_photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'player-photos' and public.photo_folder_role(name) in ('admin', 'coach'));
create policy "player_photos_update" on storage.objects for update to authenticated
  using (bucket_id = 'player-photos' and public.photo_folder_role(name) in ('admin', 'coach'))
  with check (bucket_id = 'player-photos' and public.photo_folder_role(name) in ('admin', 'coach'));
create policy "player_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'player-photos' and public.photo_folder_role(name) in ('admin', 'coach'));
