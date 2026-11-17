# Footballeurs réalistes (Microsoft Rocketbox)

Les fichiers de `public/models/players/` viennent de la bibliothèque
[Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox), sous licence MIT
(copie : `public/models/players/LICENSE-Rocketbox.md`) : avatars `Sports_Male_02` (`m301`) et
`Sports_Male_03` (`m300`), animations `m_idle_neutral_01`, `m_walk_neutral_01`, `m_run_slow_01`,
`m_run_neutral_01`, `m_run_fast_01` (mouvement extrait sur xy : sur place).

Pour les refaire :

1. Récupérer ces fichiers du dépôt Rocketbox (`git sparse-checkout`), dans un dossier de travail
   avec `three`, `@gltf-transform/cli` et Python (Pillow, NumPy).
2. `node dump-mesh.mjs <avatar.fbx> out-<id>.json` : UV et os dominant de chaque sommet.
3. `python3 mask.py out-<id>.json <id>_body_color.tga <id>_mask.png <id>_body.jpg` : masque de la
   tenue (R maillot, G liserés, B short, A chaussettes), d'après les os de chaque triangle et la
   couleur (la peau reste), et texture du corps où la tenue devient un tissu uni clair. Sponsor,
   numéros et écusson d'origine disparaissent.
4. `node export.mjs` : avatars en glTF (matériaux nommés `body`, `head`, `opacity`), animations
   jointes au premier avatar (os communs).
5. `npx gltf-transform meshopt <in.glb> <out.glb>` — surtout pas `optimize` : il retire les UV
   (aucune texture dans le fichier) et aplatit le squelette des avatars sans animation.
6. Textures : couleur et normales du corps en 1024 px, de la tête en 512 px (JPEG), cheveux de
   `m300` en PNG avec transparence.
