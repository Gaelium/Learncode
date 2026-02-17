import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';

vi.mock('fs', async () => {
  const memfs = await import('memfs');
  return memfs.fs;
});

const { generateSandbox } = await import('../../../scaffold/sandboxGenerator');
const { initTemplates } = await import('../../../scaffold/templateRegistry');
import { makeChapter, makeExercise } from '../../helpers/fixtures';

describe('generateSandbox', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/sandbox', { recursive: true });
    initTemplates();
  });

  it('creates .learncode directory', async () => {
    await generateSandbox('/sandbox', [], []);
    expect(vol.existsSync('/sandbox/.learncode')).toBe(true);
  });

  it('creates shared directory', async () => {
    await generateSandbox('/sandbox', [], []);
    expect(vol.existsSync('/sandbox/shared')).toBe(true);
  });

  it('creates chapter directories with exercises', async () => {
    const chapter = makeChapter({ id: 'ch01-intro', title: 'Introduction', index: 0 });
    const exercise = makeExercise({
      id: 'ch01-ex01',
      title: 'Hello',
      chapterId: 'ch01-intro',
      language: 'rust',
      files: [{ path: 'src/main.rs', content: 'fn main() {}', isMain: true }],
    });

    await generateSandbox('/sandbox', [chapter], [exercise]);
    expect(vol.existsSync('/sandbox/ch01-intro-introduction')).toBe(true);
  });

  it('writes exercise files from templates', async () => {
    const chapter = makeChapter({ id: 'ch01-intro', title: 'Intro', index: 0 });
    const exercise = makeExercise({
      id: 'ch01-ex01',
      title: 'Hello',
      chapterId: 'ch01-intro',
      language: 'rust',
      files: [{ path: 'src/main.rs', content: 'fn hello() {}', isMain: true }],
    });

    await generateSandbox('/sandbox', [chapter], [exercise]);

    // Main file should have the exercise's code
    const mainPath = '/sandbox/ch01-intro-intro/ch01-ex01-hello/src/main.rs';
    const content = vol.readFileSync(mainPath, 'utf-8') as string;
    expect(content).toBe('fn hello() {}');

    // Template file (Cargo.toml) should also exist
    const cargoPath = '/sandbox/ch01-intro-intro/ch01-ex01-hello/Cargo.toml';
    expect(vol.existsSync(cargoPath)).toBe(true);
  });

  it('writes INSTRUCTIONS.md when instructions are present', async () => {
    const chapter = makeChapter({ id: 'ch01-intro', title: 'Intro', index: 0 });
    const exercise = makeExercise({
      id: 'ch01-ex01',
      title: 'Hello',
      chapterId: 'ch01-intro',
      instructions: 'Run this code.',
    });

    await generateSandbox('/sandbox', [chapter], [exercise]);
    const instrPath = '/sandbox/ch01-intro-intro/ch01-ex01-hello/INSTRUCTIONS.md';
    const content = vol.readFileSync(instrPath, 'utf-8') as string;
    expect(content).toContain('# Hello');
    expect(content).toContain('Run this code.');
  });

  it('writes .expected_output when present', async () => {
    const chapter = makeChapter({ id: 'ch01-intro', title: 'Intro', index: 0 });
    const exercise = makeExercise({
      id: 'ch01-ex01',
      title: 'Hello',
      chapterId: 'ch01-intro',
      expectedOutput: 'Hello, world!',
    });

    await generateSandbox('/sandbox', [chapter], [exercise]);
    const outputPath = '/sandbox/ch01-intro-intro/ch01-ex01-hello/.expected_output';
    const content = vol.readFileSync(outputPath, 'utf-8') as string;
    expect(content).toBe('Hello, world!');
  });

  it('skips chapters with no exercises', async () => {
    const ch1 = makeChapter({ id: 'ch01-intro', title: 'Intro', index: 0 });
    const ch2 = makeChapter({ id: 'ch02-empty', title: 'Empty', index: 1 });
    const exercise = makeExercise({ chapterId: 'ch01-intro' });

    await generateSandbox('/sandbox', [ch1, ch2], [exercise]);
    expect(vol.existsSync('/sandbox/ch01-intro-intro')).toBe(true);
    expect(vol.existsSync('/sandbox/ch02-empty-empty')).toBe(false);
  });

  it('handles exercises without templates (unknown language)', async () => {
    const chapter = makeChapter({ id: 'ch01-intro', title: 'Intro', index: 0 });
    const exercise = makeExercise({
      id: 'ch01-ex01',
      title: 'Hello',
      chapterId: 'ch01-intro',
      language: 'haskell',
      files: [{ path: 'Main.hs', content: 'main = putStrLn "hi"', isMain: true }],
    });

    await generateSandbox('/sandbox', [chapter], [exercise]);
    const filePath = '/sandbox/ch01-intro-intro/ch01-ex01-hello/Main.hs';
    const content = vol.readFileSync(filePath, 'utf-8') as string;
    expect(content).toBe('main = putStrLn "hi"');
  });
});
