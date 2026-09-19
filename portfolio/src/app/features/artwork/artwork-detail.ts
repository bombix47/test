import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArtworkStore } from '../../core/artwork.store';
import { CollectionStore } from '../../core/collection.store';
import { TaxonomyStore } from '../../core/taxonomy.store';
import { TagChips } from '../../shared/tag-chips';
import { ArtworkStatus, STATUSES } from '../../core/models';

@Component({
  selector: 'app-artwork-detail',
  imports: [RouterLink, TagChips],
  templateUrl: './artwork-detail.html',
  styleUrl: './artwork-detail.scss',
})
export class ArtworkDetail {
  readonly artworks = inject(ArtworkStore);
  readonly taxonomies = inject(TaxonomyStore);
  readonly collections = inject(CollectionStore);
  private router = inject(Router);

  readonly id = input.required<string>();
  readonly artwork = computed(() => this.artworks.byId().get(this.id()));

  readonly imageUrl = signal<string | null>(null);
  readonly statuses = STATUSES;
  readonly saved = signal(false);

  /** Navigation précédent / suivant dans l'ordre de la galerie (plus récentes d'abord). */
  readonly neighbors = computed(() => {
    const list = this.artworks.artworks();
    const i = list.findIndex((a) => a.id === this.id());
    return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Charge l'image pleine résolution à chaque changement d'id ou de fichier.
    effect((onCleanup) => {
      const a = this.artwork();
      if (!a) return;
      a.updatedAt; // dépendance : rechargée après remplacement d'image
      let url: string | null = null;
      this.artworks.loadImage(a.id).then((blob) => {
        if (!blob) return;
        url = URL.createObjectURL(blob);
        this.imageUrl.set(url);
      });
      onCleanup(() => url && URL.revokeObjectURL(url));
    });
    destroyRef.onDestroy(() => {
      const u = this.imageUrl();
      if (u) URL.revokeObjectURL(u);
    });
  }

  async patch(field: 'title' | 'description' | 'dimensions', e: Event) {
    const value = (e.target as HTMLInputElement).value;
    await this.artworks.update(this.id(), { [field]: value });
    this.flashSaved();
  }

  async setStatus(status: ArtworkStatus) {
    await this.artworks.update(this.id(), { status });
    this.flashSaved();
  }

  async patchPrice(e: Event) {
    const raw = (e.target as HTMLInputElement).value.replace(',', '.');
    const price = raw ? Number(raw) : null;
    await this.artworks.update(this.id(), { price: price != null && Number.isFinite(price) && price >= 0 ? price : null });
    this.flashSaved();
  }

  async patchYear(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    const year = raw ? Number(raw) : null;
    await this.artworks.update(this.id(), { year: Number.isFinite(year) ? year : null });
    this.flashSaved();
  }

  async toggleTag(tagId: string) {
    await this.artworks.toggleTag(this.id(), tagId);
    this.flashSaved();
  }

  async createTag(taxonomyId: string, name: string) {
    const tag = await this.taxonomies.addTag(taxonomyId, name);
    if (!this.artwork()?.tagIds.includes(tag.id)) await this.artworks.toggleTag(this.id(), tag.id);
    this.flashSaved();
  }

  async toggleCollection(collectionId: string) {
    await this.collections.toggleArtwork(collectionId, this.id());
    this.flashSaved();
  }

  async createCollection(e: Event) {
    e.preventDefault();
    const inputEl = (e.target as HTMLFormElement).querySelector('input')!;
    const name = inputEl.value.trim();
    if (!name) return;
    await this.collections.add(name, '', [this.id()]);
    inputEl.value = '';
  }

  async replaceImage(e: Event) {
    const inputEl = e.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    await this.artworks.replaceImage(this.id(), file);
    this.flashSaved();
  }

  async remove() {
    const a = this.artwork();
    if (!a || !confirm(`Supprimer définitivement « ${a.title} » ?`)) return;
    const next = this.neighbors().next ?? this.neighbors().prev;
    await this.artworks.remove([a.id]);
    this.router.navigate(next ? ['/oeuvre', next.id] : ['/']);
  }

  private flashSaved() {
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 1200);
  }
}
