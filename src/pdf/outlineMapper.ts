import { TocEntry } from '../types/epub';
import { PdfOutlineItem } from './pdfParser';

/**
 * Convert a pdf.js outline tree to our TocEntry[] format.
 * Each entry's href is "page-N" where N is the 1-based page number.
 * Falls back to a single "Document" entry if no outline exists.
 */
export function mapOutlineToToc(
  outline: PdfOutlineItem[],
  pageCount: number
): TocEntry[] {
  if (!outline || outline.length === 0) {
    // No outline — create a single chapter covering the whole document
    return [{
      title: 'Document',
      href: 'page-1',
      depth: 0,
      children: [],
    }];
  }

  return mapItems(outline, 0);
}

function mapItems(items: PdfOutlineItem[], depth: number): TocEntry[] {
  const entries: TocEntry[] = [];

  for (const item of items) {
    const pageNum = item.pageNumber ?? 1;
    const children = item.items.length > 0
      ? mapItems(item.items, depth + 1)
      : [];

    entries.push({
      title: item.title,
      href: `page-${pageNum}`,
      depth,
      children,
    });
  }

  return entries;
}
