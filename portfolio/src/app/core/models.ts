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

/** Statut unique par œuvre. `available` = disponible à la vente (défaut). */
export type ArtworkStatus = 'available' | 'sold' | 'given' | 'personal';

export const STATUSES: { value: ArtworkStatus; label: string; color: string }[] = [
  { value: 'available', label: 'Disponible', color: '#3ea87a' },
  { value: 'sold', label: 'Vendu', color: '#b3261e' },
  { value: 'given', label: 'Donné', color: '#3e7cc2' },
  { value: 'personal', label: 'Perso', color: '#7a3ec2' },
];

export const statusLabel = (s: ArtworkStatus) => STATUSES.find((x) => x.value === s)?.label ?? s;
export const statusColor = (s: ArtworkStatus) => STATUSES.find((x) => x.value === s)?.color ?? '#888';

export interface Artwork {
  id: string;
  title: string;
  description: string;
  year: number | null;
  dimensions: string;
  status: ArtworkStatus;
  /** Prix en euros, null si non renseigné. */
  price: number | null;
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
