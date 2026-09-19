import { Component, input, output, signal } from '@angular/core';
import { Tag } from '../core/models';

/** Rangée de chips (multi-sélection) avec création optionnelle d'un nouveau mot-clé. */
@Component({
  selector: 'app-tag-chips',
  template: `
    <div class="chips">
      @for (tag of tags(); track tag.id) {
        <button
          type="button"
          class="chip"
          [class.on]="selected().includes(tag.id)"
          [class.partial]="!selected().includes(tag.id) && partial().includes(tag.id)"
          [style.--chip]="color()"
          [title]="hint()(tag.id)"
          (click)="toggled.emit(tag.id)"
        >
          {{ tag.name }}
        </button>
      }
      @if (allowCreate()) {
        <form class="new" (submit)="submit($event)">
          <input type="text" [value]="draft()" (input)="draft.set($any($event.target).value)" placeholder="+ nouveau" aria-label="Nouveau mot-clé" />
        </form>
      } @else if (tags().length === 0) {
        <span class="muted small">Aucun mot-clé</span>
      }
    </div>
  `,
  styles: `
    .new input { width: 8.5rem; padding: 0.3rem 0.7rem; border-radius: 999px; font-size: 0.875rem; }
    .chip.partial { border-style: dashed; border-color: var(--chip); background: color-mix(in srgb, var(--chip) 12%, var(--surface)); }
  `,
})
export class TagChips {
  readonly tags = input.required<Tag[]>();
  readonly selected = input.required<string[]>();
  /** Tags présents sur une partie seulement de la sélection (édition de masse). */
  readonly partial = input<string[]>([]);
  readonly hint = input<(tagId: string) => string>(() => '');
  readonly color = input('#888');
  readonly allowCreate = input(false);
  readonly toggled = output<string>();
  readonly created = output<string>();

  readonly draft = signal('');

  submit(e: Event) {
    e.preventDefault();
    const name = this.draft().trim();
    if (!name) return;
    this.created.emit(name);
    this.draft.set('');
  }
}
