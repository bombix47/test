import { Injectable, computed, inject, signal } from '@angular/core';
import { db } from './db';
import { Artwork, uid } from './models';
import { ImageService } from './image.service';
import { CollectionStore } from './collection.store';

export type ArtworkPatch = Partial<Pick<Artwork, 'title' | 'description' | 'year' | 'dimensions' | 'tagIds'>>;

@Injectable({ providedIn: 'root' })
export class ArtworkStore {
  private images = inject(ImageService);
  private collections = inject(CollectionStore);

  readonly artworks = signal<Artwork[]>([]);
  readonly byId = computed(() => new Map(this.artworks().map((a) => [a.id, a])));

  /** URLs d'objets pour les vignettes, créées une fois et révoquées à la suppression. */
  private thumbUrls = new Map<string, string>();

  async load() {
    const list = await db.artworks.orderBy('createdAt').reverse().toArray();
    this.artworks.set(list);
  }

  thumbUrl(a: Artwork): string {
    let url = this.thumbUrls.get(a.id);
    if (!url) {
      url = URL.createObjectURL(a.thumb);
      this.thumbUrls.set(a.id, url);
    }
    return url;
  }

  async loadImage(id: string): Promise<Blob | undefined> {
    return (await db.images.get(id))?.blob;
  }

  async importFiles(files: File[], tagIds: string[] = []): Promise<Artwork[]> {
    const created: Artwork[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const { image, thumb, width, height } = await this.images.process(file);
      const now = Date.now();
      const artwork: Artwork = {
        id: uid(),
        title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
        description: '',
        year: null,
        dimensions: '',
        tagIds: [...tagIds],
        thumb,
        width,
        height,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction('rw', db.artworks, db.images, async () => {
        await db.artworks.add(artwork);
        await db.images.add({ id: artwork.id, blob: image });
      });
      created.push(artwork);
    }
    this.artworks.update((l) => [...created.reverse(), ...l]);
    return created;
  }

  async update(id: string, patch: ArtworkPatch) {
    const full = { ...patch, updatedAt: Date.now() };
    await db.artworks.update(id, full);
    this.artworks.update((l) => l.map((a) => (a.id === id ? { ...a, ...full } : a)));
  }

  async toggleTag(id: string, tagId: string) {
    const a = this.byId().get(id);
    if (!a) return;
    const tagIds = a.tagIds.includes(tagId) ? a.tagIds.filter((t) => t !== tagId) : [...a.tagIds, tagId];
    await this.update(id, { tagIds });
  }

  async addTagsToMany(ids: string[], tagIds: string[]) {
    for (const id of ids) {
      const a = this.byId().get(id);
      if (!a) continue;
      const merged = Array.from(new Set([...a.tagIds, ...tagIds]));
      await this.update(id, { tagIds: merged });
    }
  }

  async replaceImage(id: string, file: File) {
    const { image, thumb, width, height } = await this.images.process(file);
    const patch = { thumb, width, height, updatedAt: Date.now() };
    await db.transaction('rw', db.artworks, db.images, async () => {
      await db.artworks.update(id, patch);
      await db.images.put({ id, blob: image });
    });
    const old = this.thumbUrls.get(id);
    if (old) URL.revokeObjectURL(old);
    this.thumbUrls.delete(id);
    this.artworks.update((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async remove(ids: string[]) {
    await db.transaction('rw', db.artworks, db.images, db.collections, async () => {
      await db.artworks.bulkDelete(ids);
      await db.images.bulkDelete(ids);
      await this.collections.removeArtworksEverywhere(ids);
    });
    for (const id of ids) {
      const url = this.thumbUrls.get(id);
      if (url) URL.revokeObjectURL(url);
      this.thumbUrls.delete(id);
    }
    const set = new Set(ids);
    this.artworks.update((l) => l.filter((a) => !set.has(a.id)));
  }

  /** Appelé dans une transaction Dexie ouverte sur `artworks`. */
  async removeTagsEverywhere(tagIds: string[]) {
    const set = new Set(tagIds);
    const touched = this.artworks().filter((a) => a.tagIds.some((t) => set.has(t)));
    for (const a of touched) {
      await db.artworks.update(a.id, { tagIds: a.tagIds.filter((t) => !set.has(t)) });
    }
    this.artworks.update((l) => l.map((a) => ({ ...a, tagIds: a.tagIds.filter((t) => !set.has(t)) })));
  }
}
