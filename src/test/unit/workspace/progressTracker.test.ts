import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import * as os from 'os';

vi.mock('fs', async () => {
  const memfs = await import('memfs');
  return memfs.fs;
});

// Must import after mock setup
const { ProgressTracker } = await import('../../../workspace/progressTracker');

describe('ProgressTracker', () => {
  beforeEach(() => {
    vol.reset();
    // ProgressTracker.save() writes to os.tmpdir() then renames
    vol.mkdirSync(os.tmpdir(), { recursive: true });
  });

  it('loads defaults when no file exists', async () => {
    const tracker = new ProgressTracker('/project');
    await tracker.load();
    const data = tracker.getAllData();
    expect(data.version).toBe('1.0');
    expect(data.bookTitle).toBe('');
    expect(data.exercises).toEqual({});
  });

  it('loads existing progress file', async () => {
    const progressData = {
      version: '1.0',
      bookTitle: 'Rust Book',
      exercises: {
        'ch01-ex01': { status: 'completed', resetCount: 0, startedAt: '2024-01-01', completedAt: '2024-01-02' },
      },
    };
    vol.fromJSON({
      '/project/.learncode/progress.json': JSON.stringify(progressData),
    });
    const tracker = new ProgressTracker('/project');
    await tracker.load();
    expect(tracker.getExerciseStatus('ch01-ex01')).toBe('completed');
  });

  it('saves progress to JSON file', async () => {
    vol.mkdirSync('/project/.learncode', { recursive: true });
    const tracker = new ProgressTracker('/project');
    await tracker.load();
    tracker.setBookTitle('My Book');
    await tracker.updateExercise('ch01-ex01', 'in_progress');

    // Read what was saved
    const raw = vol.readFileSync('/project/.learncode/progress.json', 'utf-8') as string;
    const saved = JSON.parse(raw);
    expect(saved.bookTitle).toBe('My Book');
    expect(saved.exercises['ch01-ex01'].status).toBe('in_progress');
  });

  it('transitions status: not_started → in_progress → completed', async () => {
    vol.mkdirSync('/project/.learncode', { recursive: true });
    const tracker = new ProgressTracker('/project');
    await tracker.load();

    expect(tracker.getExerciseStatus('ch01-ex01')).toBe('not_started');

    await tracker.updateExercise('ch01-ex01', 'in_progress');
    expect(tracker.getExerciseStatus('ch01-ex01')).toBe('in_progress');

    await tracker.updateExercise('ch01-ex01', 'completed');
    expect(tracker.getExerciseStatus('ch01-ex01')).toBe('completed');
  });

  it('sets startedAt when moving to in_progress', async () => {
    vol.mkdirSync('/project/.learncode', { recursive: true });
    const tracker = new ProgressTracker('/project');
    await tracker.load();

    await tracker.updateExercise('ch01-ex01', 'in_progress');
    const progress = tracker.getExerciseProgress('ch01-ex01');
    expect(progress.startedAt).toBeTruthy();
  });

  it('sets completedAt when moving to completed', async () => {
    vol.mkdirSync('/project/.learncode', { recursive: true });
    const tracker = new ProgressTracker('/project');
    await tracker.load();

    await tracker.updateExercise('ch01-ex01', 'completed');
    const progress = tracker.getExerciseProgress('ch01-ex01');
    expect(progress.completedAt).toBeTruthy();
  });

  it('resets exercise: status, startedAt, completedAt, increments resetCount', async () => {
    vol.mkdirSync('/project/.learncode', { recursive: true });
    const tracker = new ProgressTracker('/project');
    await tracker.load();

    await tracker.updateExercise('ch01-ex01', 'completed');
    await tracker.resetExercise('ch01-ex01');

    const progress = tracker.getExerciseProgress('ch01-ex01');
    expect(progress.status).toBe('not_started');
    expect(progress.startedAt).toBeUndefined();
    expect(progress.completedAt).toBeUndefined();
    expect(progress.resetCount).toBe(1);
  });

  it('calculates chapter completion percentage', async () => {
    const tracker = new ProgressTracker('/project');
    await tracker.load();

    vol.mkdirSync('/project/.learncode', { recursive: true });
    await tracker.updateExercise('ex1', 'completed');
    await tracker.updateExercise('ex2', 'in_progress');

    const percent = tracker.getChapterCompletionPercent('ch01', ['ex1', 'ex2', 'ex3']);
    expect(percent).toBe(33); // 1/3
  });

  it('calculates overall completion percentage', async () => {
    const tracker = new ProgressTracker('/project');
    await tracker.load();

    vol.mkdirSync('/project/.learncode', { recursive: true });
    await tracker.updateExercise('ex1', 'completed');
    await tracker.updateExercise('ex2', 'completed');

    const percent = tracker.getOverallCompletionPercent(['ex1', 'ex2', 'ex3', 'ex4']);
    expect(percent).toBe(50);
  });

  it('returns 0% for empty exercise list', () => {
    const tracker = new ProgressTracker('/project');
    expect(tracker.getChapterCompletionPercent('ch01', [])).toBe(0);
    expect(tracker.getOverallCompletionPercent([])).toBe(0);
  });

  it('gets and sets reading position', async () => {
    vol.mkdirSync('/project/.learncode', { recursive: true });
    const tracker = new ProgressTracker('/project');
    await tracker.load();

    expect(tracker.getReadingPosition()).toBeUndefined();

    await tracker.setReadingPosition({ type: 'epub', spineIndex: 5, scrollFraction: 0.3 });
    const pos = tracker.getReadingPosition();
    expect(pos).toEqual({ type: 'epub', spineIndex: 5, scrollFraction: 0.3 });
  });
});
