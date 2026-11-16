-- Correctif : la vérification du fil parent d'une réponse interrogeait board_comments depuis sa
-- propre politique (récursion infinie). Elle passe par une fonction qui lit la table sans RLS et
-- ne renvoie qu'un booléen.

create function public.comment_parent_ok(p_parent uuid, p_board uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.board_comments c
    where c.id = p_parent and c.board_id = p_board and c.parent_id is null
  );
$$;
revoke execute on function public.comment_parent_ok(uuid, uuid) from public, anon;
grant execute on function public.comment_parent_ok(uuid, uuid) to authenticated;

drop policy "board_comments_insert" on public.board_comments;
create policy "board_comments_insert" on public.board_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.boards b where b.id = board_id)
    and (parent_id is null or public.comment_parent_ok(parent_id, board_id))
  );
