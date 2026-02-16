import * as fs from 'fs';
import JSZip from 'jszip';
import * as cheerio from 'cheerio';
import * as logger from '../util/logger';

export interface UnzipResult {
  zip: JSZip;
  opfPath: string;
}

export async function unzipEpub(epubPath: string): Promise<UnzipResult> {
  const data = await fs.promises.readFile(epubPath);
  const zip = await JSZip.loadAsync(data);

  // Validate mimetype
  const mimetypeFile = zip.file('mimetype');
  if (mimetypeFile) {
    const mimetype = (await mimetypeFile.async('text')).trim();
    if (mimetype !== 'application/epub+zip') {
      logger.warn(`Unexpected mimetype: ${mimetype}`);
    }
  } else {
    logger.warn('No mimetype file found in EPUB');
  }

  // Parse container.xml to find OPF path
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Invalid EPUB: missing META-INF/container.xml');
  }

  const containerXml = await containerFile.async('text');
  const $ = cheerio.load(containerXml, { xmlMode: true });
  const rootfile = $('rootfile').first();
  const opfPath = rootfile.attr('full-path');

  if (!opfPath) {
    throw new Error('Invalid EPUB: no rootfile full-path in container.xml');
  }

  logger.info(`Found OPF at: ${opfPath}`);
  return { zip, opfPath };
}
