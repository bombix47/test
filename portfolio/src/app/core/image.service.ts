import { Injectable } from '@angular/core';

export interface ProcessedImage {
  image: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

const MAX_IMAGE = 2048;
const MAX_THUMB = 480;

@Injectable({ providedIn: 'root' })
export class ImageService {
  /** Redimensionne (orientation EXIF respectée) et produit image + vignette en JPEG. */
  async process(file: Blob): Promise<ProcessedImage> {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const image = await this.resize(bmp, MAX_IMAGE, 0.9);
      const thumb = await this.resize(bmp, MAX_THUMB, 0.8);
      const scale = Math.min(1, MAX_IMAGE / Math.max(bmp.width, bmp.height));
      return { image, thumb, width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) };
    } finally {
      bmp.close();
    }
  }

  private async resize(bmp: ImageBitmap, max: number, quality: number): Promise<Blob> {
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, w, h);
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
}
