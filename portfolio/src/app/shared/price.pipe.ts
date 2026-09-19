import { Pipe, PipeTransform } from '@angular/core';

const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

@Pipe({ name: 'price' })
export class PricePipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null ? '' : fmt.format(value);
  }
}
