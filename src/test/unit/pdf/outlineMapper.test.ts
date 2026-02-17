import { describe, it, expect } from 'vitest';
import { mapOutlineToToc } from '../../../pdf/outlineMapper';
import { makePdfOutlineItem } from '../../helpers/fixtures';

describe('mapOutlineToToc', () => {
  it('returns single "Document" entry for null outline', () => {
    const toc = mapOutlineToToc(null as any, 100);
    expect(toc).toHaveLength(1);
    expect(toc[0].title).toBe('Document');
    expect(toc[0].href).toBe('page-1');
    expect(toc[0].children).toEqual([]);
  });

  it('returns single "Document" entry for empty outline', () => {
    const toc = mapOutlineToToc([], 100);
    expect(toc).toHaveLength(1);
    expect(toc[0].title).toBe('Document');
  });

  it('maps flat outline items', () => {
    const outline = [
      makePdfOutlineItem({ title: 'Introduction', pageNumber: 1 }),
      makePdfOutlineItem({ title: 'Chapter 1', pageNumber: 10 }),
      makePdfOutlineItem({ title: 'Chapter 2', pageNumber: 25 }),
    ];
    const toc = mapOutlineToToc(outline, 100);
    expect(toc).toHaveLength(3);
    expect(toc[0].title).toBe('Introduction');
    expect(toc[0].href).toBe('page-1');
    expect(toc[1].href).toBe('page-10');
    expect(toc[2].href).toBe('page-25');
  });

  it('maps nested outline items', () => {
    const outline = [
      makePdfOutlineItem({
        title: 'Chapter 1',
        pageNumber: 5,
        items: [
          makePdfOutlineItem({ title: 'Section 1.1', pageNumber: 6 }),
          makePdfOutlineItem({ title: 'Section 1.2', pageNumber: 12 }),
        ],
      }),
    ];
    const toc = mapOutlineToToc(outline, 100);
    expect(toc).toHaveLength(1);
    expect(toc[0].children).toHaveLength(2);
    expect(toc[0].depth).toBe(0);
    expect(toc[0].children[0].depth).toBe(1);
    expect(toc[0].children[0].title).toBe('Section 1.1');
    expect(toc[0].children[0].href).toBe('page-6');
  });

  it('uses default page 1 when pageNumber is undefined', () => {
    const outline = [
      makePdfOutlineItem({ title: 'No Page', pageNumber: undefined }),
    ];
    const toc = mapOutlineToToc(outline, 50);
    expect(toc[0].href).toBe('page-1');
  });

  it('tracks depth correctly for deeply nested items', () => {
    const outline = [
      makePdfOutlineItem({
        title: 'Level 0',
        pageNumber: 1,
        items: [
          makePdfOutlineItem({
            title: 'Level 1',
            pageNumber: 2,
            items: [
              makePdfOutlineItem({ title: 'Level 2', pageNumber: 3 }),
            ],
          }),
        ],
      }),
    ];
    const toc = mapOutlineToToc(outline, 50);
    expect(toc[0].depth).toBe(0);
    expect(toc[0].children[0].depth).toBe(1);
    expect(toc[0].children[0].children[0].depth).toBe(2);
  });
});
