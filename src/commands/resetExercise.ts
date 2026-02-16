import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ExerciseTreeItem } from '../views/sidebarTreeItems';
import { ExerciseTreeProvider } from '../views/sidebarTreeProvider';
import { LearnCodeTemplate } from '../types/template';
import { chapterDirName, exerciseDirName } from '../util/slugify';
import * as logger from '../util/logger';

export function registerResetExerciseCommand(
  context: vscode.ExtensionContext,
  treeProvider: ExerciseTreeProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('learncode.resetExercise', async (item?: ExerciseTreeItem) => {
    if (!item) {
      vscode.window.showWarningMessage('No exercise selected.');
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Reset exercise "${item.exerciseTitle}"? This will overwrite your changes.`,
      { modal: true },
      'Reset'
    );

    if (confirm !== 'Reset') return;

    try {
      const baseDir = treeProvider.getBaseDir();
      const template = treeProvider.getTemplate();
      if (!baseDir || !template) return;

      // Find the exercise in template
      const exerciseTemplate = findExerciseInTemplate(template, item.exerciseId);
      if (!exerciseTemplate) {
        vscode.window.showErrorMessage('Exercise not found in template.');
        return;
      }

      // Find chapter
      const chapter = template.chapters.find(ch =>
        ch.exercises.some(ex => ex.id === item.exerciseId) ||
        ch.sections.some(s => s.exercises.some(ex => ex.id === item.exerciseId))
      );
      if (!chapter) return;

      // Regenerate files
      const exDir = path.join(
        baseDir,
        chapterDirName(chapter.id, chapter.title),
        exerciseDirName(exerciseTemplate.id, exerciseTemplate.title)
      );

      for (const file of exerciseTemplate.files) {
        const filePath = path.join(exDir, file.path);
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, file.content, 'utf-8');
      }

      // Reset progress
      const tracker = treeProvider.getTracker();
      if (tracker) {
        await tracker.resetExercise(item.exerciseId);
      }

      treeProvider.refresh();
      vscode.window.showInformationMessage(`Exercise "${item.exerciseTitle}" has been reset.`);
      logger.info(`Reset exercise: ${item.exerciseId}`);
    } catch (err) {
      logger.error('Failed to reset exercise', err);
      vscode.window.showErrorMessage(`Failed to reset exercise: ${err}`);
    }
  });
}

function findExerciseInTemplate(template: LearnCodeTemplate, exerciseId: string) {
  for (const ch of template.chapters) {
    for (const ex of ch.exercises) {
      if (ex.id === exerciseId) return ex;
    }
    for (const sec of ch.sections) {
      for (const ex of sec.exercises) {
        if (ex.id === exerciseId) return ex;
      }
    }
  }
  return undefined;
}
