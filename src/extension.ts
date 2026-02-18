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
import { registerOpenProjectCommand, registerProject } from './commands/openProject';
import { AnnotationStore } from './workspace/annotationStore';

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
  context.subscriptions.push(registerOpenProjectCommand(context));

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
        const tracker = treeProvider.getTracker();
        const store = new AnnotationStore(baseDir);
        await store.load();
        BookReaderPanel.revive(panel, context.extensionUri, baseDir, tracker, store);
      }
    },
  });

  vscode.window.registerWebviewPanelSerializer('learncode.pdfReader', {
    async deserializeWebviewPanel(panel: vscode.WebviewPanel, _state: any) {
      const baseDir = treeProvider.getBaseDir();
      if (baseDir) {
        const tracker = treeProvider.getTracker();
        const store = new AnnotationStore(baseDir);
        await store.load();
        PdfReaderPanel.revive(panel, context.extensionUri, baseDir, tracker, store);
      }
    },
  });

  // View all annotations command
  context.subscriptions.push(
    vscode.commands.registerCommand('learncode.viewAnnotations', async () => {
      const baseDir = treeProvider.getBaseDir();
      if (!baseDir) {
        vscode.window.showWarningMessage('No LearnCode workspace loaded.');
        return;
      }

      const store = new AnnotationStore(baseDir);
      await store.load();
      const annotations = store.getAllAnnotations();

      if (annotations.length === 0) {
        vscode.window.showInformationMessage('No annotations yet. Select text in the reader and click "Add Note" to create one.');
        return;
      }

      // Detect format to label correctly
      const metadataPath = path.join(baseDir, '.learncode', 'metadata.json');
      let format: 'pdf' | 'epub' = 'epub';
      try {
        const raw = await fs.promises.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(raw);
        if (metadata.format === 'pdf') { format = 'pdf'; }
      } catch { /* default epub */ }

      const label = format === 'pdf' ? 'Page' : 'Section';

      interface AnnotationQuickPickItem extends vscode.QuickPickItem {
        pageOrSpineIndex: number;
      }

      const items: AnnotationQuickPickItem[] = annotations.map(a => ({
        label: a.selectedText.length > 60 ? a.selectedText.substring(0, 60) + '...' : a.selectedText,
        description: a.note || '(highlight only)',
        detail: `${label} ${format === 'pdf' ? a.pageOrSpineIndex : a.pageOrSpineIndex + 1}`,
        pageOrSpineIndex: a.pageOrSpineIndex,
      }));

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: `${annotations.length} annotation${annotations.length === 1 ? '' : 's'} — select to navigate`,
      });

      if (picked) {
        if (format === 'pdf') {
          if (PdfReaderPanel.currentPanel) {
            PdfReaderPanel.currentPanel.navigateToPage(picked.pageOrSpineIndex);
          } else {
            const tracker = treeProvider.getTracker();
            const annotationStore = new AnnotationStore(baseDir);
            await annotationStore.load();
            await PdfReaderPanel.createOrShow(context.extensionUri, baseDir, picked.pageOrSpineIndex, tracker, annotationStore);
          }
        } else {
          if (BookReaderPanel.currentPanel) {
            await BookReaderPanel.currentPanel.navigateToSpineIndex(picked.pageOrSpineIndex);
          } else {
            const tracker = treeProvider.getTracker();
            const annotationStore = new AnnotationStore(baseDir);
            await annotationStore.load();
            const panel = await BookReaderPanel.createOrShow(context.extensionUri, baseDir, undefined, tracker, annotationStore);
            await panel.navigateToSpineIndex(picked.pageOrSpineIndex);
          }
        }
      }
    })
  );

  // Auto-detect LearnCode workspace on open
  autoDetectWorkspace(context, treeProvider);

  info('LearnCode extension activated.');
}

async function autoDetectWorkspace(context: vscode.ExtensionContext, treeProvider: ExerciseTreeProvider): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return;

  for (const folder of workspaceFolders) {
    const learncodeDir = path.join(folder.uri.fsPath, '.learncode');
    try {
      await fs.promises.access(learncodeDir);
      await treeProvider.loadWorkspace(folder.uri.fsPath);
      info(`Auto-detected LearnCode workspace: ${folder.uri.fsPath}`);

      // Register this workspace in the project list
      try {
        const metadataPath = path.join(learncodeDir, 'metadata.json');
        const raw = await fs.promises.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(raw);
        registerProject(
          context,
          folder.uri.fsPath,
          metadata.title || path.basename(folder.uri.fsPath),
          metadata.format === 'pdf' ? 'pdf' : 'epub',
        );
      } catch {
        // metadata read failed — still register with fallback info
        registerProject(context, folder.uri.fsPath, path.basename(folder.uri.fsPath), 'epub');
      }

      return;
    } catch {
      // Not a LearnCode workspace
    }
  }
}

export function deactivate() {
  disposeLogger();
}
