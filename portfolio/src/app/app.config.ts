import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { ArtworkStore } from './core/artwork.store';
import { CollectionStore } from './core/collection.store';
import { TaxonomyStore } from './core/taxonomy.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(async () => {
      // Demande au navigateur de ne pas purger les données locales (IndexedDB).
      navigator.storage?.persist?.().catch(() => undefined);
      const taxonomies = inject(TaxonomyStore);
      const artworks = inject(ArtworkStore);
      const collections = inject(CollectionStore);
      await Promise.all([taxonomies.load(), artworks.load(), collections.load()]);
    }),
  ],
};
