import { EpubStructure } from '../types/epub';
import { unzipEpub } from './unzipper';
import { parseOpf } from './opfParser';
import { parseNav } from './navParser';
import { extractContent, extractImages } from './contentExtractor';
import * as logger from '../util/logger';

export async function parseEpub(epubPath: string): Promise<EpubStructure> {
  logger.info(`Parsing EPUB: ${epubPath}`);

  const { zip, opfPath } = await unzipEpub(epubPath);
  const { metadata, manifest, spine, navHref, ncxHref, opfDir } = await parseOpf(zip, opfPath);
  const toc = await parseNav(zip, opfDir, navHref, ncxHref, spine);
  const content = await extractContent(zip, opfDir, spine);
  const images = await extractImages(zip, opfDir, manifest);

  logger.info(`Parse complete: ${toc.length} ToC entries, ${content.size} content files, ${images.size} images`);

  return {
    metadata,
    manifest,
    spine,
    toc,
    content,
    images,
    opfDir,
  };
}
