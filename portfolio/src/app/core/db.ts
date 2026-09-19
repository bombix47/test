import Dexie, { Table } from 'dexie';
import { Artwork, ArtworkImage, Collection, Tag, Taxonomy } from './models';

export class PortfolioDb extends Dexie {
  artworks!: Table<Artwork, string>;
  images!: Table<ArtworkImage, string>;
  taxonomies!: Table<Taxonomy, string>;
  tags!: Table<Tag, string>;
  collections!: Table<Collection, string>;

  constructor() {
    super('portfolio-artiste');
    this.version(1).stores({
      artworks: 'id, createdAt, *tagIds',
      images: 'id',
      taxonomies: 'id, order',
      tags: 'id, taxonomyId',
      collections: 'id, createdAt',
    });
  }
}

export const db = new PortfolioDb();
