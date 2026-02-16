import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { LearnCodeTemplate, ChapterTemplate, ExerciseTemplate } from '../types/template';
import { ProgressTracker } from '../workspace/progressTracker';
import { ChapterTreeItem, ExerciseTreeItem } from './sidebarTreeItems';
import { chapterDirName, exerciseDirName } from '../util/slugify';
import * as logger from '../util/logger';

export class ExerciseTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private template: LearnCodeTemplate | undefined;
  private tracker: ProgressTracker | undefined;
  private baseDir: string | undefined;

  async loadWorkspace(workspaceDir: string): Promise<void> {
    this.baseDir = workspaceDir;
    const templatePath = path.join(workspaceDir, '.learncode', 'template.yaml');

    try {
      const raw = await fs.promises.readFile(templatePath, 'utf-8');
      this.template = yaml.load(raw) as LearnCodeTemplate;
    } catch (err) {
      logger.warn(`Failed to load template.yaml: ${err}`);
      this.template = undefined;
    }

    this.tracker = new ProgressTracker(workspaceDir);
    await this.tracker.load();

    this._onDidChangeTreeData.fire(undefined);
  }

  refresh(): void {
    if (this.baseDir && this.tracker) {
      this.tracker.load().then(() => {
        this._onDidChangeTreeData.fire(undefined);
      });
    } else {
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!this.template || !this.tracker || !this.baseDir) {
      return [];
    }

    if (!element) {
      // Root level: all chapters (even those without exercises yet,
      // so users can right-click to create worksheets)
      return this.template.chapters.map(ch => {
        const exerciseIds = this.getAllExerciseIds(ch);
        const completion = this.tracker!.getChapterCompletionPercent(ch.id, exerciseIds);
        return new ChapterTreeItem(ch.id, ch.title, completion, ch.href);
      });
    }

    if (element instanceof ChapterTreeItem) {
      // Chapter children: exercises
      const chapter = this.template.chapters.find(ch => ch.id === element.chapterId);
      if (!chapter) return [];

      const items: vscode.TreeItem[] = [];

      // Top-level exercises
      for (const ex of chapter.exercises) {
        items.push(this.createExerciseItem(ex, chapter));
      }

      // Section exercises
      for (const section of chapter.sections) {
        for (const ex of section.exercises) {
          items.push(this.createExerciseItem(ex, chapter));
        }
      }

      return items;
    }

    return [];
  }

  private createExerciseItem(ex: ExerciseTemplate, chapter: ChapterTemplate): ExerciseTreeItem {
    const status = this.tracker!.getExerciseStatus(ex.id);
    const mainFile = ex.files.find(f => f.isMain);
    let mainFilePath: string | undefined;

    if (this.baseDir && mainFile) {
      mainFilePath = path.join(
        this.baseDir,
        chapterDirName(chapter.id, chapter.title),
        exerciseDirName(ex.id, ex.title),
        mainFile.path
      );
    }

    return new ExerciseTreeItem(
      ex.id,
      ex.title,
      status,
      ex.language,
      mainFilePath,
      ex.bookmark.chapterHref
    );
  }

  private getAllExerciseIds(ch: ChapterTemplate): string[] {
    const ids = ch.exercises.map(ex => ex.id);
    for (const section of ch.sections) {
      ids.push(...section.exercises.map(ex => ex.id));
    }
    return ids;
  }

  getTracker(): ProgressTracker | undefined {
    return this.tracker;
  }

  getTemplate(): LearnCodeTemplate | undefined {
    return this.template;
  }

  getBaseDir(): string | undefined {
    return this.baseDir;
  }

  getChapters(): ChapterTemplate[] {
    return this.template?.chapters ?? [];
  }
}
