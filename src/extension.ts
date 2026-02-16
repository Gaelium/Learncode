import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { initLogger, dispose as disposeLogger, info } from './util/logger';
import { initTemplates } from './scaffold/templateRegistry';
import { ExerciseTreeProvider } from './views/sidebarTreeProvider';
import { BookReaderPanel } from './views/bookReaderPanel';
import { PdfReaderPanel } from './views/pdfReaderPanel';
import { registerImportBookCommand } from './commands/importBook';
import { registerOpenExerciseCommand } from './commands/openExercise';
import { registerResetExerciseCommand } from './commands/resetExercise';
import { registerOpenBookReaderCommand } from './commands/openBookReader';
import { registerCreateSandboxCommand } from './commands/createSandbox';
import { registerCreateWorksheetCommand } from './commands/createWorksheet';

export function activate(context: vscode.ExtensionContext) {
  // Initialize core systems
  initLogger();
  initTemplates();
  info('LearnCode extension activating...');

  // Create sidebar tree provider
  const treeProvider = new ExerciseTreeProvider();
  const treeView = vscode.window.createTreeView('learncode.exerciseTree', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Register all commands
  context.subscriptions.push(registerImportBookCommand(context, treeProvider));
  context.subscriptions.push(registerOpenExerciseCommand(context, treeProvider));
  context.subscriptions.push(registerResetExerciseCommand(context, treeProvider));
  context.subscriptions.push(registerOpenBookReaderCommand(context, treeProvider));
  context.subscriptions.push(registerCreateSandboxCommand(context, treeProvider));
  context.subscriptions.push(registerCreateWorksheetCommand(context, treeProvider));

  // Refresh tree command
  context.subscriptions.push(
    vscode.commands.registerCommand('learncode.refreshTree', () => {
      treeProvider.refresh();
    })
  );

  // Mark complete command
  context.subscriptions.push(
    vscode.commands.registerCommand('learncode.markComplete', async (item: any) => {
      if (item?.exerciseId) {
        const tracker = treeProvider.getTracker();
        if (tracker) {
          await tracker.updateExercise(item.exerciseId, 'completed');
          treeProvider.refresh();
        }
      }
    })
  );

  // Register WebView serializers for book reader persistence
  vscode.window.registerWebviewPanelSerializer('learncode.bookReader', {
    async deserializeWebviewPanel(panel: vscode.WebviewPanel, _state: any) {
      const baseDir = treeProvider.getBaseDir();
      if (baseDir) {
        BookReaderPanel.revive(panel, context.extensionUri, baseDir);
      }
    },
  });

  vscode.window.registerWebviewPanelSerializer('learncode.pdfReader', {
    async deserializeWebviewPanel(panel: vscode.WebviewPanel, _state: any) {
      const baseDir = treeProvider.getBaseDir();
      if (baseDir) {
        PdfReaderPanel.revive(panel, context.extensionUri, baseDir);
      }
    },
  });

  // Auto-detect LearnCode workspace on open
  autoDetectWorkspace(treeProvider);

  info('LearnCode extension activated.');
}

async function autoDetectWorkspace(treeProvider: ExerciseTreeProvider): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return;

  for (const folder of workspaceFolders) {
    const learncodeDir = path.join(folder.uri.fsPath, '.learncode');
    try {
      await fs.promises.access(learncodeDir);
      await treeProvider.loadWorkspace(folder.uri.fsPath);
      info(`Auto-detected LearnCode workspace: ${folder.uri.fsPath}`);
      return;
    } catch {
      // Not a LearnCode workspace
    }
  }
}

export function deactivate() {
  disposeLogger();
}
