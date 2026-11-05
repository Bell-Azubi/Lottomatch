import type { ImageError, ImageProcessor, ProcessedImage } from '../application/ports';
import { err, ok, type Result } from '../domain/result';

export const MAX_EDGE = 1280;
export const MAX_BYTES = 400 * 1024;
const MAX_INPUT_BYTES = 30 * 1024 * 1024;
const QUALITIES = [0.86, 0.76, 0.66, 0.56];

export type SniffedType = 'jpeg' | 'png' | 'webp' | 'heic' | 'svg' | 'unknown';

/** Identifies the format from the first bytes; the declared MIME type is not trusted. */
export function sniffImageType(bytes: Uint8Array): SniffedType {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (ascii(4, 8) === 'ftyp' && /^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(ascii(8, 12)))
    return 'heic';
  const text = new TextDecoder()
    .decode(bytes)
    .replace(/^\uFEFF/, '')
    .trimStart()
    .toLowerCase();
  if (text.startsWith('<?xml') || text.startsWith('<svg') || text.includes('<svg')) return 'svg';
  return 'unknown';
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement | undefined> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    } catch {
      return undefined;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function render(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
  opaque: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context !== null) {
    if (opaque) {
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, width, height);
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, width, height);
  }
  return canvas;
}

/** Encodes as WebP, or JPEG where the browser cannot encode WebP (checked on the result). */
async function encode(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
): Promise<Blob | undefined> {
  let type = 'image/webp';
  let canvas = render(source, width, height, false);
  for (const quality of QUALITIES) {
    let blob = await toBlob(canvas, type, quality);
    if (blob !== null && blob.type !== 'image/webp' && type === 'image/webp') {
      type = 'image/jpeg';
      canvas = render(source, width, height, true);
      blob = await toBlob(canvas, type, quality);
    }
    if (blob !== null && blob.size <= MAX_BYTES) return blob;
  }
  return undefined;
}

/**
 * Prize image pipeline (FR-8): rejects SVG, applies EXIF orientation, scales to ≤ 1280 px and
 * re-encodes (which strips metadata) to ≤ 400 KB, shrinking further if needed.
 */
export class CanvasImageProcessor implements ImageProcessor {
  async process(file: Blob): Promise<Result<ProcessedImage, ImageError>> {
    if (file.size > MAX_INPUT_BYTES) return err('TOO_LARGE');
    const kind = sniffImageType(new Uint8Array(await file.slice(0, 512).arrayBuffer()));
    if (kind === 'svg' || file.type === 'image/svg+xml') return err('SVG_REJECTED');
    if (kind === 'unknown') return err('UNSUPPORTED_TYPE');
    const source = await decode(file);
    if (source === undefined) return err(kind === 'heic' ? 'HEIC_UNSUPPORTED' : 'DECODE_FAILED');
    const naturalWidth = source.width;
    const naturalHeight = source.height;
    if (naturalWidth === 0 || naturalHeight === 0) return err('DECODE_FAILED');
    let scale = Math.min(1, MAX_EDGE / Math.max(naturalWidth, naturalHeight));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));
      const blob = await encode(source, width, height);
      if (blob !== undefined) {
        if ('close' in source) source.close();
        return ok({ blob, width, height });
      }
      scale *= 0.75;
    }
    if ('close' in source) source.close();
    return err('TOO_LARGE');
  }
}
