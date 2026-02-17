import { describe, it, expect } from 'vitest';
import {
  slugify,
  chapterId,
  sectionId,
  exerciseId,
  exerciseDirName,
  chapterDirName,
} from '../../../util/slugify';

describe('slugify', () => {
  it('lowercases and replaces non-alphanumeric with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips leading/trailing hyphens', () => {
    expect(slugify('--Hello--')).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });

  it('handles unicode by removing non-ascii', () => {
    expect(slugify('Café Über')).toBe('caf-ber');
  });

  it('collapses multiple non-alphanumeric chars into one hyphen', () => {
    expect(slugify('foo   bar!!!baz')).toBe('foo-bar-baz');
  });

  it('truncates to 60 characters', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBe(60);
  });

  it('handles all-special-chars input', () => {
    expect(slugify('!@#$%^&*()')).toBe('');
  });
});

describe('chapterId', () => {
  it('formats with zero-padded index and slug', () => {
    expect(chapterId(0, 'Getting Started')).toBe('ch01-getting-started');
  });

  it('handles large index', () => {
    expect(chapterId(99, 'End')).toBe('ch100-end');
  });

  it('handles empty title', () => {
    expect(chapterId(0, '')).toBe('ch01');
  });
});

describe('sectionId', () => {
  it('formats with chapter and section numbers', () => {
    expect(sectionId(0, 2, 'Variables')).toBe('ch01-sec03-variables');
  });

  it('handles empty title', () => {
    expect(sectionId(0, 0, '')).toBe('ch01-sec01');
  });
});

describe('exerciseId', () => {
  it('formats with chapter and exercise numbers', () => {
    expect(exerciseId(0, 0)).toBe('ch01-ex01');
    expect(exerciseId(2, 9)).toBe('ch03-ex10');
  });
});

describe('exerciseDirName', () => {
  it('combines id and slugified title', () => {
    expect(exerciseDirName('ch01-ex01', 'Hello World')).toBe('ch01-ex01-hello-world');
  });

  it('returns just id when title is empty', () => {
    expect(exerciseDirName('ch01-ex01', '')).toBe('ch01-ex01');
  });
});

describe('chapterDirName', () => {
  it('combines id and slugified title', () => {
    expect(chapterDirName('ch01', 'Getting Started')).toBe('ch01-getting-started');
  });

  it('returns just id when title is empty', () => {
    expect(chapterDirName('ch01', '')).toBe('ch01');
  });
});
