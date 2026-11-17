-- Logo affiché dans le stade de la vue 3D : un par club, un par utilisateur (espace personnel).
-- Le fichier est rangé dans le dossier de photos de l'espace ; le chemin enregistré doit y rester,
-- ce qui empêche de pointer vers le fichier d'un autre espace.

alter table public.clubs
  add column logo_path text
  constraint clubs_logo_path_folder check (logo_path is null or logo_path like 'clubs/' || id::text || '/%');

alter table public.profiles
  add column logo_path text
  constraint profiles_logo_path_folder check (logo_path is null or logo_path like id::text || '/%');

comment on column public.clubs.logo_path is 'Logo du club (bucket player-photos, dossier clubs/<id>/), modifiable par les administrateurs.';
comment on column public.profiles.logo_path is 'Logo de l''espace personnel (bucket player-photos, dossier <uid>/).';
