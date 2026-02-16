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

export function mapStructure(toc: TocEntry[]): Chapter[] {
  const chapters: Chapter[] = [];

  // Depth 0 entries are chapters
  const topLevel = toc.filter(e => e.depth === 0);

  topLevel.forEach((entry, chapterIndex) => {
    const chId = chapterId(chapterIndex, entry.title);
    const sections: Section[] = [];

    // Depth 1+ children are sections
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
  });

  return chapters;
}
