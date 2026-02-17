import { describe, it, expect } from 'vitest';
import { mapStructure } from '../../../analysis/structureMapper';
import { makeTocEntry } from '../../helpers/fixtures';

describe('mapStructure', () => {
  it('maps simple TOC entries to chapters', () => {
    const toc = [
      makeTocEntry({ title: 'Introduction', href: 'intro.xhtml' }),
      makeTocEntry({ title: 'Variables', href: 'vars.xhtml' }),
    ];
    const chapters = mapStructure(toc);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe('Introduction');
    expect(chapters[0].id).toBe('ch01-introduction');
    expect(chapters[0].index).toBe(0);
    expect(chapters[1].title).toBe('Variables');
    expect(chapters[1].index).toBe(1);
  });

  it('creates sections from children', () => {
    const toc = [
      makeTocEntry({
        title: 'Chapter 1',
        href: 'ch1.xhtml',
        children: [
          makeTocEntry({ title: 'Section A', href: 'ch1.xhtml#a', depth: 1 }),
          makeTocEntry({ title: 'Section B', href: 'ch1.xhtml#b', depth: 1 }),
        ],
      }),
    ];
    const chapters = mapStructure(toc);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].sections).toHaveLength(2);
    expect(chapters[0].sections[0].title).toBe('Section A');
    expect(chapters[0].sections[0].sectionIndex).toBe(0);
    expect(chapters[0].sections[1].sectionIndex).toBe(1);
  });

  it('filters out front/back matter entries', () => {
    const toc = [
      makeTocEntry({ title: 'Cover', href: 'cover.xhtml' }),
      makeTocEntry({ title: 'Copyright', href: 'copyright.xhtml' }),
      makeTocEntry({ title: 'Copyright Page', href: 'copyright.xhtml' }),
      makeTocEntry({ title: 'Table of Contents', href: 'toc.xhtml' }),
      makeTocEntry({ title: 'Dedication', href: 'ded.xhtml' }),
      makeTocEntry({ title: 'Acknowledgements', href: 'ack.xhtml' }),
      makeTocEntry({ title: 'About the Author', href: 'about.xhtml' }),
      makeTocEntry({ title: 'Foreword', href: 'fore.xhtml' }),
      makeTocEntry({ title: 'Chapter 1', href: 'ch1.xhtml' }),
    ];
    const chapters = mapStructure(toc);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('Chapter 1');
  });

  it('detects Part entries and promotes children', () => {
    const toc = [
      makeTocEntry({
        title: 'Part I: Basics',
        href: 'part1.xhtml',
        children: [
          makeTocEntry({ title: 'Hello World', href: 'ch1.xhtml' }),
          makeTocEntry({ title: 'Variables', href: 'ch2.xhtml' }),
        ],
      }),
      makeTocEntry({
        title: 'Part II: Advanced',
        href: 'part2.xhtml',
        children: [
          makeTocEntry({ title: 'Traits', href: 'ch3.xhtml' }),
        ],
      }),
    ];
    const chapters = mapStructure(toc);
    expect(chapters).toHaveLength(3);
    expect(chapters[0].title).toBe('Hello World');
    expect(chapters[0].index).toBe(0);
    expect(chapters[1].title).toBe('Variables');
    expect(chapters[1].index).toBe(1);
    expect(chapters[2].title).toBe('Traits');
    expect(chapters[2].index).toBe(2);
  });

  it('detects Part by numbered children heuristic', () => {
    const toc = [
      makeTocEntry({
        title: 'Foundations',
        href: 'found.xhtml',
        children: [
          makeTocEntry({ title: '1. Hello World', href: 'ch1.xhtml' }),
          makeTocEntry({ title: '2. Variables', href: 'ch2.xhtml' }),
        ],
      }),
    ];
    const chapters = mapStructure(toc);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe('1. Hello World');
  });

  it('maintains sequential indices across promoted chapters', () => {
    const toc = [
      makeTocEntry({ title: 'Intro', href: 'intro.xhtml' }),
      makeTocEntry({
        title: 'Part I',
        href: 'part1.xhtml',
        children: [
          makeTocEntry({ title: 'Ch1', href: 'ch1.xhtml' }),
          makeTocEntry({ title: 'Ch2', href: 'ch2.xhtml' }),
        ],
      }),
    ];
    const chapters = mapStructure(toc);
    expect(chapters[0].index).toBe(0);
    expect(chapters[1].index).toBe(1);
    expect(chapters[2].index).toBe(2);
  });

  it('returns empty array for empty TOC', () => {
    expect(mapStructure([])).toEqual([]);
  });
});
