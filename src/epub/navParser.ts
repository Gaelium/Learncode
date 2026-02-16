import JSZip from 'jszip';
import * as cheerio from 'cheerio';
import * as path from 'path';
import { TocEntry, SpineItem } from '../types/epub';
import * as logger from '../util/logger';

export async function parseNav(
  zip: JSZip,
  opfDir: string,
  navHref: string | undefined,
  ncxHref: string | undefined,
  spine: SpineItem[]
): Promise<TocEntry[]> {
  // Try EPUB3 nav first
  if (navHref) {
    const fullPath = path.posix.join(opfDir, navHref);
    const navFile = zip.file(fullPath);
    if (navFile) {
      const navHtml = await navFile.async('text');
      const toc = parseEpub3Nav(navHtml, path.posix.dirname(fullPath), spine);
      if (toc.length > 0) {
        logger.info(`Parsed EPUB3 nav: ${toc.length} top-level entries`);
        return toc;
      }
    }
  }

  // Fallback to NCX
  if (ncxHref) {
    const fullPath = path.posix.join(opfDir, ncxHref);
    const ncxFile = zip.file(fullPath);
    if (ncxFile) {
      const ncxXml = await ncxFile.async('text');
      const toc = parseNcx(ncxXml, path.posix.dirname(fullPath), spine);
      if (toc.length > 0) {
        logger.info(`Parsed NCX: ${toc.length} top-level entries`);
        return toc;
      }
    }
  }

  // Final fallback: generate from spine
  logger.warn('No nav or NCX found, generating ToC from spine order');
  return generateSpineToC(spine);
}

function parseEpub3Nav(html: string, navDir: string, spine: SpineItem[]): TocEntry[] {
  const $ = cheerio.load(html, { xmlMode: true });
  const tocNav = $('nav').filter((_, el) => {
    const epubType = $(el).attr('epub:type') || $(el).attr('type') || '';
    return epubType === 'toc';
  }).first();
  if (tocNav.length === 0) {
    // Fallback: any nav element
    const anyNav = $('nav').first();
    if (anyNav.length === 0) return [];
    return parseOlTree(anyNav.find('> ol').first(), $, navDir, spine, 0);
  }
  return parseOlTree(tocNav.find('> ol').first(), $, navDir, spine, 0);
}

function parseOlTree(
  ol: cheerio.Cheerio<any>,
  $: cheerio.CheerioAPI,
  navDir: string,
  spine: SpineItem[],
  depth: number
): TocEntry[] {
  const entries: TocEntry[] = [];
  ol.children('li').each((_, li) => {
    const anchor = $(li).children('a').first();
    const span = $(li).children('span').first();
    const title = (anchor.text() || span.text()).trim();
    const rawHref = anchor.attr('href') || '';
    const href = rawHref ? resolveNavHref(navDir, rawHref) : '';

    if (!title) return;

    const entry: TocEntry = {
      title,
      href,
      depth,
      children: [],
      spineIndex: findSpineIndex(href, spine),
    };

    const childOl = $(li).children('ol').first();
    if (childOl.length > 0) {
      entry.children = parseOlTree(childOl, $, navDir, spine, depth + 1);
    }

    entries.push(entry);
  });
  return entries;
}

function parseNcx(xml: string, ncxDir: string, spine: SpineItem[]): TocEntry[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const navMap = $('navMap').first();
  return parseNavPoints(navMap, $, ncxDir, spine, 0);
}

function parseNavPoints(
  parent: cheerio.Cheerio<any>,
  $: cheerio.CheerioAPI,
  ncxDir: string,
  spine: SpineItem[],
  depth: number
): TocEntry[] {
  const entries: TocEntry[] = [];
  parent.children('navPoint').each((_, np) => {
    const title = $(np).children('navLabel').first().find('text').first().text().trim();
    const rawHref = $(np).children('content').first().attr('src') || '';
    const href = rawHref ? resolveNavHref(ncxDir, rawHref) : '';

    if (!title) return;

    const entry: TocEntry = {
      title,
      href,
      depth,
      children: parseNavPoints($(np), $, ncxDir, spine, depth + 1),
      spineIndex: findSpineIndex(href, spine),
    };

    entries.push(entry);
  });
  return entries;
}

function generateSpineToC(spine: SpineItem[]): TocEntry[] {
  return spine
    .filter(s => s.linear)
    .map((s, i) => ({
      title: `Chapter ${i + 1}`,
      href: s.href,
      depth: 0,
      children: [],
      spineIndex: i,
    }));
}

function resolveNavHref(dir: string, href: string): string {
  const hashIndex = href.indexOf('#');
  const fragment = hashIndex >= 0 ? href.substring(hashIndex) : '';
  const cleanHref = hashIndex >= 0 ? href.substring(0, hashIndex) : href;
  if (!cleanHref) return fragment;
  return path.posix.join(dir, cleanHref) + fragment;
}

function findSpineIndex(href: string, spine: SpineItem[]): number | undefined {
  if (!href) return undefined;
  const hashIndex = href.indexOf('#');
  const cleanHref = hashIndex >= 0 ? href.substring(0, hashIndex) : href;
  const idx = spine.findIndex(s => {
    const sClean = s.href;
    return cleanHref === sClean || cleanHref.endsWith('/' + sClean) || sClean.endsWith('/' + cleanHref);
  });
  return idx >= 0 ? idx : undefined;
}
