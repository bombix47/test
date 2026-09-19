import { Injectable, inject } from '@angular/core';
import { db } from './db';
import { Artwork, Collection, Tag, Taxonomy } from './models';
import { ArtworkStore } from './artwork.store';
import { CollectionStore } from './collection.store';
import { TaxonomyStore } from './taxonomy.store';

interface BackupArtwork extends Omit<Artwork, 'thumb'> {
  thumb: string;
  image: string;
}

interface Backup {
  app: 'portfolio-artiste';
  version: 1;
  exportedAt: string;
  taxonomies: Taxonomy[];
  tags: Tag[];
  collections: Collection[];
  artworks: BackupArtwork[];
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private artworks = inject(ArtworkStore);
  private collections = inject(CollectionStore);
  private taxonomies = inject(TaxonomyStore);

  /** Export complet (images en base64) dans un fichier JSON téléchargé. */
  async export(): Promise<void> {
    const artworks: BackupArtwork[] = [];
    for (const a of await db.artworks.toArray()) {
      const img = await db.images.get(a.id);
      artworks.push({
        ...a,
        thumb: await blobToDataUrl(a.thumb),
        image: img ? await blobToDataUrl(img.blob) : '',
      });
    }
    const backup: Backup = {
      app: 'portfolio-artiste',
      version: 1,
      exportedAt: new Date().toISOString(),
      taxonomies: await db.taxonomies.toArray(),
      tags: await db.tags.toArray(),
      collections: await db.collections.toArray(),
      artworks,
    };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Remplace intégralement les données locales par la sauvegarde. */
  async import(file: File): Promise<void> {
    const backup = JSON.parse(await file.text()) as Backup;
    if (backup.app !== 'portfolio-artiste') throw new Error('Fichier de sauvegarde invalide');

    const artworks: Artwork[] = [];
    const images: { id: string; blob: Blob }[] = [];
    for (const a of backup.artworks) {
      const { thumb, image, ...rest } = a;
      artworks.push({ ...rest, thumb: await dataUrlToBlob(thumb) });
      images.push({ id: a.id, blob: await dataUrlToBlob(image) });
    }

    await db.transaction('rw', [db.artworks, db.images, db.taxonomies, db.tags, db.collections], async () => {
      await Promise.all([db.artworks.clear(), db.images.clear(), db.taxonomies.clear(), db.tags.clear(), db.collections.clear()]);
      await db.taxonomies.bulkAdd(backup.taxonomies);
      await db.tags.bulkAdd(backup.tags);
      await db.collections.bulkAdd(backup.collections);
      await db.artworks.bulkAdd(artworks);
      await db.images.bulkAdd(images);
    });

    await Promise.all([this.taxonomies.load(), this.artworks.load(), this.collections.load()]);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  if (!dataUrl) return new Blob();
  return (await fetch(dataUrl)).blob();
}
