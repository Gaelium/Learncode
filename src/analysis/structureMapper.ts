import { TocEntry } from '../types/epub';
import { chapterId, sectionId } from '../util/slugify';

export interface Chapter {
  id: string;
  title: string;
  href: string;
  index: number;
  sections: Section[];
}

export interface Section {
  id: string;
  title: string;
  href: string;
  chapterIndex: number;
  sectionIndex: number;
}

/**
 * Titles that are clearly non-content (front/back matter) and should be
 * skipped when building the chapter list.
 */
const SKIP_PATTERN = /^(cover|front matter|back matter|table of contents|copyright( page)?|title page|half title|dedication|acknowledgements?|about the authors?|foreword|colophon)$/i;

/**
 * Detects whether a TOC entry is a structural grouping (e.g. "Part I",
 * "Part II") rather than an actual chapter.  A Part entry is a container
 * whose children are the real chapters.
 */
function isPartEntry(entry: TocEntry): boolean {
  if (entry.children.length === 0) return false;

  // Explicit "Part ..." title
  if (/^Part\s/i.test(entry.title.trim())) return true;

  // Children look like numbered chapters (e.g. "2. Representing Position")
  const numberedChildren = entry.children.filter(c =>
    /^\d+\.?\s/.test(c.title.trim())
  );
  if (numberedChildren.length > 0 && numberedChildren.length === entry.children.length) {
    return true;
  }

  return false;
}

export function mapStructure(toc: TocEntry[]): Chapter[] {
  const chapters: Chapter[] = [];

  function addChapter(entry: TocEntry): void {
    if (SKIP_PATTERN.test(entry.title.trim())) return;

    const chapterIndex = chapters.length;
    const chId = chapterId(chapterIndex, entry.title);
    const sections: Section[] = [];

    if (entry.children.length > 0) {
      entry.children.forEach((child, sectionIndex) => {
        sections.push({
          id: sectionId(chapterIndex, sectionIndex, child.title),
          title: child.title,
          href: child.href,
          chapterIndex,
          sectionIndex,
        });
      });
    }

    chapters.push({
      id: chId,
      title: entry.title,
      href: entry.href,
      index: chapterIndex,
      sections,
    });
  }

  for (const entry of toc) {
    if (SKIP_PATTERN.test(entry.title.trim())) continue;

    if (isPartEntry(entry)) {
      // Part entry — promote its children to chapter level
      for (const child of entry.children) {
        addChapter(child);
      }
    } else {
      addChapter(entry);
    }
  }

  return chapters;
}
