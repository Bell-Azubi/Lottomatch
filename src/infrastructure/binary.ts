import type { BinaryCodec } from '../application/platform';

const CHUNK = 0x8000;

/** Base64 conversion for images inside JSON exports. */
export const binaryCodec: BinaryCodec = {
  async blobToBase64(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
    }
    return btoa(binary);
  },
  base64ToBlob(data: string, type: string): Blob {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type });
  },
  textToBlob(text: string, type: string): Blob {
    return new Blob([text], { type });
  },
};

/** Fetches a same-origin file relative to the app base; the service worker serves it offline. */
export async function fetchText(path: string): Promise<string> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`, {
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
  return response.text();
}
