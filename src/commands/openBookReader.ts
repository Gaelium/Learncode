import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BookReaderPanel } from '../views/bookReaderPanel';
import { PdfReaderPanel } from '../views/pdfReaderPanel';
import { ExerciseTreeProvider } from '../views/sidebarTreeProvider';
import { ChapterTreeItem } from '../views/sidebarTreeItems';
import { AnnotationStore } from '../workspace/annotationStore';
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
      const format = await detectFormat(baseDir);
      logger.info(`Book format detected: "${format}", baseDir: ${baseDir}`);

      const tracker = treeProvider.getTracker();
      const annotationStore = new AnnotationStore(baseDir);
      await annotationStore.load();

      if (format === 'pdf') {
        // Parse page number from "page-N" href
        const targetPage = targetHref ? parsePageFromHref(targetHref) : undefined;
        await PdfReaderPanel.createOrShow(context.extensionUri, baseDir, targetPage, tracker, annotationStore);
        logger.info(`Opened PDF reader${targetPage ? ` at page ${targetPage}` : ''}`);
      } else {
        await BookReaderPanel.createOrShow(context.extensionUri, baseDir, targetHref, tracker, annotationStore);
        logger.info(`Opened book reader${targetHref ? ` at ${targetHref}` : ''}`);
      }
    } catch (err) {
      logger.error('Failed to open book reader', err);
      vscode.window.showErrorMessage(`Failed to open book reader: ${err}`);
    }
  });
}

async function detectFormat(baseDir: string): Promise<'epub' | 'pdf'> {
  const metadataPath = path.join(baseDir, '.learncode', 'metadata.json');
  try {
    const raw = await fs.promises.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(raw);
    if (metadata.format === 'pdf') return 'pdf';
  } catch {
    // Fall through to default
  }
  return 'epub';
}

function parsePageFromHref(href: string): number | undefined {
  const match = href.match(/^page-(\d+)$/);
  return match ? parseInt(match[1], 10) : undefined;
}
