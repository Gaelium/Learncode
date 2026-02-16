import * as vscode from 'vscode';
import { ExerciseStatus } from '../types/progress';

export class ChapterTreeItem extends vscode.TreeItem {
  constructor(
    public readonly chapterId: string,
    public readonly chapterTitle: string,
    public readonly completionPercent: number,
    public readonly chapterHref: string
  ) {
    super(chapterTitle, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'chapter';
    this.description = `${completionPercent}%`;
    this.iconPath = new vscode.ThemeIcon('book');
    this.tooltip = `${chapterTitle} — ${completionPercent}% complete`;
  }
}

export class ExerciseTreeItem extends vscode.TreeItem {
  constructor(
    public readonly exerciseId: string,
    public readonly exerciseTitle: string,
    public readonly status: ExerciseStatus,
    public readonly language: string,
    public readonly mainFilePath: string | undefined,
    public readonly chapterHref: string
  ) {
    super(exerciseTitle, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'exercise';
    this.description = language;

    // Status icon
    switch (status) {
      case 'not_started':
        this.iconPath = new vscode.ThemeIcon('circle-outline');
        break;
      case 'in_progress':
        this.iconPath = new vscode.ThemeIcon('play-circle');
        break;
      case 'completed':
        this.iconPath = new vscode.ThemeIcon('check');
        break;
    }

    this.tooltip = `${exerciseTitle} [${status}] (${language})`;

    // Click opens exercise
    if (mainFilePath) {
      this.command = {
        command: 'learncode.openExercise',
        title: 'Open Exercise',
        arguments: [this],
      };
    }
  }
}
