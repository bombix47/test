import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/gallery/gallery').then((m) => m.Gallery), title: 'Galerie' },
  { path: 'oeuvre/:id', loadComponent: () => import('./features/artwork/artwork-detail').then((m) => m.ArtworkDetail), title: 'Œuvre' },
  { path: 'collections', loadComponent: () => import('./features/collections/collections').then((m) => m.Collections), title: 'Collections' },
  { path: 'collections/:id', loadComponent: () => import('./features/collections/collection-detail').then((m) => m.CollectionDetail), title: 'Collection' },
  { path: 'reglages', loadComponent: () => import('./features/settings/settings').then((m) => m.Settings), title: 'Réglages' },
  { path: '**', redirectTo: '' },
];
