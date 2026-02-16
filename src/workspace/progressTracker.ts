import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProgressData, ExerciseProgress, ExerciseStatus } from '../types/progress';
import * as logger from '../util/logger';

export class ProgressTracker {
  private progressPath: string;
  private data: ProgressData;

  constructor(baseDir: string) {
    this.progressPath = path.join(baseDir, '.learncode', 'progress.json');
    this.data = {
      version: '1.0',
      bookTitle: '',
      exercises: {},
    };
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.promises.readFile(this.progressPath, 'utf-8');
      this.data = JSON.parse(raw);
    } catch {
      // File doesn't exist yet — use defaults
    }
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.progressPath);
    await fs.promises.mkdir(dir, { recursive: true });

    // Atomic write: write to temp file then rename
    const tmpPath = path.join(os.tmpdir(), `learncode-progress-${Date.now()}.json`);
    await fs.promises.writeFile(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
    await fs.promises.rename(tmpPath, this.progressPath);
  }

  setBookTitle(title: string): void {
    this.data.bookTitle = title;
  }

  getExerciseStatus(exerciseId: string): ExerciseStatus {
    return this.data.exercises[exerciseId]?.status || 'not_started';
  }

  getExerciseProgress(exerciseId: string): ExerciseProgress {
    return this.data.exercises[exerciseId] || {
      status: 'not_started',
      resetCount: 0,
    };
  }

  async updateExercise(exerciseId: string, status: ExerciseStatus): Promise<void> {
    const existing = this.data.exercises[exerciseId] || {
      status: 'not_started',
      resetCount: 0,
    };

    existing.status = status;

    if (status === 'in_progress' && !existing.startedAt) {
      existing.startedAt = new Date().toISOString();
    }

    if (status === 'completed') {
      existing.completedAt = new Date().toISOString();
    }

    this.data.exercises[exerciseId] = existing;
    this.data.lastOpenedExercise = exerciseId;
    await this.save();
  }

  async resetExercise(exerciseId: string): Promise<void> {
    const existing = this.data.exercises[exerciseId];
    if (existing) {
      existing.status = 'not_started';
      existing.startedAt = undefined;
      existing.completedAt = undefined;
      existing.resetCount++;
      await this.save();
    }
  }

  setLastOpenedChapter(chapterId: string): void {
    this.data.lastOpenedChapter = chapterId;
  }

  getChapterCompletionPercent(chapterId: string, exerciseIds: string[]): number {
    if (exerciseIds.length === 0) return 0;
    const completed = exerciseIds.filter(
      id => this.getExerciseStatus(id) === 'completed'
    ).length;
    return Math.round((completed / exerciseIds.length) * 100);
  }

  getOverallCompletionPercent(allExerciseIds: string[]): number {
    if (allExerciseIds.length === 0) return 0;
    const completed = allExerciseIds.filter(
      id => this.getExerciseStatus(id) === 'completed'
    ).length;
    return Math.round((completed / allExerciseIds.length) * 100);
  }

  getAllData(): ProgressData {
    return this.data;
  }
}
