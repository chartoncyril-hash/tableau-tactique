# Format de scène

Une scène décrit un tableau. Elle est sérialisable en JSON tel quel (colonne `boards.scene` à
partir de la phase 3 ; brouillon local `localStorage["tt:scene:v1"]` en attendant).
Types de référence : `src/editor/scene/types.ts`.

## Version

`version: 1`. Toute évolution incompatible incrémente ce numéro et ajoute une étape dans
`migrateScene` (`src/editor/scene/defaults.ts`). Une scène de version inconnue est refusée.

## Repère

- Unité : le mètre. Origine en haut à gauche du terrain.
- Horizontal : x suit la longueur (0 → 105), y la largeur (0 → 68).
- Vertical : le terrain est tourné, x suit la largeur et y la longueur ; l'attaque monte.
  Le changement d'orientation convertit toutes les coordonnées des objets.
- Les rotations sont en degrés, sens horaire.

## Structure

```jsonc
{
  "version": 1,
  "pitch": {
    "sport": "football",            // clé d'un fichier de src/editor/pitches
    "view": "full",                 // full | half | third | box | blank
    "orientation": "horizontal",    // horizontal | vertical
    "mow": "stripes",               // plain | stripes | checker
    "grass": "#2f8f57",
    "lines": "#f5faf6"
  },
  "teams": [{ "id": "team-a", "name": "Équipe A", "color": "#1d4ed8" }], // 1 à 4
  "objects": []                     // ordre = empilement, le dernier est au-dessus
}
```

## Objets

Champs communs : `id`, `type`, `x`, `y`, `rotation`, et en option `locked`, `groupId`.

| `type` | Champs propres |
| --- | --- |
| `player` | `teamId`, `number`, `name`, `role`, `look` (`disc` \| `jersey`), `goalkeeper` |
| `ball` | `style` facultatif (`classic`, `blue`, `red`, `yellow`, `futsal`, `rugby`, `volley`, `tennis`, `medicine`) |
| `equipment` | `kind` (20 types, liste dans `EQUIPMENT_KINDS`), `color`, `scale` |
| `zone` | `shape` (`rect` \| `ellipse` \| `polygon`), `width`, `height`, `points`, `fill`, `opacity` |
| `text` | `text`, `size`, `color`, `label` (fond d'étiquette) |
| `line` | `kind` (`pass`, `run`, `dribble`, `shot`, `free`), `points` `[x0,y0,cx,cy,x1,y1]`, `curved`, `dashed`, `wavy`, `arrowStart`, `arrowEnd`, `width`, `color` |
| `freehand` | `points`, `width`, `color` |

- Rectangle et ellipse sont centrés sur (`x`, `y`).
- Les `points` (polygone, ligne, main levée) sont relatifs à (`x`, `y`).
- Pour une ligne, (`cx`, `cy`) est le point de contrôle d'une Bézier quadratique, ignoré si
  `curved` vaut `false`.

## Ajouter un sport

Créer `src/editor/pitches/<sport>.ts` (dimensions, tracés, cadrages, toujours décrits à
l'horizontale) et l'enregistrer dans `src/editor/pitches/index.ts`. Le moteur ne change pas.

## Banque d'objets

`src/editor/scene/catalog.ts` décrit chaque objet par des primitives vectorielles (cercle,
ellipse, rectangle, ligne) en mètres. La même description alimente le canevas et les vignettes
du sélecteur. Ajouter un objet : un `kind` dans `EQUIPMENT_KINDS`, sa taille, son dessin, une
entrée de catalogue et son nom dans `src/messages`.
