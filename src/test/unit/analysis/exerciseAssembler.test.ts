import { describe, it, expect } from 'vitest';
import { assembleExercises } from '../../../analysis/exerciseAssembler';
import { makeCodeBlock, makeChapter, makeSection } from '../../helpers/fixtures';

describe('assembleExercises', () => {
  it('creates exercises from example blocks', () => {
    const chapter = makeChapter({ href: 'ch1.xhtml' });
    const blocks = [
      makeCodeBlock({
        type: 'example',
        chapterHref: 'ch1.xhtml',
        language: 'rust',
        languageConfidence: 0.9,
        lineCount: 5,
        content: 'fn main() {\n    println!("Hello");\n}',
      }),
    ];
    const exercises = assembleExercises([chapter], blocks);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].id).toBe('ch01-ex01');
    expect(exercises[0].chapterId).toBe(chapter.id);
    expect(exercises[0].language).toBe('rust');
  });

  it('creates exercises from exercise blocks', () => {
    const chapter = makeChapter({ href: 'ch1.xhtml' });
    const blocks = [
      makeCodeBlock({
        type: 'exercise',
        chapterHref: 'ch1.xhtml',
        language: 'rust',
        languageConfidence: 0.9,
        precedingText: 'Try it yourself',
      }),
    ];
    const exercises = assembleExercises([chapter], blocks);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].instructions).toContain('Implement the code');
  });

  it('groups consecutive incremental blocks', () => {
    const chapter = makeChapter({ href: 'ch1.xhtml' });
    const blocks = [
      makeCodeBlock({ id: 'b0', type: 'incremental', chapterHref: 'ch1.xhtml', content: 'step 1', elementIndex: 0 }),
      makeCodeBlock({ id: 'b1', type: 'incremental', chapterHref: 'ch1.xhtml', content: 'step 2', elementIndex: 1 }),
      makeCodeBlock({ id: 'b2', type: 'incremental', chapterHref: 'ch1.xhtml', content: 'step 3', elementIndex: 2 }),
    ];
    const exercises = assembleExercises([chapter], blocks);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].codeBlockIds).toHaveLength(3);
    expect(exercises[0].instructions).toContain('3 steps');
  });

  it('skips output, config, repl, and unknown blocks', () => {
    const chapter = makeChapter({ href: 'ch1.xhtml' });
    const blocks = [
      makeCodeBlock({ type: 'output', chapterHref: 'ch1.xhtml' }),
      makeCodeBlock({ type: 'config', chapterHref: 'ch1.xhtml' }),
      makeCodeBlock({ type: 'repl', chapterHref: 'ch1.xhtml' }),
      makeCodeBlock({ type: 'unknown', chapterHref: 'ch1.xhtml', language: 'unknown', languageConfidence: 0 }),
    ];
    const exercises = assembleExercises([chapter], blocks);
    expect(exercises).toHaveLength(0);
  });

  it('attaches expectedOutput from following output block', () => {
    const chapter = makeChapter({ href: 'ch1.xhtml' });
    const blocks = [
      makeCodeBlock({ type: 'example', chapterHref: 'ch1.xhtml', content: 'fn main() {}', elementIndex: 0 }),
      makeCodeBlock({ type: 'output', chapterHref: 'ch1.xhtml', content: 'Hello, world!', elementIndex: 1 }),
    ];
    const exercises = assembleExercises([chapter], blocks);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].expectedOutput).toBe('Hello, world!');
  });

  it('matches blocks to chapters by suffix matching', () => {
    const chapter = makeChapter({ href: 'ch1.xhtml' });
    const blocks = [
      makeCodeBlock({ type: 'example', chapterHref: 'OEBPS/ch1.xhtml' }),
    ];
    const exercises = assembleExercises([chapter], blocks);
    expect(exercises).toHaveLength(1);
  });

  it('generates exercise IDs sequentially within a chapter', () => {
    const chapter = makeChapter({ href: 'ch1.xhtml' });
    const blocks = [
      makeCodeBlock({ id: 'b0', type: 'example', chapterHref: 'ch1.xhtml', elementIndex: 0 }),
      makeCodeBlock({ id: 'b1', type: 'example', chapterHref: 'ch1.xhtml', elementIndex: 1 }),
    ];
    const exercises = assembleExercises([chapter], blocks);
    expect(exercises[0].id).toBe('ch01-ex01');
    expect(exercises[1].id).toBe('ch01-ex02');
  });

  it('generates title from preceding heading', () => {
    const chapter = makeChapter({ href: 'ch1.xhtml' });
    const blocks = [
      makeCodeBlock({ type: 'example', chapterHref: 'ch1.xhtml', precedingHeading: 'Hello World' }),
    ];
    const exercises = assembleExercises([chapter], blocks);
    expect(exercises[0].title).toBe('Hello World');
  });

  it('generates title from function name', () => {
    const chapter = makeChapter({ href: 'ch1.xhtml' });
    const blocks = [
      makeCodeBlock({
        type: 'example',
        chapterHref: 'ch1.xhtml',
        precedingHeading: '',
        content: 'fn calculate_sum(a: i32) -> i32 {\n    a + 1\n}',
      }),
    ];
    const exercises = assembleExercises([chapter], blocks);
    expect(exercises[0].title).toBe('calculate_sum');
  });

  it('generates fallback title', () => {
    const chapter = makeChapter({ href: 'ch1.xhtml' });
    const blocks = [
      makeCodeBlock({
        type: 'example',
        chapterHref: 'ch1.xhtml',
        precedingHeading: '',
        content: 'let x = 5;',
      }),
    ];
    const exercises = assembleExercises([chapter], blocks);
    expect(exercises[0].title).toBe('Exercise 1');
  });

  it('maps file name based on language', () => {
    const chapter = makeChapter({ href: 'ch1.xhtml' });

    const rustBlock = makeCodeBlock({ type: 'example', chapterHref: 'ch1.xhtml', language: 'rust' });
    const pyBlock = makeCodeBlock({ type: 'example', chapterHref: 'ch1.xhtml', language: 'python' });
    const jsBlock = makeCodeBlock({ type: 'example', chapterHref: 'ch1.xhtml', language: 'javascript' });
    const goBlock = makeCodeBlock({ type: 'example', chapterHref: 'ch1.xhtml', language: 'go' });

    const exRust = assembleExercises([chapter], [rustBlock]);
    expect(exRust[0].files[0].path).toBe('src/main.rs');

    const exPy = assembleExercises([chapter], [pyBlock]);
    expect(exPy[0].files[0].path).toBe('main.py');

    const exJs = assembleExercises([chapter], [jsBlock]);
    expect(exJs[0].files[0].path).toBe('index.js');

    const exGo = assembleExercises([chapter], [goBlock]);
    expect(exGo[0].files[0].path).toBe('main.go');
  });
});
