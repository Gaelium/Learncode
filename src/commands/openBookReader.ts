import * as vscode from 'vscode';
import { BookReaderPanel } from '../views/bookReaderPanel';
import { ExerciseTreeProvider } from '../views/sidebarTreeProvider';
import { ChapterTreeItem } from '../views/sidebarTreeItems';
import * as logger from '../util/logger';

export function registerOpenBookReaderCommand(
  context: vscode.ExtensionContext,
  treeProvider: ExerciseTreeProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('learncode.openBookReader', async (item?: ChapterTreeItem) => {
    try {
      const baseDir = treeProvider.getBaseDir();
      if (!baseDir) {
        vscode.window.showWarningMessage('No LearnCode workspace loaded. Import a book first.');
        return;
      }

      const targetHref = item?.chapterHref;
      await BookReaderPanel.createOrShow(context.extensionUri, baseDir, targetHref);

      logger.info(`Opened book reader${targetHref ? ` at ${targetHref}` : ''}`);
    } catch (err) {
      logger.error('Failed to open book reader', err);
      vscode.window.showErrorMessage(`Failed to open book reader: ${err}`);
    }
  });
}
