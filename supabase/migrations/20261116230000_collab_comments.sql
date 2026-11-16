-- Phase 9b : édition à plusieurs en temps réel et commentaires sur les tableaux.

-- --- Canaux temps réel privés : `project:<id>` ------------------------------------
-- Lecture (présence, changements reçus) : quiconque peut lire le projet.
-- Écriture : présence, pointeur et commentaires pour les lecteurs du projet ; changements de
-- scène et de tableaux pour ceux qui peuvent le modifier.

create function public.realtime_project(p_topic text)
returns public.projects
language sql
stable
set search_path = ''
as $$
  select p.* from public.projects p
  where p_topic like 'project:%' and p.id::text = substr(p_topic, 9)
  limit 1;
$$;
revoke execute on function public.realtime_project(text) from public, anon;
grant execute on function public.realtime_project(text) to authenticated;

create policy "realtime_project_read" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and (public.realtime_project((select realtime.topic()))).id is not null
  );

create policy "realtime_project_write" on realtime.messages
  for insert to authenticated
  with check (
    (public.realtime_project((select realtime.topic()))).id is not null
    and (
      realtime.messages.extension = 'presence'
      or (realtime.messages.extension = 'broadcast' and realtime.messages.event in ('cursor', 'cursor-out', 'comments'))
      or (
        realtime.messages.extension = 'broadcast'
        and public.can_edit(
          (public.realtime_project((select realtime.topic()))).club_id,
          (public.realtime_project((select realtime.topic()))).owner_id
        )
      )
    )
  );

-- --- Commentaires --------------------------------------------------------------

create table public.board_comments (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  -- Nom affiché, figé à l'écriture (lisible même par ceux qui ne voient pas les profils).
  author_name text not null default '' check (char_length(author_name) <= 80),
  parent_id uuid references public.board_comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  -- Épingle d'un fil sur le tableau, en mètres ; absente pour un commentaire général.
  x real,
  y real,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index board_comments_board_idx on public.board_comments (board_id, created_at);
create index board_comments_parent_idx on public.board_comments (parent_id);
create index board_comments_author_idx on public.board_comments (author_id);
create index board_comments_resolved_by_idx on public.board_comments (resolved_by);

alter table public.board_comments enable row level security;

create trigger board_comments_set_updated_at before update on public.board_comments
  for each row execute function public.set_updated_at();

-- Lire : quiconque voit le tableau. Écrire : quiconque voit le tableau, en son nom.
-- Modifier, résoudre, supprimer : l'auteur, ou ceux qui peuvent modifier le projet.
create policy "board_comments_select" on public.board_comments for select to authenticated
  using (exists (select 1 from public.boards b where b.id = board_id));

create policy "board_comments_insert" on public.board_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.boards b where b.id = board_id)
    and (parent_id is null or exists (
      select 1 from public.board_comments c
      where c.id = parent_id and c.board_id = board_comments.board_id and c.parent_id is null
    ))
  );

create policy "board_comments_update" on public.board_comments for update to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.boards b join public.projects p on p.id = b.project_id
      where b.id = board_id and public.can_edit(p.club_id, p.owner_id)
    )
  )
  with check (exists (select 1 from public.boards b where b.id = board_id));

create policy "board_comments_delete" on public.board_comments for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.boards b join public.projects p on p.id = b.project_id
      where b.id = board_id and public.can_edit(p.club_id, p.owner_id)
    )
  );

-- Nom de l'auteur rempli par la base ; tableau, fil et auteur ne changent plus ensuite. Seul
-- l'auteur peut réécrire le texte ; les autres ne peuvent que résoudre ou rouvrir.
create function public.board_comments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1), '')
      into new.author_name
      from auth.users u left join public.profiles p on p.id = u.id
      where u.id = new.author_id;
    new.author_name := left(coalesce(new.author_name, ''), 80);
    new.resolved_at := null;
    new.resolved_by := null;
    return new;
  end if;
  new.board_id := old.board_id;
  new.parent_id := old.parent_id;
  new.author_id := old.author_id;
  new.author_name := old.author_name;
  if new.body is distinct from old.body and old.author_id is distinct from (select auth.uid()) then
    raise exception 'not_author' using errcode = '42501';
  end if;
  if new.resolved_at is distinct from old.resolved_at then
    new.resolved_by := case when new.resolved_at is null then null else (select auth.uid()) end;
  else
    new.resolved_by := old.resolved_by;
  end if;
  return new;
end;
$$;
revoke execute on function public.board_comments_guard() from public, anon, authenticated;

create trigger board_comments_guard before insert or update on public.board_comments
  for each row execute function public.board_comments_guard();
