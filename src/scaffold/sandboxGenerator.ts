import * as fs from 'fs';
import * as path from 'path';
import { Exercise } from '../types/exercise';
import { Chapter } from '../analysis/structureMapper';
import { getTemplate } from './templateRegistry';
import { chapterDirName, exerciseDirName } from '../util/slugify';
import * as logger from '../util/logger';

export async function generateSandbox(
  baseDir: string,
  chapters: Chapter[],
  exercises: Exercise[]
): Promise<void> {
  const learncodeDir = path.join(baseDir, '.learncode');
  await fs.promises.mkdir(learncodeDir, { recursive: true });

  // Group exercises by chapter
  const exercisesByChapter = new Map<string, Exercise[]>();
  for (const ex of exercises) {
    const existing = exercisesByChapter.get(ex.chapterId) || [];
    existing.push(ex);
    exercisesByChapter.set(ex.chapterId, existing);
  }

  for (const chapter of chapters) {
    const chapterExercises = exercisesByChapter.get(chapter.id) || [];
    if (chapterExercises.length === 0) continue;

    const chDir = path.join(baseDir, chapterDirName(chapter.id, chapter.title));
    await fs.promises.mkdir(chDir, { recursive: true });

    for (const exercise of chapterExercises) {
      const exDir = path.join(chDir, exerciseDirName(exercise.id, exercise.title));
      await generateExerciseDir(exDir, exercise);
    }
  }

  // Create shared directory
  const sharedDir = path.join(baseDir, 'shared');
  await fs.promises.mkdir(sharedDir, { recursive: true });

  logger.info(`Generated sandbox in ${baseDir} with ${exercises.length} exercises`);
}

async function generateExerciseDir(dir: string, exercise: Exercise): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });

  const template = getTemplate(exercise.language);
  const exerciseName = exercise.id.replace(/[^a-z0-9_-]/g, '_');

  if (template) {
    // Generate template files first
    for (const tmplFile of template.files) {
      const filePath = path.join(dir, tmplFile.path);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

      if (tmplFile.isMain) {
        // Use the exercise's extracted code for the main file
        const mainExerciseFile = exercise.files.find(f => f.isMain);
        const content = mainExerciseFile?.content || tmplFile.template(exerciseName);
        await fs.promises.writeFile(filePath, content, 'utf-8');
      } else {
        await fs.promises.writeFile(filePath, tmplFile.template(exerciseName), 'utf-8');
      }
    }

    // Write any additional exercise files not covered by template
    for (const exFile of exercise.files) {
      if (exFile.isMain) continue; // Already handled
      const filePath = path.join(dir, exFile.path);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, exFile.content, 'utf-8');
    }
  } else {
    // No template — just write exercise files directly
    for (const exFile of exercise.files) {
      const filePath = path.join(dir, exFile.path);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, exFile.content, 'utf-8');
    }
  }

  // Write expected output if present
  if (exercise.expectedOutput) {
    await fs.promises.writeFile(
      path.join(dir, '.expected_output'),
      exercise.expectedOutput,
      'utf-8'
    );
  }

  // Write instructions
  if (exercise.instructions) {
    await fs.promises.writeFile(
      path.join(dir, 'INSTRUCTIONS.md'),
      `# ${exercise.title}\n\n${exercise.instructions}\n`,
      'utf-8'
    );
  }
}
