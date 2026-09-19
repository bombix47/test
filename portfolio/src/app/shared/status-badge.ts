import { Component, computed, input } from '@angular/core';
import { ArtworkStatus, statusColor, statusLabel } from '../core/models';

/** Pastille de statut. Par défaut, masquée pour "Disponible" (cas nominal). */
@Component({
  selector: 'app-status-badge',
  template: `
    @if (visible()) {
      <span class="badge" [style.--c]="statusColor(status())">{{ statusLabel(status()) }}</span>
    }
  `,
  styles: `
    .badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      background: var(--c);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      line-height: 1.3;
    }
  `,
})
export class StatusBadge {
  readonly status = input.required<ArtworkStatus>();
  readonly showAvailable = input(false);
  readonly visible = computed(() => this.showAvailable() || this.status() !== 'available');
  readonly statusLabel = statusLabel;
  readonly statusColor = statusColor;
}
