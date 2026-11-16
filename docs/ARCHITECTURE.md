# Architecture

État à la fin de la phase 3 (persistance). Mis à jour à chaque phase.

## Pile technique

| Domaine | Choix |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components, Partial Prefetching), TypeScript strict |
| Interface | Tailwind CSS 4, composants au format shadcn/ui dans `src/components/ui`, icônes Lucide |
| Thèmes | `next-themes` (classe `.dark`), jetons CSS dans `src/app/globals.css` |
| i18n | `next-intl` 4, préfixe de langue obligatoire (`/fr`, `/en`), messages dans `src/messages` |
| Données et auth | Supabase (Postgres + RLS, Auth e-mail) via `@supabase/ssr` |
| Tests | Vitest (logique), Playwright (parcours, ordinateur + mobile) |
| CI / déploiement | GitHub Actions, Vercel (préversion par PR) |

## Arborescence

```
src/
  app/[locale]/        pages localisées (accueil, login, signup, app)
  app/auth/callback/   échange du code Supabase contre une session
  components/          composants d'interface ; ui/ = primitives
  config/site.ts       nom du produit (provisoire)
  i18n/                routage et chargement des messages
  lib/supabase/        clients navigateur et serveur
  lib/data/            accès aux projets, tableaux, dossiers et versions
  components/dashboard tableau de bord des projets
  proxy.ts             langue + rafraîchissement de session + garde /app
supabase/migrations/   schéma versionné
e2e/                   parcours Playwright
```

## Éditeur 2D (`src/editor`)

```
scene/      format de scène, géométrie pure, formations (testés avec Vitest)
pitches/    un fichier de définition par sport + registre
store.ts    état Zustand ; toute modification passe par `commit`
canvas/     rendu Konva : terrain, analyse, objets, sélection (4 calques)
ui/         barre d'outils, barre du haut, panneau de propriétés
```

- **Historique** : chaque commande enregistre la scène avant et après. Immer partage la
  structure entre les deux, donc l'historique est illimité sans copie complète. Les gestes
  continus (poignées, curseurs de couleur) sont fusionnés en une seule commande.
- **Performance** : pendant un glisser, les nœuds Konva sont déplacés directement, React n'est
  sollicité qu'au relâchement. Chaque objet est un composant mémoïsé. Le calque du terrain
  n'écoute aucun événement.
- **Chargement** : Konva est importé dynamiquement, hors rendu serveur (`editor-loader.tsx`).

## Règles propres à Next.js 16

- `middleware.ts` s'appelle désormais `proxy.ts`.
- Avec Cache Components, toute lecture de `cookies()` ou de `searchParams` doit se faire dans un
  composant placé sous `<Suspense>` ; le reste de la page est prérendu.
- Avant de coder une API Next.js, lire le guide dans `node_modules/next/dist/docs/`.

## Authentification

1. Les formulaires (`AuthForm`) appellent Supabase depuis le navigateur.
2. `proxy.ts` rafraîchit la session à chaque requête et redirige `/{langue}/app` vers la connexion
   s'il n'y a pas d'utilisateur (contrôle optimiste).
3. La page `/app` revérifie l'utilisateur côté serveur ; la RLS reste la barrière d'autorité.
4. Le lien de confirmation par e-mail et OAuth reviennent sur `/auth/callback`, qui n'accepte que
   des cibles internes (`safeNextPath`).

Google est câblé mais masqué tant que `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` ne vaut pas `1`.

## Données

| Table | Rôle |
| --- | --- |
| `profiles` | une ligne par utilisateur, créée par déclencheur à l'inscription |
| `folders` | dossiers de projets |
| `projects` | projet : nom, dossier, étiquettes, favori, modèle |
| `boards` | tableau d'un projet : scène JSONB, notes, lien vidéo, position |
| `board_versions` | instantanés restaurables d'un tableau (50 au plus) |

- **RLS** : chaque table n'est lisible et modifiable que par son propriétaire (`owner_id`).
  Un tableau ne peut être rattaché qu'à un projet du même propriétaire. Le partage par
  organisation arrivera en phase 9.
- **Corbeille** : suppression logique par `deleted_at`. `purge_trash()` efface chaque nuit
  (pg_cron, 03:17 UTC) ce qui a plus de 30 jours.
- **Fonctions** : `create_project`, `duplicate_project`, `search_projects`, exécutées avec les
  droits de l'appelant, donc soumises à la RLS.
- **Accès** : `src/lib/data/api.ts`, depuis le navigateur avec la clé publiable.

## Sauvegarde d'un projet (`src/editor/project-session.ts`)

- Chaque modification marque le tableau affiché comme « à enregistrer » ; l'écriture part
  1,2 s après la dernière modification et ne touche que les tableaux modifiés.
- En cas d'échec, l'état passe à « erreur » et un nouvel essai part 5 s plus tard.
- L'onglet qui passe en arrière-plan ou se ferme déclenche un enregistrement immédiat.
- Une version est prise avant la première écriture de la session, puis toutes les 5 minutes.
- Limite connue : deux appareils ouverts sur le même tableau s'écrasent l'un l'autre
  (dernier enregistré gagne) jusqu'à l'édition simultanée de la phase 9.

## Tests de bout en bout

Les parcours Playwright tournent contre `e2e/fake-supabase.mjs`, un faux Supabase en mémoire
(authentification par mot de passe et sous-ensemble de PostgREST, données cloisonnées par
utilisateur). Construire avec `npm run build:e2e` avant `npm run e2e`. La RLS réelle se vérifie
à part, en SQL, sur le projet Supabase.

## Variables d'environnement

Voir `.env.example`. Aucune clé secrète n'est nécessaire en phase 1 ; les valeurs sont définies
dans Vercel.
