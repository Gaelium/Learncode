import { describe, it, expect } from 'vitest';
import { extractChapterText } from '../../../pdf/textExtractor';
import { makeChapter } from '../../helpers/fixtures';

describe('extractChapterText', () => {
  it('groups pages by chapter ranges', () => {
    const textByPage = new Map<number, string>([
      [1, 'Page 1 text'],
      [2, 'Page 2 text'],
      [3, 'Page 3 text'],
      [4, 'Page 4 text'],
      [5, 'Page 5 text'],
    ]);
    const chapters = [
      makeChapter({ href: 'page-1', index: 0 }),
      makeChapter({ href: 'page-3', index: 1 }),
    ];
    const result = extractChapterText(textByPage, chapters);
    expect(result.get('page-1')).toBe('Page 1 text\n\nPage 2 text');
    expect(result.get('page-3')).toBe('Page 3 text\n\nPage 4 text\n\nPage 5 text');
  });

  it('last chapter extends to end of document', () => {
    const textByPage = new Map<number, string>([
      [1, 'A'],
      [2, 'B'],
      [3, 'C'],
    ]);
    const chapters = [makeChapter({ href: 'page-2', index: 0 })];
    const result = extractChapterText(textByPage, chapters);
    expect(result.get('page-2')).toBe('B\n\nC');
  });

  it('concatenates pages with double newlines', () => {
    const textByPage = new Map<number, string>([
      [1, 'First'],
      [2, 'Second'],
    ]);
    const chapters = [makeChapter({ href: 'page-1', index: 0 })];
    const result = extractChapterText(textByPage, chapters);
    expect(result.get('page-1')).toBe('First\n\nSecond');
  });

  it('handles single-page chapters', () => {
    const textByPage = new Map<number, string>([
      [1, 'Ch1'],
      [2, 'Ch2'],
      [3, 'Ch3'],
    ]);
    const chapters = [
      makeChapter({ href: 'page-1', index: 0 }),
      makeChapter({ href: 'page-2', index: 1 }),
      makeChapter({ href: 'page-3', index: 2 }),
    ];
    const result = extractChapterText(textByPage, chapters);
    expect(result.get('page-1')).toBe('Ch1');
    expect(result.get('page-2')).toBe('Ch2');
    expect(result.get('page-3')).toBe('Ch3');
  });

  it('returns empty strings for empty textByPage', () => {
    const textByPage = new Map<number, string>();
    const chapters = [makeChapter({ href: 'page-1', index: 0 })];
    const result = extractChapterText(textByPage, chapters);
    expect(result.get('page-1')).toBe('');
  });
});
