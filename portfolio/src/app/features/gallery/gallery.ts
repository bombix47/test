import { Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArtworkStore } from '../../core/artwork.store';
import { CollectionStore } from '../../core/collection.store';
import { TaxonomyStore } from '../../core/taxonomy.store';
import { Artwork, ArtworkStatus, STATUSES, statusLabel } from '../../core/models';
import { TagChips } from '../../shared/tag-chips';
import { TagList } from '../../shared/tag-list';
import { StatusBadge } from '../../shared/status-badge';
import { PricePipe } from '../../shared/price.pipe';

type Sort = 'recent' | 'title' | 'year' | 'price';

@Component({
  selector: 'app-gallery',
  imports: [RouterLink, TagChips, TagList, StatusBadge, PricePipe],
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
  readonly selectedStatuses = signal<ArtworkStatus[]>([]);
  readonly statuses = STATUSES;
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
  /** Modifications en attente dans le dialogue de mots-clés : tagId -> ajouter / retirer. */
  readonly bulkChanges = signal<Map<string, 'add' | 'remove'>>(new Map());

  readonly selectedArtworks = computed(() => {
    const ids = this.selectedIds();
    return this.artworks.artworks().filter((a) => ids.has(a.id));
  });

  /** Pour chaque tag, nombre d'œuvres sélectionnées qui le portent. */
  readonly bulkCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const a of this.selectedArtworks()) for (const t of a.tagIds) counts.set(t, (counts.get(t) ?? 0) + 1);
    return counts;
  });

  /** État affiché = état actuel de la sélection + modifications en attente. */
  readonly bulkOn = computed(() => {
    const n = this.selectedArtworks().length;
    const changes = this.bulkChanges();
    const on: string[] = [];
    for (const [t, c] of this.bulkCounts()) if (c === n && changes.get(t) !== 'remove') on.push(t);
    for (const [t, c] of changes) if (c === 'add' && !on.includes(t)) on.push(t);
    return on;
  });

  readonly bulkPartial = computed(() => {
    const n = this.selectedArtworks().length;
    const changes = this.bulkChanges();
    const partial: string[] = [];
    for (const [t, c] of this.bulkCounts()) if (c > 0 && c < n && !changes.has(t)) partial.push(t);
    return partial;
  });

  readonly bulkHint = computed(() => {
    const n = this.selectedArtworks().length;
    const counts = this.bulkCounts();
    const changes = this.bulkChanges();
    return (tagId: string) => {
      const c = changes.get(tagId);
      if (c === 'add') return 'Sera ajouté à toute la sélection';
      if (c === 'remove') return 'Sera retiré de toute la sélection';
      const k = counts.get(tagId) ?? 0;
      return k ? `Présent sur ${k} œuvre${k > 1 ? 's' : ''} sur ${n}` : 'Absent de la sélection';
    };
  });

  readonly bulkSummary = computed(() => {
    let add = 0, remove = 0;
    for (const c of this.bulkChanges().values()) c === 'add' ? add++ : remove++;
    return { add, remove };
  });

  constructor() {
    effect(() => this.collectionId.set(this.collection() ?? ''));
  }

  readonly hasFilters = computed(() => !!this.query() || this.selectedTagIds().length > 0 || this.selectedStatuses().length > 0 || !!this.collectionId());

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
        return a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || String(a.year ?? '').includes(q) || statusLabel(a.status).toLowerCase().includes(q) || tagNames.some((n) => n.includes(q));
      });
    }
    const statuses = this.selectedStatuses();
    if (statuses.length) list = list.filter((a) => statuses.includes(a.status));
    for (const ids of byTaxonomy.values()) list = list.filter((a) => ids.some((t) => a.tagIds.includes(t)));

    const sort = this.sort();
    if (sort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    else if (sort === 'year') list = [...list].sort((a, b) => (b.year ?? -1) - (a.year ?? -1) || b.createdAt - a.createdAt);
    else if (sort === 'price') list = [...list].sort((a, b) => (b.price ?? -1) - (a.price ?? -1) || b.createdAt - a.createdAt);
    else if (!col) list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    return list;
  });

  toggleShowTags() {
    this.showTags.update((v) => !v);
    localStorage.setItem('gallery.showTags', this.showTags() ? '1' : '0');
  }

  toggleStatusFilter(st: ArtworkStatus) {
    this.selectedStatuses.update((l) => (l.includes(st) ? l.filter((x) => x !== st) : [...l, st]));
  }

  toggleTagFilter(id: string) {
    this.selectedTagIds.update((l) => (l.includes(id) ? l.filter((t) => t !== id) : [...l, id]));
  }

  clearFilters() {
    this.query.set('');
    this.selectedTagIds.set([]);
    this.selectedStatuses.set([]);
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
      else {
        // Import multiple : on pré-sélectionne les nouvelles œuvres pour l'étiquetage de masse.
        this.selecting.set(true);
        this.selectedIds.set(new Set(created.map((a) => a.id)));
        this.showToast(`${created.length} œuvres importées et sélectionnées`);
      }
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
    this.bulkChanges.set(new Map());
    this.tagDialog()?.nativeElement.showModal();
  }

  /** Cycle : absent/partiel -> ajouter ; présent partout -> retirer ; modification en attente -> annuler. */
  toggleBulkTag(id: string) {
    this.bulkChanges.update((m) => {
      const next = new Map(m);
      if (next.has(id)) next.delete(id);
      else {
        const n = this.selectedArtworks().length;
        next.set(id, (this.bulkCounts().get(id) ?? 0) === n ? 'remove' : 'add');
      }
      return next;
    });
  }

  async createBulkTag(taxonomyId: string, name: string) {
    const tag = await this.taxonomies.addTag(taxonomyId, name);
    this.bulkChanges.update((m) => new Map(m).set(tag.id, 'add'));
  }

  async applyBulkTags() {
    const add: string[] = [], remove: string[] = [];
    for (const [t, c] of this.bulkChanges()) (c === 'add' ? add : remove).push(t);
    const n = await this.artworks.applyTagsToMany([...this.selectedIds()], add, remove);
    this.tagDialog()?.nativeElement.close();
    this.showToast(n ? `${n} œuvre${n > 1 ? 's' : ''} mise${n > 1 ? 's' : ''} à jour` : 'Aucun changement');
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
