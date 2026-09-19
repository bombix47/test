import { Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArtworkStore } from '../../core/artwork.store';
import { CollectionStore } from '../../core/collection.store';
import { TaxonomyStore } from '../../core/taxonomy.store';
import { Artwork } from '../../core/models';
import { TagChips } from '../../shared/tag-chips';
import { TagList } from '../../shared/tag-list';

type Sort = 'recent' | 'title' | 'year';

@Component({
  selector: 'app-gallery',
  imports: [RouterLink, TagChips, TagList],
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss',
})
export class Gallery {
  readonly artworks = inject(ArtworkStore);
  readonly taxonomies = inject(TaxonomyStore);
  readonly collections = inject(CollectionStore);
  private router = inject(Router);

  /** Query param ?collection=... (liaison automatique via withComponentInputBinding). */
  readonly collection = input<string>();

  readonly query = signal('');
  readonly selectedTagIds = signal<string[]>([]);
  readonly collectionId = signal<string>('');
  readonly sort = signal<Sort>('recent');
  readonly filtersOpen = signal(false);
  /** Affichage des mots-clés sous les vignettes (mémorisé). */
  readonly showTags = signal(localStorage.getItem('gallery.showTags') !== '0');

  readonly selecting = signal(false);
  readonly selectedIds = signal<Set<string>>(new Set());

  readonly importing = signal<string | null>(null);
  readonly toast = signal<string | null>(null);

  readonly collectionDialog = viewChild<ElementRef<HTMLDialogElement>>('collectionDialog');
  readonly tagDialog = viewChild<ElementRef<HTMLDialogElement>>('tagDialog');
  readonly newCollectionName = signal('');
  readonly bulkTagIds = signal<string[]>([]);

  constructor() {
    effect(() => this.collectionId.set(this.collection() ?? ''));
  }

  readonly hasFilters = computed(() => !!this.query() || this.selectedTagIds().length > 0 || !!this.collectionId());

  readonly filtered = computed<Artwork[]>(() => {
    const q = this.query().trim().toLowerCase();
    const tagById = this.taxonomies.tagById();
    const byId = this.artworks.byId();

    // Facettes : OU à l'intérieur d'une taxonomie, ET entre taxonomies.
    const byTaxonomy = new Map<string, string[]>();
    for (const id of this.selectedTagIds()) {
      const tag = tagById.get(id);
      if (!tag) continue;
      byTaxonomy.set(tag.taxonomyId, [...(byTaxonomy.get(tag.taxonomyId) ?? []), id]);
    }

    let list = this.artworks.artworks();
    const col = this.collectionId() ? this.collections.byId().get(this.collectionId()) : undefined;
    if (col) list = col.artworkIds.map((id) => byId.get(id)).filter((a): a is Artwork => !!a);

    if (q) {
      list = list.filter((a) => {
        const tagNames = a.tagIds.map((t) => tagById.get(t)?.name.toLowerCase() ?? '');
        return a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || String(a.year ?? '').includes(q) || tagNames.some((n) => n.includes(q));
      });
    }
    for (const ids of byTaxonomy.values()) list = list.filter((a) => ids.some((t) => a.tagIds.includes(t)));

    const sort = this.sort();
    if (sort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    else if (sort === 'year') list = [...list].sort((a, b) => (b.year ?? -1) - (a.year ?? -1) || b.createdAt - a.createdAt);
    else if (!col) list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    return list;
  });

  toggleShowTags() {
    this.showTags.update((v) => !v);
    localStorage.setItem('gallery.showTags', this.showTags() ? '1' : '0');
  }

  toggleTagFilter(id: string) {
    this.selectedTagIds.update((l) => (l.includes(id) ? l.filter((t) => t !== id) : [...l, id]));
  }

  clearFilters() {
    this.query.set('');
    this.selectedTagIds.set([]);
    this.collectionId.set('');
    if (this.collection()) this.router.navigate([], { queryParams: {} });
  }

  // ----- Import -----
  async onFiles(e: Event) {
    const inputEl = e.target as HTMLInputElement;
    const files = Array.from(inputEl.files ?? []);
    inputEl.value = '';
    if (!files.length) return;
    this.importing.set(`Import de ${files.length} image${files.length > 1 ? 's' : ''}…`);
    try {
      const created = await this.artworks.importFiles(files);
      if (this.collectionId() && created.length) await this.collections.addArtworks(this.collectionId(), created.map((a) => a.id));
      if (created.length === 1) this.router.navigate(['/oeuvre', created[0].id]);
      else this.showToast(`${created.length} œuvres importées`);
    } catch (err) {
      console.error(err);
      this.showToast("Échec de l'import");
    } finally {
      this.importing.set(null);
    }
  }

  // ----- Sélection multiple -----
  toggleSelecting() {
    this.selecting.update((v) => !v);
    this.selectedIds.set(new Set());
  }

  onTileClick(a: Artwork, e: MouseEvent) {
    if (!this.selecting()) return;
    e.preventDefault();
    this.selectedIds.update((s) => {
      const n = new Set(s);
      n.has(a.id) ? n.delete(a.id) : n.add(a.id);
      return n;
    });
  }

  selectAll() {
    this.selectedIds.set(new Set(this.filtered().map((a) => a.id)));
  }

  openCollectionDialog() {
    this.newCollectionName.set('');
    this.collectionDialog()?.nativeElement.showModal();
  }

  async addSelectionTo(collectionId: string) {
    await this.collections.addArtworks(collectionId, [...this.selectedIds()]);
    this.collectionDialog()?.nativeElement.close();
    this.showToast(`Ajouté à « ${this.collections.byId().get(collectionId)?.name} »`);
    this.toggleSelecting();
  }

  async createAndAdd() {
    const name = this.newCollectionName().trim();
    if (!name) return;
    const c = await this.collections.add(name);
    await this.addSelectionTo(c.id);
  }

  openTagDialog() {
    this.bulkTagIds.set([]);
    this.tagDialog()?.nativeElement.showModal();
  }

  toggleBulkTag(id: string) {
    this.bulkTagIds.update((l) => (l.includes(id) ? l.filter((t) => t !== id) : [...l, id]));
  }

  async createBulkTag(taxonomyId: string, name: string) {
    const tag = await this.taxonomies.addTag(taxonomyId, name);
    if (!this.bulkTagIds().includes(tag.id)) this.bulkTagIds.update((l) => [...l, tag.id]);
  }

  async applyBulkTags() {
    await this.artworks.addTagsToMany([...this.selectedIds()], this.bulkTagIds());
    this.tagDialog()?.nativeElement.close();
    this.showToast('Mots-clés ajoutés');
    this.toggleSelecting();
  }

  async deleteSelection() {
    const n = this.selectedIds().size;
    if (!confirm(`Supprimer définitivement ${n} œuvre${n > 1 ? 's' : ''} ?`)) return;
    await this.artworks.remove([...this.selectedIds()]);
    this.toggleSelecting();
  }

  private showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(null), 2500);
  }
}
