import JSZip from 'jszip';
import * as cheerio from 'cheerio';
import * as path from 'path';
import { EpubMetadata, ManifestItem, SpineItem } from '../types/epub';
import * as logger from '../util/logger';

export interface OpfResult {
  metadata: EpubMetadata;
  manifest: Map<string, ManifestItem>;
  spine: SpineItem[];
  navHref: string | undefined;
  ncxHref: string | undefined;
  opfDir: string;
}

export async function parseOpf(zip: JSZip, opfPath: string): Promise<OpfResult> {
  const opfDir = path.posix.dirname(opfPath);
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error(`OPF file not found: ${opfPath}`);
  }

  const opfXml = await opfFile.async('text');
  const $ = cheerio.load(opfXml, { xmlMode: true });

  // Extract metadata
  const metadata: EpubMetadata = {
    title: $('metadata dc\\:title, metadata title').first().text() || 'Untitled',
    creator: $('metadata dc\\:creator, metadata creator').first().text() || 'Unknown',
    language: $('metadata dc\\:language, metadata language').first().text() || 'en',
    identifier: $('metadata dc\\:identifier, metadata identifier').first().text() || '',
    publisher: $('metadata dc\\:publisher, metadata publisher').first().text() || undefined,
    date: $('metadata dc\\:date, metadata date').first().text() || undefined,
    description: $('metadata dc\\:description, metadata description').first().text() || undefined,
  };

  logger.info(`Book: "${metadata.title}" by ${metadata.creator}`);

  // Build manifest map
  const manifest = new Map<string, ManifestItem>();
  $('manifest item').each((_, el) => {
    const item: ManifestItem = {
      id: $(el).attr('id') || '',
      href: $(el).attr('href') || '',
      mediaType: $(el).attr('media-type') || '',
      properties: $(el).attr('properties') || undefined,
    };
    if (item.id) {
      manifest.set(item.id, item);
    }
  });

  // Find nav document (EPUB3) and NCX (EPUB2)
  let navHref: string | undefined;
  let ncxHref: string | undefined;

  for (const [, item] of manifest) {
    if (item.properties?.includes('nav')) {
      navHref = item.href;
    }
    if (item.mediaType === 'application/x-dtbncx+xml') {
      ncxHref = item.href;
    }
  }

  // Build spine array
  const spine: SpineItem[] = [];
  $('spine itemref').each((_, el) => {
    const idref = $(el).attr('idref') || '';
    const linear = $(el).attr('linear') !== 'no';
    const manifestItem = manifest.get(idref);
    if (manifestItem) {
      spine.push({
        idref,
        linear,
        href: manifestItem.href,
        mediaType: manifestItem.mediaType,
      });
    }
  });

  logger.info(`Manifest: ${manifest.size} items, Spine: ${spine.length} items`);

  return { metadata, manifest, spine, navHref, ncxHref, opfDir };
}
