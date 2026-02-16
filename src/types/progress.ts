export type ExerciseStatus = 'not_started' | 'in_progress' | 'completed';

export interface ExerciseProgress {
  status: ExerciseStatus;
  startedAt?: string;
  completedAt?: string;
  resetCount: number;
}

export interface ProgressData {
  version: string;
  bookTitle: string;
  exercises: Record<string, ExerciseProgress>;
  lastOpenedExercise?: string;
  lastOpenedChapter?: string;
}
