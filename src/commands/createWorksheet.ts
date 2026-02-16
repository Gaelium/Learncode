import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ExerciseTreeProvider } from '../views/sidebarTreeProvider';
import { ChapterTreeItem } from '../views/sidebarTreeItems';
import { ChapterTemplate, ExerciseTemplate, LearnCodeTemplate } from '../types/template';
import { getTemplate } from '../scaffold/templateRegistry';
import { exerciseId, exerciseDirName, chapterDirName, slugify } from '../util/slugify';
import * as logger from '../util/logger';

interface WorksheetTemplate {
  label: string;
  language: string;
  mainFile: string;
  starterContent: (title: string) => string;
}

const WORKSHEET_TEMPLATES: WorksheetTemplate[] = [
  {
    label: 'Coding Exercise (Python)',
    language: 'python',
    mainFile: '', // Will use ScaffoldTemplate
    starterContent: () => '',
  },
  {
    label: 'Coding Exercise (JavaScript)',
    language: 'javascript',
    mainFile: '',
    starterContent: () => '',
  },
  {
    label: 'Coding Exercise (Rust)',
    language: 'rust',
    mainFile: '',
    starterContent: () => '',
  },
  {
    label: 'Coding Exercise (Go)',
    language: 'go',
    mainFile: '',
    starterContent: () => '',
  },
  {
    label: 'Coding Exercise (C/C++)',
    language: 'c',
    mainFile: '',
    starterContent: () => '',
  },
  {
    label: 'SQL / Database',
    language: 'sql',
    mainFile: 'query.sql',
    starterContent: (title: string) => `-- ${title}\n\n`,
  },
  {
    label: 'Markdown Notes',
    language: 'markdown',
    mainFile: 'notes.md',
    starterContent: (title: string) => `# ${title}\n\n`,
  },
  {
    label: 'Blank',
    language: 'text',
    mainFile: 'worksheet.txt',
    starterContent: () => '',
  },
];

export function registerCreateWorksheetCommand(
  context: vscode.ExtensionContext,
  treeProvider: ExerciseTreeProvider
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'learncode.createWorksheet',
    async (item?: ChapterTreeItem) => {
      const baseDir = treeProvider.getBaseDir();
      const template = treeProvider.getTemplate();
      if (!baseDir || !template) {
        vscode.window.showWarningMessage(
          'No LearnCode workspace is open. Import a book first.'
        );
        return;
      }

      // Step 1: Determine chapter
      let chapter: ChapterTemplate | undefined;
      if (item instanceof ChapterTreeItem) {
        chapter = template.chapters.find(ch => ch.id === item.chapterId);
      } else {
        const chapters = treeProvider.getChapters();
        if (chapters.length === 0) {
          vscode.window.showWarningMessage('No chapters found in workspace.');
          return;
        }
        const picked = await vscode.window.showQuickPick(
          chapters.map(ch => ({ label: ch.title, description: ch.id, chapter: ch })),
          { placeHolder: 'Select a chapter' }
        );
        if (!picked) return;
        chapter = picked.chapter;
      }
      if (!chapter) return;

      // Step 2: Pick template type
      const templatePick = await vscode.window.showQuickPick(
        WORKSHEET_TEMPLATES.map(t => ({ label: t.label, template: t })),
        { placeHolder: 'Select worksheet type' }
      );
      if (!templatePick) return;
      const worksheetTmpl = templatePick.template;

      // Step 3: Enter title
      const title = await vscode.window.showInputBox({
        prompt: 'Worksheet title',
        placeHolder: 'e.g. 2D Rotation Matrix, SELECT Queries',
        validateInput: (value) => {
          if (!value.trim()) return 'Title cannot be empty';
          return undefined;
        },
      });
      if (!title) return;

      // Step 4: Generate next exercise ID
      const existingIds = getAllExerciseIds(chapter);
      const chapterIndex = parseChapterIndex(chapter.id);
      const nextExIndex = existingIds.length;
      const newId = exerciseId(chapterIndex, nextExIndex);
      const exDirName = exerciseDirName(newId, title);
      const chDirName = chapterDirName(chapter.id, chapter.title);
      const exDir = path.join(baseDir, chDirName, exDirName);

      await fs.promises.mkdir(exDir, { recursive: true });

      // Step 5: Create files
      let mainFilePath: string;
      let mainFileRelPath: string;
      const files: { path: string; content: string; isMain: boolean }[] = [];

      const scaffoldTemplate = getTemplate(worksheetTmpl.language);
      if (scaffoldTemplate) {
        // Use scaffold template for code languages
        const exerciseName = newId.replace(/[^a-z0-9_-]/g, '_');
        for (const tmplFile of scaffoldTemplate.files) {
          const filePath = path.join(exDir, tmplFile.path);
          await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
          await fs.promises.writeFile(filePath, tmplFile.template(exerciseName), 'utf-8');
          files.push({
            path: tmplFile.path,
            content: tmplFile.template(exerciseName),
            isMain: tmplFile.isMain || false,
          });
        }
        const mainTmplFile = scaffoldTemplate.files.find(f => f.isMain) || scaffoldTemplate.files[0];
        mainFileRelPath = mainTmplFile.path;
        mainFilePath = path.join(exDir, mainFileRelPath);
      } else {
        // Non-code templates (SQL, Markdown, Blank)
        const content = worksheetTmpl.starterContent(title);
        mainFileRelPath = worksheetTmpl.mainFile;
        mainFilePath = path.join(exDir, mainFileRelPath);
        await fs.promises.writeFile(mainFilePath, content, 'utf-8');
        files.push({ path: mainFileRelPath, content, isMain: true });
      }

      // Write INSTRUCTIONS.md
      const instructionsContent = `# ${title}\n`;
      await fs.promises.writeFile(
        path.join(exDir, 'INSTRUCTIONS.md'),
        instructionsContent,
        'utf-8'
      );

      // Step 6: Update template.yaml
      const newExercise: ExerciseTemplate = {
        id: newId,
        title,
        language: worksheetTmpl.language,
        type: 'worksheet',
        files,
        instructions: title,
        bookmark: { chapterHref: chapter.href, heading: '' },
        codeBlockIds: [],
      };

      chapter.exercises.push(newExercise);

      const templatePath = path.join(baseDir, '.learncode', 'template.yaml');
      const yamlContent = yaml.dump(template, {
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
      });
      await fs.promises.writeFile(templatePath, yamlContent, 'utf-8');

      // Step 7: Update progress tracker
      const tracker = treeProvider.getTracker();
      if (tracker) {
        await tracker.updateExercise(newId, 'not_started');
      }

      // Step 8: Reload workspace, refresh tree, open file
      await treeProvider.loadWorkspace(baseDir);

      const doc = await vscode.workspace.openTextDocument(mainFilePath);
      await vscode.window.showTextDocument(doc);

      logger.info(`Created worksheet "${title}" (${newId}) in ${chapter.title}`);
      vscode.window.showInformationMessage(`Worksheet "${title}" created.`);
    }
  );
}

function getAllExerciseIds(chapter: ChapterTemplate): string[] {
  const ids = chapter.exercises.map(ex => ex.id);
  for (const section of chapter.sections) {
    ids.push(...section.exercises.map(ex => ex.id));
  }
  return ids;
}

function parseChapterIndex(chapterId: string): number {
  const match = chapterId.match(/^ch(\d+)/);
  if (match) {
    return parseInt(match[1], 10) - 1;
  }
  return 0;
}
