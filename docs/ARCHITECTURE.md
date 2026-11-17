# Architecture

État à la fin de la phase 4 (animation). Mis à jour à chaque phase.

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
  components/roster    effectifs : équipes, joueurs, maillots
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
- **Animation** : l'étape affichée (`currentStep`) sert de filtre d'édition. Une modification
  voit les objets à leur position dans cette étape ; tout changement de position est rangé
  dans l'étape, jamais dans les positions de départ (`produceAtStep`). La lecture
  (`animation/playback.ts`) pousse les poses directement dans les nœuds Konva à chaque image.
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
| `shares` | liens publics en lecture seule vers un projet |
| `teams` | équipes de l'effectif : nom, club, catégorie, maillot (`kit`) |
| `players` | joueurs d'une équipe : numéro, noms, poste, pied fort, notes, photo |

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

## Fiche de séance et partage

- Une séance est un projet : l'en-tête est dans `projects.sheet`, chaque exercice est un tableau
  avec sa fiche dans `boards.sheet` (`src/lib/sheet.ts`, lecture tolérante).
- PDF généré dans le navigateur (`src/editor/export-pdf.ts`) : schémas rendus hors écran avec
  Konva (`snapshot.tsx`), mise en page jsPDF (`src/lib/pdf/session-pdf.ts`) avec la police Geist
  embarquée, QR code par `qrcode`. Ces bibliothèques ne sont chargées qu'au moment de l'export.
- Lien public : table `shares` (jeton aléatoire de 122 bits, désactivation par `revoked_at`),
  lecture par `get_shared_project(token)`, seule fonction accessible sans compte. Elle ne
  renvoie que la fiche et les tableaux non supprimés d'un projet dont le lien est actif.
- Page publique `/[locale]/s/[token]` : non indexée, sans en-tête Referer, lecteur d'animation
  autonome (`components/share/board-player.tsx`).

- Page `/[locale]/app/project/sheet?id=` (`src/editor/sheet/`) : même session de projet que
  l'éditeur, donc même sauvegarde différée ; les schémas sont rendus en file, mis en cache par
  scène, et recalculés quand un tableau change.
- Next garde la page précédente en mémoire (masquée) quand on navigue : une page ouvre son
  projet dans un effet et le referme au démontage, jamais au rendu.

## Effectifs et photos

- `src/lib/roster.ts` : modèle, tri, affectation des joueurs aux places d'une formation, CSV.
- Photos dans l'espace de stockage privé `player-photos`, dossier `<uid>/` ; RLS sur
  `storage.objects` et contrôle du chemin dans `players`. Affichage par adresses signées (1 h),
  chargées par lots et partagées (`src/lib/photos.ts`).
- Un jeton garde le chemin de la photo (`photo`) et le joueur représenté (`rosterId`) ; sans
  droit de lecture (lien public), la photo est simplement absente et le jeton reste une pastille.

## Exports (`src/editor/export`)

- `frame.ts` (sans DOM) : objets à une étape, flèches d'une étape, noms de fichiers.
- `svg.ts` (sans DOM, testé) : rendu vectoriel complet d'une scène, calqué sur `object-node.tsx`
  et `pitch-layer.tsx`. **Toute évolution du rendu d'un objet sur le canevas doit être reportée ici.**
- `media.ts` : PNG via la scène Konva hors écran (`mountStage` dans `snapshot.tsx`, partagée avec le
  PDF) ; GIF et vidéo en appliquant `posesAt` aux nœuds Konva image par image, comme la lecture.
  GIF : `gifenc`, une palette calculée sur la première image, 12,5 images/s. Vidéo : `mediabunny`
  (WebCodecs), H.264/MP4 si possible, sinon VP9/WebM. Les deux bibliothèques sont chargées à la demande.
- Une pause de 0,6 s ouvre l'animation exportée et une de 1,2 s la termine.

## Vue 3D (`src/editor/three`)

- React Three Fiber + three.js (sans drei : `OrbitControls` vient de `three/examples`), chargés
  par `next/dynamic` à la première ouverture. Rendu à la demande (`frameloop="demand"`).
