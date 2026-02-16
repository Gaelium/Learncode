import * as vscode from 'vscode';
import * as fs from 'fs';
import { ExerciseTreeItem } from '../views/sidebarTreeItems';
import { ExerciseTreeProvider } from '../views/sidebarTreeProvider';
import * as logger from '../util/logger';

export function registerOpenExerciseCommand(
  context: vscode.ExtensionContext,
  treeProvider: ExerciseTreeProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('learncode.openExercise', async (item?: ExerciseTreeItem) => {
    if (!item || !item.mainFilePath) {
      vscode.window.showWarningMessage('No exercise file to open.');
      return;
    }

    try {
      // Check if file exists
      try {
        await fs.promises.access(item.mainFilePath);
      } catch {
        vscode.window.showWarningMessage(`Exercise file not found: ${item.mainFilePath}`);
        return;
      }

      // Open the file
      const doc = await vscode.workspace.openTextDocument(item.mainFilePath);
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

      // Mark as in_progress
      const tracker = treeProvider.getTracker();
      if (tracker && item.status === 'not_started') {
        await tracker.updateExercise(item.exerciseId, 'in_progress');
        treeProvider.refresh();
      }

      logger.info(`Opened exercise: ${item.exerciseId}`);
    } catch (err) {
      logger.error('Failed to open exercise', err);
      vscode.window.showErrorMessage(`Failed to open exercise: ${err}`);
    }
  });
}
