import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArtworkStore } from '../../core/artwork.store';
import { CollectionStore } from '../../core/collection.store';
import { Artwork } from '../../core/models';

@Component({
  selector: 'app-collections',
  imports: [RouterLink],
  templateUrl: './collections.html',
  styleUrl: './collections.scss',
})
export class Collections {
  readonly collections = inject(CollectionStore);
  readonly artworks = inject(ArtworkStore);

  readonly newName = signal('');

  /** Jusqu'à 4 vignettes de couverture par collection. */
  readonly covers = computed(() => {
    const byId = this.artworks.byId();
    return new Map(
      this.collections.collections().map((c) => [c.id, c.artworkIds.map((id) => byId.get(id)).filter((a): a is Artwork => !!a).slice(0, 4)]),
    );
  });

  async create(e: Event) {
    e.preventDefault();
    const name = this.newName().trim();
    if (!name) return;
    await this.collections.add(name);
    this.newName.set('');
  }
}
