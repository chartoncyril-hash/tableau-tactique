# Journal des modifications

## Phase 8 — Vue 3D

- Bouton « Vue 3D » dans l'éditeur : le tableau affiché en relief (joueurs aux couleurs et motifs
  du maillot, numéros, noms, brassard, gardien ; ballons ; plots, piquets, haies, mannequins,
  murs, buts avec filet, rebondisseur, banc, caisson, bosu). Zones, tracés et textes restent au sol.
- Quatre points de vue (tribune, dessus, derrière le but, coin) avec transition douce ; rotation
  et zoom libres à la souris ou au doigt.
- L'animation se lit en 3D, synchronisée avec la frise (ballon en cloche compris).
- Lecture seule : Échap ou le même bouton ramène à la 2D. Message clair si l'appareil n'a pas WebGL.
- three.js n'est téléchargé qu'à la première ouverture de la vue 3D.
- Personnages en 3D (par défaut) ou pions : footballeurs stylisés aux couleurs du maillot, grand
  numéro dans le dos, cheveux à l'arrière du crâne ; bras et jambes en foulée pendant la lecture.
- Orientation des joueurs, en 2D comme en 3D : deux bras et une pointe montrent l'avant du jeton,
  numéro et nom restent droits. Panneau : quart de tour, demi-tour, « face au but adverse » ;
  option pour masquer ces repères. Les joueurs regardent le but adverse dès leur placement, et
  les tableaux existants sont convertis automatiquement.

## Phase 7 — Exports

- Bouton « Exporter » dans l'éditeur : image PNG (1600 ou 3200 px), image vectorielle SVG,
  animation GIF en boucle, vidéo MP4 (1280 ou 1920 px, 30 images/s).
- Cadrage au choix : terrain affiché, ou zone réellement utilisée par l'exercice.
- Une image d'étape porte les flèches des déplacements de l'étape, comme dans la fiche PDF.
- Le SVG est un vrai dessin vectoriel (terrain, joueurs, matériel, tracés, zones, textes, photos
  intégrées) : il s'ouvre dans Illustrator, Inkscape ou PowerPoint et reste net à toute taille.
- Tout est calculé dans le navigateur, avec barre de progression et annulation pour les animations.
  Si le navigateur n'encode pas le H.264, la vidéo est produite en WebM.

## Phase 5 — Effectifs

- Onglet « Effectifs » : équipes (nom, club, catégorie) avec maillot configurable (couleurs, motif).
- Joueurs : numéro, prénom, nom, poste, pied fort, notes, photo ronde ; modification en place,
  ajout, suppression.
- Photos recadrées et réduites dans le navigateur, rangées dans un espace privé par utilisateur.
- Import et export CSV (point-virgule ou virgule, en-têtes français ou anglais).
- Éditeur : « Composer en 4-4-2 » (ou toute formation) depuis un effectif, poste par poste, avec
  noms, numéros, photos et maillot ; choix du joueur de l'effectif pour un jeton sélectionné.
- Photos visibles sur le terrain et dans les schémas du PDF ; jamais sur les liens publics.

## Fiche de séance dans l'application

- Nouvelle page « Fiche de séance » : la fiche se présente comme le PDF (en-tête, principes de jeu,
  matériel, légende, effectif, un bloc par exercice avec ses schémas) et chaque case se modifie en place.
- Exercices ajoutés, renommés, réordonnés ou supprimés depuis la fiche ; « Modifier le schéma » ouvre
  l'éditeur directement sur le bon tableau (`?board=`).
- Téléchargement du PDF et lien de partage depuis la fiche ; le bouton « Fiche de séance » de l'éditeur
  y mène (la fenêtre de saisie disparaît).
- Correctif : la connexion pouvait échouer sur un téléphone lent (formulaire remplacé pendant la saisie,
  et redirection annulée par un rafraîchissement).

## Séances : fiche PDF et lien de partage

- Fiche de séance par projet (date, numéro, thème, catégorie, club, entraîneur, principes de jeu,
  couleur de la fiche) et fiche d'exercice par tableau (procédé, objectif, but, consignes, durée,
  joueurs, espace, variables, méthode pédagogique, comportements recherchés).
- Export PDF A4 sur le modèle de fiche des éducateurs : en-tête, matériel et effectif déduits des
  tableaux, légende des tracés, deux exercices par page, schémas par étape d'animation recadrés
  sur la zone de jeu.
- Lien public en lecture seule : fiche et animations lisibles sans compte, PDF téléchargeable ;
  le PDF porte le lien et son QR code quand un lien est actif. Lien désactivable à tout moment.
- Correctif : un nouveau tableau n'hérite plus des étapes d'animation du tableau affiché.

## Phase 4 — Animation

- Étapes d'animation (images clés) par tableau : on ajoute une étape, on déplace les objets, c'est enregistré.
- Lecture, pause, arrêt, boucle, vitesse de 0,5× à 2×, curseur de position.
- Trajectoires affichées en pointillés, courbables par une poignée.
- Par déplacement : départ différé, durée, allure (accélération, ralentissement).
- Ballon : cloche avec hauteur réglable, ou conduit par un joueur.
- Durée réglable par étape ; les étapes s'annulent et se rétablissent comme le reste.

## Phase 3 — Persistance

- Projets enregistrés en ligne, repris sur n'importe quel appareil.
- Plusieurs tableaux par projet : ajout, renommage, duplication, suppression, copier-coller entre tableaux.
- Sauvegarde automatique différée, tableau par tableau, avec indicateur d'état et nouvel essai en cas d'échec.
- Versions restaurables : une à l'ouverture, puis toutes les 5 minutes de travail (50 par tableau).
- Notes et lien vidéo YouTube ou Vimeo par tableau.
- Tableau de bord : dossiers, étiquettes, favoris, modèles, recherche (nom, étiquettes, notes).
- Corbeille avec restauration, purge automatique à 30 jours, confirmation renforcée pour supprimer un dossier.
- Le formulaire de connexion n'est plus envoyable avant que la page soit active.

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
