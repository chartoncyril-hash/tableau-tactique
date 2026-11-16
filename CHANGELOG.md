# Journal des modifications

## Phase 2 — Éditeur 2D

- Éditeur accessible sans compte sur `/editor`, utilisable à la souris, au doigt et au stylet.
- Terrain de football paramétrable : cadrages, orientation, tonte, couleurs ; un sport = un fichier.
- Objets : joueurs (pastille ou maillot), gardiens, zones, texte et étiquettes.
- Banque d'objets à vignettes : 9 ballons et 20 types de matériel en plusieurs couleurs (45 entrées).
- Tracés : passe, course, conduite, tir, ligne libre, courbes, flèches, main levée lissée.
- Jusqu'à 4 équipes, 8 formations applicables en un clic ; jetons unis, rayés, cerclés ou mi-partis ; brassard de capitaine.
- Zones pleines ou hachurées ; tracés à double trait (tir) et à extrémité en T (blocage) ; trois épaisseurs ; gomme.
- Sélection multiple, groupes, alignement, répartition, guides magnétiques, verrouillage, ordre
  d'empilement, copier-coller, raccourcis clavier, zoom et panoramique.
- Annuler/rétablir illimité ; brouillon enregistré sur l'appareil.
- Surcouches d'analyse : zones d'influence de Voronoï, lignes de bloc et distances.

## Phase 1 — Socle

- Projet Next.js 16, TypeScript strict, Tailwind CSS 4, composants au format shadcn/ui.
- Système de design : jetons clairs et sombres, bascule de thème.
- Interface en français et en anglais (next-intl).
- Page d'accueil.
- Authentification Supabase par e-mail : inscription, connexion, déconnexion, espace protégé.
- Table `profiles` avec RLS et création automatique à l'inscription.
- Tests Vitest et Playwright (ordinateur et mobile), CI GitHub Actions.
