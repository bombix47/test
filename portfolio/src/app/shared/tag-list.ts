import { Component, computed, inject, input, output } from '@angular/core';
import { TaxonomyStore } from '../core/taxonomy.store';

/** Affichage lecture seule des mots-clés d'une œuvre, colorés par taxonomie. */
@Component({
  selector: 'app-tag-list',
  template: `
    <div class="chips" [class.sm]="size() === 'sm'">
      @for (t of visible(); track t.id) {
        <span class="chip static" [class.pick]="interactive()" [class.on]="highlight().includes(t.id)" [style.--chip]="t.color" [title]="t.taxonomy" (click)="pick(t.id, $event)">{{ t.name }}</span>
      }
      @if (hidden() > 0) {
        <span class="chip static more">+{{ hidden() }}</span>
      }
    </div>
  `,
  styles: `
    .sm .chip { padding: 0.1rem 0.45rem; font-size: 0.72rem; gap: 0.25rem; &::before { width: 6px; height: 6px; } }
    .chip.pick { cursor: pointer; &:hover { border-color: var(--chip); } }
    .chip.more { color: var(--muted); &::before { display: none; } }
  `,
})
export class TagList {
  private store = inject(TaxonomyStore);
  readonly tagIds = input.required<string[]>();
  readonly size = input<'md' | 'sm'>('md');
  /** Nombre max de chips affichées, le reste est résumé en "+N". */
  readonly max = input<number>(Infinity);
  /** Si vrai, un clic sur une chip émet `picked` sans déclencher le lien parent. */
  readonly interactive = input(false);
  readonly highlight = input<string[]>([]);
  readonly picked = output<string>();

  readonly resolved = computed(() => {
    const tags = this.store.tagById();
    const taxonomies = this.store.taxonomyById();
    return this.tagIds()
      .map((id) => tags.get(id))
      .filter((t) => !!t)
      .map((t) => {
        const tx = taxonomies.get(t.taxonomyId);
        return { id: t.id, name: t.name, color: tx?.color ?? '#888', taxonomy: tx?.name ?? '', order: tx?.order ?? 99 };
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'fr'));
  });

  readonly visible = computed(() => this.resolved().slice(0, this.max()));
  readonly hidden = computed(() => this.resolved().length - this.visible().length);

  pick(id: string, e: Event) {
    if (!this.interactive()) return;
    e.preventDefault();
    e.stopPropagation();
    this.picked.emit(id);
  }
}
