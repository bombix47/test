import { Injectable, computed, inject, signal } from '@angular/core';
import { db } from './db';
import { Tag, Taxonomy, uid } from './models';
import { ArtworkStore } from './artwork.store';

const SEED: { name: string; color: string; tags: string[] }[] = [
  { name: 'Technique', color: '#c2703e', tags: ['Huile', 'Acrylique', 'Aquarelle', 'Encre', 'Pastel', 'Fusain', 'Gouache', 'Technique mixte'] },
  { name: 'Sujet', color: '#3e7cc2', tags: ['Portrait', 'Paysage', 'Nature morte', 'Abstrait', 'Nu', 'Animalier', 'Urbain', 'Marine'] },
  { name: 'Thème', color: '#7a3ec2', tags: ['Lumière', 'Mémoire', 'Nature', 'Corps', 'Silence'] },
  { name: 'Support', color: '#3ea87a', tags: ['Toile', 'Papier', 'Bois', 'Carton'] },
];

@Injectable({ providedIn: 'root' })
export class TaxonomyStore {
  private artworks = inject(ArtworkStore);

  readonly taxonomies = signal<Taxonomy[]>([]);
  readonly tags = signal<Tag[]>([]);

  readonly tagsByTaxonomy = computed(() => {
    const map = new Map<string, Tag[]>();
    for (const t of this.tags()) {
      const list = map.get(t.taxonomyId) ?? [];
      list.push(t);
      map.set(t.taxonomyId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return map;
  });

  readonly tagById = computed(() => new Map(this.tags().map((t) => [t.id, t])));
  readonly taxonomyById = computed(() => new Map(this.taxonomies().map((t) => [t.id, t])));

  async load() {
    let taxonomies = await db.taxonomies.orderBy('order').toArray();
    if (taxonomies.length === 0) {
      await this.seed();
      taxonomies = await db.taxonomies.orderBy('order').toArray();
    }
    this.taxonomies.set(taxonomies);
    this.tags.set(await db.tags.toArray());
  }

  private async seed() {
    const taxonomies: Taxonomy[] = [];
    const tags: Tag[] = [];
    SEED.forEach((s, i) => {
      const tx: Taxonomy = { id: uid(), name: s.name, color: s.color, order: i };
      taxonomies.push(tx);
      s.tags.forEach((name) => tags.push({ id: uid(), taxonomyId: tx.id, name }));
    });
    await db.transaction('rw', db.taxonomies, db.tags, async () => {
      await db.taxonomies.bulkAdd(taxonomies);
      await db.tags.bulkAdd(tags);
    });
  }

  async addTaxonomy(name: string, color = '#888888') {
    const tx: Taxonomy = { id: uid(), name: name.trim(), color, order: this.taxonomies().length };
    await db.taxonomies.add(tx);
    this.taxonomies.update((l) => [...l, tx]);
    return tx;
  }

  async updateTaxonomy(id: string, patch: Partial<Pick<Taxonomy, 'name' | 'color' | 'order'>>) {
    await db.taxonomies.update(id, patch);
    this.taxonomies.update((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async removeTaxonomy(id: string) {
    const tagIds = this.tags().filter((t) => t.taxonomyId === id).map((t) => t.id);
    await db.transaction('rw', db.taxonomies, db.tags, db.artworks, async () => {
      await db.tags.bulkDelete(tagIds);
      await db.taxonomies.delete(id);
      await this.artworks.removeTagsEverywhere(tagIds);
    });
    this.tags.update((l) => l.filter((t) => t.taxonomyId !== id));
    this.taxonomies.update((l) => l.filter((t) => t.id !== id));
  }

  /** Crée le tag s'il n'existe pas déjà (insensible à la casse) dans la taxonomie. */
  async addTag(taxonomyId: string, name: string): Promise<Tag> {
    const clean = name.trim();
    const existing = this.tags().find(
      (t) => t.taxonomyId === taxonomyId && t.name.localeCompare(clean, 'fr', { sensitivity: 'accent' }) === 0,
    );
    if (existing) return existing;
    const tag: Tag = { id: uid(), taxonomyId, name: clean };
    await db.tags.add(tag);
    this.tags.update((l) => [...l, tag]);
    return tag;
  }

  async renameTag(id: string, name: string) {
    await db.tags.update(id, { name: name.trim() });
    this.tags.update((l) => l.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)));
  }

  async removeTag(id: string) {
    await db.transaction('rw', db.tags, db.artworks, async () => {
      await db.tags.delete(id);
      await this.artworks.removeTagsEverywhere([id]);
    });
    this.tags.update((l) => l.filter((t) => t.id !== id));
  }
}
