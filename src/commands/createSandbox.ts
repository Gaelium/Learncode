import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { LearnCodeTemplate } from '../types/template';
import { Exercise } from '../types/exercise';
import { Chapter } from '../analysis/structureMapper';
import { generateSandbox } from '../scaffold/sandboxGenerator';
import { ExerciseTreeProvider } from '../views/sidebarTreeProvider';
import * as logger from '../util/logger';

export function registerCreateSandboxCommand(
  context: vscode.ExtensionContext,
  treeProvider: ExerciseTreeProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('learncode.createSandbox', async () => {
    try {
      const baseDir = treeProvider.getBaseDir();
      if (!baseDir) {
        vscode.window.showWarningMessage('No LearnCode workspace loaded. Import a book first.');
        return;
      }

      const templatePath = path.join(baseDir, '.learncode', 'template.yaml');
      const raw = await fs.promises.readFile(templatePath, 'utf-8');
      const template = yaml.load(raw) as LearnCodeTemplate;

      // Convert template back to Chapter[] and Exercise[]
      const chapters: Chapter[] = template.chapters.map((ch, i) => ({
        id: ch.id,
        title: ch.title,
        href: ch.href,
        index: i,
        sections: ch.sections.map((sec, j) => ({
          id: sec.id,
          title: sec.title,
          href: '',
          chapterIndex: i,
          sectionIndex: j,
        })),
      }));

      const exercises: Exercise[] = [];
      for (const ch of template.chapters) {
        for (const ex of ch.exercises) {
          exercises.push(templateExerciseToExercise(ex, ch.id));
        }
        for (const sec of ch.sections) {
          for (const ex of sec.exercises) {
            exercises.push(templateExerciseToExercise(ex, ch.id, sec.id));
          }
        }
      }

      await generateSandbox(baseDir, chapters, exercises);
      treeProvider.refresh();

      vscode.window.showInformationMessage(
        `Regenerated ${exercises.length} exercise sandboxes.`
      );
      logger.info('Sandbox regenerated from template.yaml');
    } catch (err) {
      logger.error('Failed to create sandbox', err);
      vscode.window.showErrorMessage(`Failed to create sandbox: ${err}`);
    }
  });
}

function templateExerciseToExercise(
  ex: { id: string; title: string; language: string; files: { path: string; content: string; isMain: boolean }[]; expectedOutput?: string; instructions: string; bookmark: { chapterHref: string; heading: string }; codeBlockIds: string[] },
  chapterId: string,
  sectionId?: string
): Exercise {
  return {
    id: ex.id,
    title: ex.title,
    chapterId,
    sectionId,
    language: ex.language,
    files: ex.files.map(f => ({
      path: f.path,
      content: f.content,
      isMain: f.isMain,
    })),
    expectedOutput: ex.expectedOutput,
    instructions: ex.instructions,
    bookmark: ex.bookmark,
    dependencies: [],
    codeBlockIds: ex.codeBlockIds,
  };
}
