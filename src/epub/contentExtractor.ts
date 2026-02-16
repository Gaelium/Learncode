import JSZip from 'jszip';
import * as path from 'path';
import { SpineItem, ManifestItem } from '../types/epub';
import * as logger from '../util/logger';

export async function extractContent(
  zip: JSZip,
  opfDir: string,
  spine: SpineItem[]
): Promise<Map<string, string>> {
  const content = new Map<string, string>();

  for (const item of spine) {
    if (!item.linear) continue;

    const fullPath = path.posix.join(opfDir, item.href);
    const file = zip.file(fullPath);
    if (file) {
      try {
        const text = await file.async('text');
        content.set(fullPath, text);
      } catch (err) {
        logger.warn(`Failed to extract content from ${fullPath}: ${err}`);
      }
    } else {
      logger.warn(`Spine item not found in zip: ${fullPath}`);
    }
  }

  logger.info(`Extracted content from ${content.size} spine items`);
  return content;
}

export async function extractImages(
  zip: JSZip,
  opfDir: string,
  manifest: Map<string, ManifestItem>
): Promise<Map<string, Buffer>> {
  const images = new Map<string, Buffer>();

  for (const [, item] of manifest) {
    if (!item.mediaType.startsWith('image/')) continue;

    const fullPath = path.posix.join(opfDir, item.href);
    const file = zip.file(fullPath);
    if (file) {
      try {
        const buffer = await file.async('nodebuffer');
        images.set(fullPath, buffer);
      } catch (err) {
        logger.warn(`Failed to extract image ${fullPath}: ${err}`);
      }
    }
  }

  logger.info(`Extracted ${images.size} images from EPUB`);
  return images;
}