- `layout.ts` (sans three, testé) : repère (centre du cadrage à l'origine, `(x, y)` → `(x, 0, y)`),
  rotation, points de vue de caméra.
- `textures.ts` : la pelouse réutilise l'export SVG (`pitchSvg` + zones, tracés, textes) rastérisé ;
  étiquettes, tissus des maillots et vignettes du matériel plat sont dessinés sur des canevas.
- `models.tsx` : modèles simples ; joueurs ×1,8 et petit matériel ×1,6 pour rester lisibles, buts à
  taille réelle.
- La lecture diffuse les poses à tous les abonnés (`playbackTarget.listen`) : le canevas 2D, qui
  reste monté sous la vue 3D, et la vue 3D elle-même.
- `stadium.tsx` : stade procédural (tribunes fusionnées, public en `InstancedMesh`, panneaux et
  bandeaux dessinés sur canevas avec le logo), buts en relief d'après les tracés du terrain. Une
  tribune se masque quand la caméra passe derrière elle. Décor au choix (`useView3d.decor`).
- `real-player.tsx` : footballeurs réalistes (Rocketbox, MIT), glTF compressés (meshopt) dans
  `public/models/players`, chargés à la demande ; un clone par joueur (`SkeletonUtils`), un
  `AnimationMixer` piloté par la foulée (`strides`), tenue teintée dans le shader d'après un masque.
  Chaîne de conversion : `tools/rocketbox`.
- `ballAtFeet` (`layout.ts`) rapproche un ballon collé à un joueur ; `Traces3D` reprend
  `stepTraces` et `movePath3d` (`scene/animation.ts`), partagés avec le canevas 2D.
- `View3dStage` sert dans l'éditeur et la présentation (`interactive` à faux) ; une seule vue 3D à
  la fois (`useView3d.presenting`).
- Logos : `clubs.logo_path` et `profiles.logo_path` (contrainte : le chemin reste dans le dossier
  de l'espace), fichiers dans le bucket `player-photos` ; `src/lib/brand.ts` les charge et les signe.
- E2E : Chromium est lancé avec SwiftShader (`playwright.config.ts`) pour disposer de WebGL en CI.

## Formats de jeu

- `src/editor/pitches/football-small.ts` : foot à 8 et à 5 ; `formats.ts` : catégories et format
  par défaut. `scene/format.ts` (`rescaleToPitch`) met positions, tracés et déplacements à l'échelle
  du nouveau terrain ; `formationsFor(sport)` donne les systèmes du format.

## Espaces club (phase 9a)

- Tables `clubs`, `club_members` (rôle `admin` | `coach` | `viewer`), `club_invites` (jeton
  à usage unique, 14 jours). `folders`, `projects`, `teams` ont un `club_id` (nul = personnel).
- RLS : `can_read(club_id, owner_id)` / `can_edit(...)` s'appuient sur `club_role(club)`
  (SECURITY DEFINER, renvoie le seul rôle de l'appelant). Tableaux, versions et liens publics
  suivent leur projet ; joueurs suivent leur équipe. Déclencheurs : `keep_owner` (créateur figé),
  `keep_one_admin`, `check_player_photo` (dossier de l'espace, vérifié quand le chemin change).
- Fonctions : `create_club`, `get_invite` (aussi sans compte), `accept_invite`,
  `club_members_list` ; `create_project`, `duplicate_project` et `search_projects` prennent `p_club`.
- Client : `src/lib/workspace.ts` (espace courant mémorisé dans le navigateur, mes clubs et rôles),
  `src/lib/data/clubs-api.ts`. Lecture seule : `useEditor.readOnly` bloque `commit`, `live` et
  `replaceScene` ; les fonctions d'écriture de `project-session` ne font rien.
- Limite connue : supprimer un compte supprime aussi les contenus de club qu'il a créés
  (clé `owner_id` en cascade). À traiter avant d'ouvrir les clubs à grande échelle.

## Édition à plusieurs et commentaires (phase 9b)

- `src/editor/collab/patch.ts` (testé) : différence objet par objet entre deux scènes, application
  et fusion. `useEditor.applyRemote(patch)` applique un changement reçu à la scène **et** à tout
  l'historique : Ctrl+Z ne défait que ses propres actions.
- `collab/session.ts` : canal Supabase Realtime privé `project:<id>` ; présence (qui, quel tableau),
  événements `patch`, `cursor`, `hello`/`full` (rattrapage d'un arrivant), `boards`, `comments`.
  Un changement reçu n'est pas réenregistré par le receveur (`applyingRemote`), son auteur s'en charge.
- Politiques sur `realtime.messages` : lecture si le projet est lisible ; écriture de présence,
  pointeur et commentaires pour les lecteurs, des autres événements pour qui peut modifier.
- `board_comments` : fil = commentaire sans `parent_id` (épingle `x`/`y` facultative), réponses.
  Déclencheur `board_comments_guard` : nom de l'auteur figé, seul l'auteur réécrit son texte.
- E2E : le faux Supabase implémente le sous-ensemble du protocole Phoenix utilisé par realtime-js
  (WebSocket, poussées binaires, présence) avec les mêmes règles d'accès.

## Bibliothèque et présentation (phase 9c)

- Table `drills` (titre, catégorie, étiquettes, scène, consignes, notes), personnelle ou de club,
  mêmes règles que les projets (`can_read` / `can_edit`, créateur figé, corbeille de 30 jours).
- `src/lib/data/drills-api.ts`, page `app/library`, fenêtre `editor/ui/library-dialog.tsx` ;
  un exercice inséré devient un tableau via `addBoardFromDrill`.
- `editor/present/presenter.tsx` : plein écran, réutilise le lecteur de la page publique
  (`BoardPlayer`, options `keyboard` et `overlay`) ; dessin sur un canevas HTML, jamais enregistré.

## Tests de bout en bout

Les parcours Playwright tournent contre `e2e/fake-supabase.mjs`, un faux Supabase en mémoire
(authentification par mot de passe et sous-ensemble de PostgREST, données cloisonnées par
utilisateur). Construire avec `npm run build:e2e` avant `npm run e2e`. La RLS réelle se vérifie
à part, en SQL, sur le projet Supabase.

## Variables d'environnement

Voir `.env.example`. Aucune clé secrète n'est nécessaire en phase 1 ; les valeurs sont définies
dans Vercel.
