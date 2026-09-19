/** Une taxonomie = un axe de classement (Technique, Sujet, Thème, ...). */
export interface Taxonomy {
  id: string;
  name: string;
  color: string;
  order: number;
}

/** Un mot-clé appartient à une seule taxonomie. */
export interface Tag {
  id: string;
  taxonomyId: string;
  name: string;
}

export interface Artwork {
  id: string;
  title: string;
  description: string;
  year: number | null;
  dimensions: string;
  tagIds: string[];
  thumb: Blob;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
}

/** Image pleine résolution, stockée à part pour ne pas alourdir le listing. */
export interface ArtworkImage {
  id: string;
  blob: Blob;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  artworkIds: string[];
  createdAt: number;
  updatedAt: number;
}

export const uid = () => crypto.randomUUID();
