import { CodeBlock, CodeBlockType } from '../../types/codeblock';
import { TocEntry } from '../../types/epub';
import { Chapter, Section } from '../../analysis/structureMapper';
import { Exercise, ExerciseFile } from '../../types/exercise';
import { PdfOutlineItem } from '../../pdf/pdfParser';

export function makeCodeBlock(overrides: Partial<CodeBlock> = {}): CodeBlock {
  return {
    id: 'ch01:block-0',
    content: 'fn main() {\n    println!("Hello");\n}',
    language: 'rust',
    languageConfidence: 0.9,
    type: 'example',
    chapterHref: 'chapter01.xhtml',
    precedingHeading: 'Getting Started',
    precedingText: 'Here is a simple example:',
    followingText: 'This prints Hello.',
    cssClasses: ['language-rust'],
    lineCount: 3,
    elementIndex: 0,
    ...overrides,
  };
}

export function makeTocEntry(overrides: Partial<TocEntry> = {}): TocEntry {
  return {
    title: 'Chapter 1',
    href: 'chapter01.xhtml',
    depth: 0,
    children: [],
    ...overrides,
  };
}

export function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'ch01-chapter-1',
    title: 'Chapter 1',
    href: 'chapter01.xhtml',
    index: 0,
    sections: [],
    ...overrides,
  };
}

export function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'ch01-sec01-basics',
    title: 'Basics',
    href: 'chapter01.xhtml#basics',
    chapterIndex: 0,
    sectionIndex: 0,
    ...overrides,
  };
}

export function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ch01-ex01',
    title: 'Hello World',
    chapterId: 'ch01-chapter-1',
    language: 'rust',
    files: [{ path: 'src/main.rs', content: 'fn main() {}', isMain: true }],
    instructions: 'Study and run this code example.',
    bookmark: { chapterHref: 'chapter01.xhtml', heading: 'Getting Started' },
    dependencies: [],
    codeBlockIds: ['ch01:block-0'],
    ...overrides,
  };
}

export function makePdfOutlineItem(overrides: Partial<PdfOutlineItem> = {}): PdfOutlineItem {
  return {
    title: 'Chapter 1',
    dest: null,
    pageNumber: 1,
    items: [],
    ...overrides,
  };
}
