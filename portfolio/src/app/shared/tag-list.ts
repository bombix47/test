import { Component, computed, inject, input } from '@angular/core';
import { TaxonomyStore } from '../core/taxonomy.store';

/** Affichage lecture seule des mots-clés d'une œuvre, colorés par taxonomie. */
@Component({
  selector: 'app-tag-list',
  template: `
    <div class="chips">
      @for (t of resolved(); track t.id) {
        <span class="chip static" [style.--chip]="t.color">{{ t.name }}</span>
      }
    </div>
  `,
})
export class TagList {
  private store = inject(TaxonomyStore);
  readonly tagIds = input.required<string[]>();

  readonly resolved = computed(() => {
    const tags = this.store.tagById();
    const taxonomies = this.store.taxonomyById();
    return this.tagIds()
      .map((id) => tags.get(id))
      .filter((t) => !!t)
      .map((t) => ({ id: t.id, name: t.name, color: taxonomies.get(t.taxonomyId)?.color ?? '#888', order: taxonomies.get(t.taxonomyId)?.order ?? 99 }))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'fr'));
  });
}
