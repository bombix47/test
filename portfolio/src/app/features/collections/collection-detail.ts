import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArtworkStore } from '../../core/artwork.store';
import { CollectionStore } from '../../core/collection.store';
import { Artwork } from '../../core/models';
import { TagList } from '../../shared/tag-list';
import { StatusBadge } from '../../shared/status-badge';
import { PricePipe } from '../../shared/price.pipe';

@Component({
  selector: 'app-collection-detail',
  imports: [RouterLink, CdkDropList, CdkDrag, TagList, StatusBadge, PricePipe],
  templateUrl: './collection-detail.html',
  styleUrl: './collection-detail.scss',
})
export class CollectionDetail {
  readonly collections = inject(CollectionStore);
  readonly artworks = inject(ArtworkStore);
  private router = inject(Router);

  readonly id = input.required<string>();
  readonly collection = computed(() => this.collections.byId().get(this.id()));

  readonly items = computed<Artwork[]>(() => {
    const byId = this.artworks.byId();
    return (this.collection()?.artworkIds ?? []).map((id) => byId.get(id)).filter((a): a is Artwork => !!a);
  });

  readonly view = signal<'grid' | 'list'>('grid');

  // Dialog d'ajout
  readonly addDialog = viewChild<ElementRef<HTMLDialogElement>>('addDialog');
  readonly pickQuery = signal('');
  readonly picked = signal<Set<string>>(new Set());
  readonly candidates = computed(() => {
    const inCol = new Set(this.collection()?.artworkIds ?? []);
    const q = this.pickQuery().trim().toLowerCase();
    return this.artworks.artworks().filter((a) => !inCol.has(a.id) && (!q || a.title.toLowerCase().includes(q)));
  });

  async patch(field: 'name' | 'description', e: Event) {
    await this.collections.update(this.id(), { [field]: (e.target as HTMLInputElement).value });
  }

  async drop(e: CdkDragDrop<Artwork[]>) {
    if (e.previousIndex === e.currentIndex) return;
    const ids = [...(this.collection()?.artworkIds ?? [])];
    moveItemInArray(ids, e.previousIndex, e.currentIndex);
    await this.collections.update(this.id(), { artworkIds: ids });
  }

  async move(index: number, delta: number) {
    const ids = [...(this.collection()?.artworkIds ?? [])];
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    moveItemInArray(ids, index, target);
    await this.collections.update(this.id(), { artworkIds: ids });
  }

  removeArtwork(artworkId: string) {
    return this.collections.removeArtwork(this.id(), artworkId);
  }

  openAdd() {
    this.pickQuery.set('');
    this.picked.set(new Set());
    this.addDialog()?.nativeElement.showModal();
  }

  togglePick(id: string) {
    this.picked.update((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async confirmAdd() {
    await this.collections.addArtworks(this.id(), [...this.picked()]);
    this.addDialog()?.nativeElement.close();
  }

  async remove() {
    const c = this.collection();
    if (!c || !confirm(`Supprimer la collection « ${c.name} » ? Les œuvres ne seront pas supprimées.`)) return;
    await this.collections.remove(c.id);
    this.router.navigate(['/collections']);
  }

  print() {
    window.print();
  }
}
