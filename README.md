# Tableau Tactique

SaaS web de tableau tactique pour entraîneurs (nom de code provisoire).

## Démarrer

```bash
npm install
cp .env.example .env.local   # renseigner l'URL et la clé publiable Supabase
npm run dev
```

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | types de routes + TypeScript |
| `npm test` | tests unitaires (Vitest) |
| `npm run build:e2e && npm run e2e` | parcours Playwright, contre un faux Supabase local |

Documentation : [architecture](docs/ARCHITECTURE.md), [système de design](docs/DESIGN_SYSTEM.md),
[format de scène](docs/SCENE_FORMAT.md).
