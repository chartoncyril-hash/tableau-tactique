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
  "teams": [{ "id": "team-a", "name": "Équipe A", "color": "#1d4ed8" }], // 1 à 4 ; `pattern` (plain | stripes | hoops | halves), `color2` et `rosterTeamId` facultatifs
  "objects": []                     // ordre = empilement, le dernier est au-dessus
}
```

## Objets

Champs communs : `id`, `type`, `x`, `y`, `rotation`, et en option `locked`, `groupId`.

| `type` | Champs propres |
| --- | --- |
| `player` | `teamId`, `number`, `name`, `role`, `look` (`disc` \| `jersey`), `goalkeeper`, et en option `captain`, `photo` (chemin de la photo), `rosterId` (joueur de l'effectif) |
| `ball` | `style` facultatif (`classic`, `blue`, `red`, `yellow`, `futsal`, `rugby`, `volley`, `tennis`, `medicine`) |
| `equipment` | `kind` (20 types, liste dans `EQUIPMENT_KINDS`), `color`, `scale` |
| `zone` | `shape` (`rect` \| `ellipse` \| `polygon`), `width`, `height`, `points`, `fill`, `opacity`, `pattern` facultatif (`solid` \| `hatch`) |
| `text` | `text`, `size`, `color`, `label` (fond d'étiquette) |
| `line` | `kind` (`pass`, `run`, `dribble`, `shot`, `block`, `free`), `points` `[x0,y0,cx,cy,x1,y1]`, `curved`, `dashed`, `wavy`, `arrowStart`, `arrowEnd`, `double` et `barEnd` facultatifs, `width`, `color` |
| `freehand` | `points`, `width`, `color` |

- Rectangle et ellipse sont centrés sur (`x`, `y`).
- Les `points` (polygone, ligne, main levée) sont relatifs à (`x`, `y`).
- Pour une ligne, (`cx`, `cy`) est le point de contrôle d'une Bézier quadratique, ignoré si
  `curved` vaut `false`.

## Ajouter un sport

Créer `src/editor/pitches/<sport>.ts` (dimensions, tracés, cadrages, toujours décrits à
l'horizontale) et l'enregistrer dans `src/editor/pitches/index.ts`. Le moteur ne change pas.

## Animation

`frames` (facultatif) liste les étapes. Les positions de `objects` sont celles du départ ;
chaque étape ne décrit que les objets qui bougent.

```jsonc
"frames": [
  {
    "id": "f1",
    "duration": 2,                 // secondes
    "moves": {
      "<id objet>": {
        "x": 40, "y": 30, "rotation": 0,   // pose à la fin de l'étape
        "cx": 30, "cy": 20,                // facultatif : point de contrôle d'une courbe
        "delay": 0.2,                      // facultatif : départ différé, fraction de l'étape
        "span": 0.5,                       // facultatif : part de l'étape occupée par le déplacement
        "ease": "inOut",                   // inOut | linear | in | out
        "arc": 8,                          // ballon : hauteur de la cloche, en mètres
        "attach": "<id joueur>"            // ballon : conduit par ce joueur pendant l'étape
      }
    }
  }
]
```

La pose d'un objet à l'étape n est sa pose de départ à laquelle s'ajoutent, dans l'ordre, ses
déplacements des étapes 1 à n (`src/editor/scene/animation.ts`). Supprimer un objet supprime
ses déplacements.

## Banque d'objets

`src/editor/scene/catalog.ts` décrit chaque objet par des primitives vectorielles (cercle,
ellipse, rectangle, ligne) en mètres. La même description alimente le canevas et les vignettes
du sélecteur. Ajouter un objet : un `kind` dans `EQUIPMENT_KINDS`, sa taille, son dessin, une
entrée de catalogue et son nom dans `src/messages`.
