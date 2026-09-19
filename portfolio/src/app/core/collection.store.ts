import { Injectable, computed, signal } from '@angular/core';
import { db } from './db';
import { Collection, uid } from './models';

@Injectable({ providedIn: 'root' })
export class CollectionStore {
  readonly collections = signal<Collection[]>([]);
  readonly byId = computed(() => new Map(this.collections().map((c) => [c.id, c])));

  async load() {
    this.collections.set(await db.collections.orderBy('createdAt').toArray());
  }

  async add(name: string, description = '', artworkIds: string[] = []) {
    const now = Date.now();
    const c: Collection = { id: uid(), name: name.trim(), description, artworkIds: [...artworkIds], createdAt: now, updatedAt: now };
    await db.collections.add(c);
    this.collections.update((l) => [...l, c]);
    return c;
  }

  async update(id: string, patch: Partial<Pick<Collection, 'name' | 'description' | 'artworkIds'>>) {
    const full = { ...patch, updatedAt: Date.now() };
    await db.collections.update(id, full);
    this.collections.update((l) => l.map((c) => (c.id === id ? { ...c, ...full } : c)));
  }

  async remove(id: string) {
    await db.collections.delete(id);
    this.collections.update((l) => l.filter((c) => c.id !== id));
  }

  /** Ajoute sans doublon, en fin de liste. */
  async addArtworks(id: string, artworkIds: string[]) {
    const c = this.byId().get(id);
    if (!c) return;
    const merged = Array.from(new Set([...c.artworkIds, ...artworkIds]));
    await this.update(id, { artworkIds: merged });
  }

  async removeArtwork(id: string, artworkId: string) {
    const c = this.byId().get(id);
    if (!c) return;
    await this.update(id, { artworkIds: c.artworkIds.filter((a) => a !== artworkId) });
  }

  async toggleArtwork(id: string, artworkId: string) {
    const c = this.byId().get(id);
    if (!c) return;
    if (c.artworkIds.includes(artworkId)) await this.removeArtwork(id, artworkId);
    else await this.addArtworks(id, [artworkId]);
  }

  /** Appelé dans une transaction Dexie ouverte sur `collections`. */
  async removeArtworksEverywhere(artworkIds: string[]) {
    const set = new Set(artworkIds);
    const touched = this.collections().filter((c) => c.artworkIds.some((a) => set.has(a)));
    for (const c of touched) {
      await db.collections.update(c.id, { artworkIds: c.artworkIds.filter((a) => !set.has(a)) });
    }
    this.collections.update((l) => l.map((c) => ({ ...c, artworkIds: c.artworkIds.filter((a) => !set.has(a)) })));
  }
}
