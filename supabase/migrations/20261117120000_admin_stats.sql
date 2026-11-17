-- Tableau de bord du propriétaire de l'application : statistiques d'usage, réservées aux
-- administrateurs de l'application (table app_admins, remplie à la main, jamais depuis l'appli).

create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.app_admins is 'Administrateurs de l''application (tableau de bord d''usage). Remplie à la main.';

alter table public.app_admins enable row level security;

-- Chacun peut seulement savoir s'il est lui-même administrateur ; aucune écriture depuis l'API.
create policy "app_admins_select_self" on public.app_admins
  for select to authenticated using (user_id = (select auth.uid()));

create function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

-- Statistiques agrégées et liste des comptes récents ; refuse tout appelant non administrateur.
create function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_app_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users', (
      select jsonb_build_object(
        'total', count(*),
        'confirmed', count(*) filter (where email_confirmed_at is not null),
        'new7', count(*) filter (where created_at > now() - interval '7 days'),
        'new30', count(*) filter (where created_at > now() - interval '30 days'),
        'active7', count(*) filter (where last_sign_in_at > now() - interval '7 days'),
        'active30', count(*) filter (where last_sign_in_at > now() - interval '30 days')
      ) from auth.users
    ),
    'content', jsonb_build_object(
      'projects', (select count(*) from public.projects where deleted_at is null),
      'boards', (select count(*) from public.boards where deleted_at is null),
      'clubs', (select count(*) from public.clubs),
      'teams', (select count(*) from public.teams where deleted_at is null),
      'players', (select count(*) from public.players),
      'drills', (select count(*) from public.drills where deleted_at is null),
      'shares', (select count(*) from public.shares where revoked_at is null),
      'comments', (select count(*) from public.board_comments)
    ),
    'signups', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'count', d.n) order by d.day), '[]'::jsonb)
      from (
        select g.day::date as day, (select count(*) from auth.users u where u.created_at::date = g.day::date) as n
        from generate_series(current_date - 29, current_date, interval '1 day') as g(day)
      ) d
    ),
    'projectsPerDay', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'count', d.n) order by d.day), '[]'::jsonb)
      from (
        select g.day::date as day, (select count(*) from public.projects p where p.created_at::date = g.day::date) as n
        from generate_series(current_date - 29, current_date, interval '1 day') as g(day)
      ) d
    ),
    'recent', (
      select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb)
      from (
        select
          u.email,
          u.created_at,
          u.last_sign_in_at,
          u.email_confirmed_at is not null as confirmed,
          (select count(*) from public.projects p where p.owner_id = u.id and p.deleted_at is null) as projects,
          (select count(*) from public.club_members m where m.user_id = u.id) as clubs
        from auth.users u
        order by u.created_at desc
        limit 50
      ) r
    )
  ) into result;
  return result;
end;
$$;

revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
