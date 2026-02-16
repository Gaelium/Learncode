import { Chapter } from '../analysis/structureMapper';

/**
 * Group page text by chapter ranges based on outline page numbers.
 * Returns a map of chapterHref → combined text for that chapter's page range.
 */
export function extractChapterText(
  textByPage: Map<number, string>,
  chapters: Chapter[]
): Map<string, string> {
  const result = new Map<string, string>();
  const pageCount = textByPage.size;

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const startPage = parsePageNumber(chapter.href);
    const endPage = i + 1 < chapters.length
      ? parsePageNumber(chapters[i + 1].href) - 1
      : pageCount;

    const pages: string[] = [];
    for (let p = startPage; p <= endPage; p++) {
      const text = textByPage.get(p);
      if (text) {
        pages.push(text);
      }
    }

    result.set(chapter.href, pages.join('\n\n'));
  }

  return result;
}

/**
 * Extract page number from href format "page-N".
 */
function parsePageNumber(href: string): number {
  const match = href.match(/^page-(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
}
