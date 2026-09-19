import { Component, inject, signal } from '@angular/core';
import { ArtworkStore } from '../../core/artwork.store';
import { BackupService } from '../../core/backup.service';
import { CollectionStore } from '../../core/collection.store';
import { TaxonomyStore } from '../../core/taxonomy.store';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  readonly taxonomies = inject(TaxonomyStore);
  readonly artworks = inject(ArtworkStore);
  readonly collections = inject(CollectionStore);
  private backup = inject(BackupService);

  readonly newTaxonomy = signal('');
  readonly busy = signal<string | null>(null);
  readonly storage = signal<{ usage: number; quota: number } | null>(null);

  constructor() {
    navigator.storage?.estimate?.().then((e) => this.storage.set({ usage: e.usage ?? 0, quota: e.quota ?? 0 }));
  }

  /** Nombre d'œuvres portant ce mot-clé. */
  usage(tagId: string) {
    return this.artworks.artworks().filter((a) => a.tagIds.includes(tagId)).length;
  }

  async addTaxonomy(e: Event) {
    e.preventDefault();
    const name = this.newTaxonomy().trim();
    if (!name) return;
    await this.taxonomies.addTaxonomy(name, randomColor());
    this.newTaxonomy.set('');
  }

  patchTaxonomy(id: string, field: 'name' | 'color', e: Event) {
    return this.taxonomies.updateTaxonomy(id, { [field]: (e.target as HTMLInputElement).value });
  }

  async removeTaxonomy(id: string, name: string) {
    if (!confirm(`Supprimer la taxonomie « ${name} » et tous ses mots-clés ?`)) return;
    await this.taxonomies.removeTaxonomy(id);
  }

  async addTag(taxonomyId: string, e: Event) {
    e.preventDefault();
    const inputEl = (e.target as HTMLFormElement).querySelector('input')!;
    if (!inputEl.value.trim()) return;
    await this.taxonomies.addTag(taxonomyId, inputEl.value);
    inputEl.value = '';
  }

  renameTag(id: string, e: Event) {
    const name = (e.target as HTMLInputElement).value.trim();
    if (name) return this.taxonomies.renameTag(id, name);
    return undefined;
  }

  async removeTag(id: string, name: string) {
    const n = this.usage(id);
    if (!confirm(`Supprimer le mot-clé « ${name} »${n ? ` (utilisé sur ${n} œuvre${n > 1 ? 's' : ''})` : ''} ?`)) return;
    await this.taxonomies.removeTag(id);
  }

  async exportAll() {
    this.busy.set('Export en cours…');
    try {
      await this.backup.export();
    } finally {
      this.busy.set(null);
    }
  }

  async importAll(e: Event) {
    const inputEl = e.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    if (!confirm('Importer cette sauvegarde REMPLACERA toutes les données actuelles. Continuer ?')) return;
    this.busy.set('Import en cours…');
    try {
      await this.backup.import(file);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      this.busy.set(null);
    }
  }

  fmt(bytes: number) {
    return bytes > 1e9 ? `${(bytes / 1e9).toFixed(2)} Go` : `${(bytes / 1e6).toFixed(1)} Mo`;
  }
}

function randomColor() {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h} 50% 45%)`;
}
