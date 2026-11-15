# Système de design

Les jetons vivent dans `src/app/globals.css` et sont exposés à Tailwind via `@theme inline`.

## Couleurs

| Jeton | Rôle |
| --- | --- |
| `background` / `foreground` | fond et texte de page |
| `card` | surfaces surélevées |
| `muted` / `muted-foreground` | fonds discrets, texte secondaire |
| `border` / `input` / `ring` | contours, champs, focus |
| `primary` | action principale (vert terrain) |
| `secondary` | action secondaire |
| `accent` | mise en avant ponctuelle (ambre) |
| `destructive` | erreurs et actions destructrices |
| `pitch*`, `team-a`, `team-b` | couleurs du terrain et des équipes |

Chaque jeton a une valeur claire (`:root`) et sombre (`.dark`).

## Typographie

Geist Sans pour l'interface, Geist Mono pour les valeurs techniques. Titres en `font-semibold`
et `tracking-tight`.

## Dimensions

- Rayon de base `--radius` : 10 px.
- Cibles tactiles : 44 px minimum (`Button` et `Input` font 44 px de haut par défaut).
- Largeur de contenu : `max-w-6xl`, marges latérales de 16 px.

## États

- Focus visible : contour de 2 px couleur `ring`, décalé de 2 px.
- Désactivé : opacité 50 %, sans interaction.
- Les animations respectent `prefers-reduced-motion`.
