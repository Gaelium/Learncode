import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import * as yaml from 'js-yaml';

vi.mock('fs', async () => {
  const memfs = await import('memfs');
  return memfs.fs;
});

const { generateTemplateYaml } = await import('../../../scaffold/templateYamlGenerator');
import { makeChapter, makeExercise, makeSection } from '../../helpers/fixtures';
import { EpubMetadata } from '../../../types/epub';

describe('generateTemplateYaml', () => {
  const metadata: EpubMetadata = {
    title: 'Rust Programming',
    creator: 'Author Name',
    language: 'en',
    identifier: 'isbn-123',
  };

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
  });

  it('creates a valid YAML file', async () => {
    const chapters = [makeChapter({ id: 'ch01-intro', title: 'Intro', index: 0 })];
    const exercises = [makeExercise({ chapterId: 'ch01-intro', language: 'rust' })];

    await generateTemplateYaml('/project', metadata, chapters, exercises);

    const raw = vol.readFileSync('/project/.learncode/template.yaml', 'utf-8') as string;
    const parsed = yaml.load(raw) as any;
    expect(parsed).toBeDefined();
    expect(parsed.version).toBe('1.0');
  });

  it('populates metadata fields correctly', async () => {
    const template = await generateTemplateYaml('/project', metadata, [], []);
    expect(template.bookTitle).toBe('Rust Programming');
    expect(template.bookAuthor).toBe('Author Name');
    expect(template.version).toBe('1.0');
    expect(template.generatedAt).toBeTruthy();
  });

  it('groups exercises by chapter', async () => {
    const chapters = [
      makeChapter({ id: 'ch01', title: 'Ch1', index: 0 }),
      makeChapter({ id: 'ch02', title: 'Ch2', index: 1 }),
    ];
    const exercises = [
      makeExercise({ id: 'ch01-ex01', chapterId: 'ch01', language: 'rust' }),
      makeExercise({ id: 'ch01-ex02', chapterId: 'ch01', language: 'rust' }),
      makeExercise({ id: 'ch02-ex01', chapterId: 'ch02', language: 'rust' }),
    ];

    const template = await generateTemplateYaml('/project', metadata, chapters, exercises);
    expect(template.chapters[0].exercises).toHaveLength(2);
    expect(template.chapters[1].exercises).toHaveLength(1);
  });

  it('groups exercises by section when sectionId matches', async () => {
    const section = makeSection({ id: 'ch01-sec01', title: 'Basics', chapterIndex: 0, sectionIndex: 0 });
    const chapter = makeChapter({ id: 'ch01', title: 'Ch1', index: 0, sections: [section] });
    const exercises = [
      makeExercise({ id: 'ch01-ex01', chapterId: 'ch01', sectionId: 'ch01-sec01', language: 'rust' }),
    ];

    const template = await generateTemplateYaml('/project', metadata, [chapter], exercises);
    expect(template.chapters[0].sections).toHaveLength(1);
    expect(template.chapters[0].sections[0].exercises).toHaveLength(1);
    expect(template.chapters[0].exercises).toHaveLength(0); // Not top-level
  });

  it('detects primary language from exercise counts', async () => {
    const chapters = [makeChapter({ id: 'ch01', title: 'Ch1', index: 0 })];
    const exercises = [
      makeExercise({ id: 'ex1', chapterId: 'ch01', language: 'rust' }),
      makeExercise({ id: 'ex2', chapterId: 'ch01', language: 'rust' }),
      makeExercise({ id: 'ex3', chapterId: 'ch01', language: 'python' }),
    ];

    const template = await generateTemplateYaml('/project', metadata, chapters, exercises);
    expect(template.language).toBe('rust');
  });

  it('filters out empty sections', async () => {
    const section = makeSection({ id: 'ch01-sec01', title: 'Empty Section' });
    const chapter = makeChapter({ id: 'ch01', title: 'Ch1', index: 0, sections: [section] });

    const template = await generateTemplateYaml('/project', metadata, [chapter], []);
    expect(template.chapters[0].sections).toHaveLength(0);
  });
});
