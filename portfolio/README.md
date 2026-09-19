# Atelier — portfolio d'artiste

Application web (PWA) pour gérer un portfolio d'œuvres : import ou prise de photos, classement par mots-clés multi-taxonomies (technique, sujet, thème, support…), filtrage de la galerie, et collections pour préparer des expositions.

## Fonctionnalités

- **Galerie** : grille d'œuvres, recherche plein texte, tri (récentes / titre / année).
- **Import** : sélection multiple d'images ou prise de photo directe (mobile, `capture="environment"`). Les images sont redimensionnées (2048 px max) et une vignette est générée côté client ; l'orientation EXIF est respectée.
- **Taxonomies de mots-clés** : chaque taxonomie est un axe indépendant. Quatre sont fournies au premier lancement (Technique, Sujet, Thème, Support) ; on peut en créer d'autres (Format, Série, Statut…) et créer des mots-clés à la volée depuis la fiche d'une œuvre.
- **Filtres facettés** : OU entre mots-clés d'une même taxonomie, ET entre taxonomies. Filtre par collection aussi.
- **Sélection multiple** dans la galerie : ajout à une collection, ajout de mots-clés en masse, suppression.
- **Collections** : une œuvre peut appartenir à plusieurs collections. Ordre libre par glisser-déposer (grille ou liste), vue liste imprimable pour un dossier d'expo.
- **Sauvegarde** : export / import JSON complet (images incluses en base64) pour transférer le portfolio sur un autre appareil.
- **Hors-ligne** : PWA installable, données stockées localement (IndexedDB).

## Stack

- Angular 22 (standalone, signals, zoneless), Angular CDK (drag & drop), `@angular/pwa`
- Dexie 4 (IndexedDB) — aucune dépendance serveur
- SCSS maison, pas de librairie de composants

## Lancer

```bash
npm install
npm start          # http://localhost:4200
npm run build      # dist/portfolio/browser
```

Node ≥ 22.22.3 ou ≥ 24.15 (exigence Angular 22).

## Déploiement GitHub Pages (POC)

Le workflow `.github/workflows/deploy-pages.yml` builde et publie automatiquement sur `https://<owner>.github.io/<repo>/` à chaque push sur `master` touchant `portfolio/` (ou manuellement via *Run workflow*).

Prérequis, une seule fois : **Settings → Pages → Source : GitHub Actions**.

Détails techniques :
- `npm run build:pages` lit `PAGES_BASE_HREF` (ex. `/test/`) pour le `<base href>`, copie `index.html` en `404.html` (fallback SPA pour les URL profondes) et ajoute `.nojekyll`.
- Le service worker et le manifest sont générés avec le bon préfixe, l'app est installable sur l'écran d'accueil du téléphone (HTTPS fourni par Pages).
- Les données restent dans le navigateur de l'appareil : Pages ne sert que des fichiers statiques.

## Architecture

```
src/app/
  core/
    models.ts            Taxonomy, Tag, Artwork, ArtworkImage, Collection
    db.ts                Schéma Dexie (5 tables, image pleine résolution séparée)
    *.store.ts           Stores signaux (état en mémoire + persistance Dexie)
    image.service.ts     Redimensionnement / vignettes (OffscreenCanvas)
    backup.service.ts    Export / import JSON
  shared/                TagChips (multi-sélection + création), TagList (lecture seule)
  features/
    gallery/             Galerie, filtres, import, sélection multiple
    artwork/             Fiche œuvre (édition, tags, collections)
    collections/         Liste + détail (ordre, ajout, impression)
    settings/            Taxonomies, mots-clés, sauvegarde
```

Les stores sont la seule couche qui touche Dexie : pour brancher un backend (API .NET + SQL Server, stockage blob) il suffit de les réimplémenter, les composants ne changent pas.

## Modèle de données

- `Taxonomy 1—n Tag`
- `Artwork n—n Tag` (tableau `tagIds` sur l'œuvre)
- `Collection n—n Artwork` (tableau ordonné `artworkIds` sur la collection)

Le "thème" est modélisé comme une taxonomie ordinaire : même mécanique de saisie et de filtrage que technique ou sujet, extensible sans code.
