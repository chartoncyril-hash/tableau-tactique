-- Purge quotidienne de la corbeille : suppression définitive après 30 jours.
create extension if not exists pg_cron;

create function public.purge_trash()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.boards where deleted_at < now() - interval '30 days';
  delete from public.projects where deleted_at < now() - interval '30 days';
  delete from public.folders where deleted_at < now() - interval '30 days';
end;
$$;

revoke execute on function public.purge_trash() from public, anon, authenticated;

select cron.schedule('purge-trash', '17 3 * * *', $$select public.purge_trash()$$);
