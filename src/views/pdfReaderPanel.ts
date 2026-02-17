import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as logger from '../util/logger';
import { ProgressTracker } from '../workspace/progressTracker';
import { AnnotationStore } from '../workspace/annotationStore';

export class PdfReaderPanel {
  public static currentPanel: PdfReaderPanel | undefined;
  private static readonly viewType = 'learncode.pdfReader';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private baseDir: string;
  private pageCount = 0;
  private currentPage = 1;
  private tracker?: ProgressTracker;
  private annotationStore?: AnnotationStore;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    baseDir: string,
    tracker?: ProgressTracker,
    annotationStore?: AnnotationStore
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.baseDir = baseDir;
    this.tracker = tracker;
    this.annotationStore = annotationStore;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'navigate':
            this.currentPage = Math.max(1, Math.min(this.pageCount, this.currentPage + message.direction));
            break;
          case 'navigateToPage':
            if (message.page >= 1 && message.page <= this.pageCount) {
              this.currentPage = message.page;
            }
            break;
          case 'openExternal':
            if (message.href) {
              vscode.env.openExternal(vscode.Uri.parse(message.href));
            }
            break;
          case 'pageRendered':
            this.currentPage = message.page;
            if (this.tracker) {
              this.tracker.setReadingPosition({ type: 'pdf', page: message.page });
            }
            this.sendAnnotationsForPage(message.page);
            break;
          case 'addAnnotation':
            await this.handleAddAnnotation(message);
            break;
          case 'removeAnnotation':
            if (this.annotationStore) {
              await this.annotationStore.removeAnnotation(message.id);
              this.sendAnnotationsForPage(this.currentPage);
            }
            break;
        }
      },
      null,
      this.disposables
    );
  }

  private async handleAddAnnotation(message: any): Promise<void> {
    if (!this.annotationStore) return;
    const note = await vscode.window.showInputBox({
      prompt: 'Add a note (leave blank for highlight only)',
      placeHolder: 'Your note...',
    });
    if (note === undefined) return; // cancelled
    const annotation = await this.annotationStore.addAnnotation(
      message.selectedText,
      note,
      message.pageOrSpineIndex,
      message.textPrefix,
      message.textSuffix
    );
    this.panel.webview.postMessage({ command: 'highlightAnnotation', annotation });
  }

  private sendAnnotationsForPage(page: number): void {
    if (!this.annotationStore) return;
    const annotations = this.annotationStore.getAnnotationsForPage(page);
    this.panel.webview.postMessage({ command: 'loadAnnotations', annotations });
  }

  static async createOrShow(
    extensionUri: vscode.Uri,
    baseDir: string,
    targetPage?: number,
    tracker?: ProgressTracker,
    annotationStore?: AnnotationStore
  ): Promise<PdfReaderPanel> {
    const column = vscode.ViewColumn.Beside;

    if (PdfReaderPanel.currentPanel) {
      PdfReaderPanel.currentPanel.panel.reveal(column);
      if (targetPage) {
        PdfReaderPanel.currentPanel.navigateToPage(targetPage);
      }
      return PdfReaderPanel.currentPanel;
    }

    const bookDir = path.join(baseDir, '.learncode', 'book');
    const panel = vscode.window.createWebviewPanel(
      PdfReaderPanel.viewType,
      'PDF Reader',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.file(bookDir),
        ],
      }
    );

    const reader = new PdfReaderPanel(panel, extensionUri, baseDir, tracker, annotationStore);
    PdfReaderPanel.currentPanel = reader;

    await reader.loadPageCount();

    let initialPage = targetPage;
    if (!initialPage && tracker) {
      const pos = tracker.getReadingPosition();
      if (pos && pos.type === 'pdf' && pos.page) {
        initialPage = pos.page;
      }
    }

    reader.panel.webview.html = reader.getWebviewHtml(initialPage || 1);

    return reader;
  }

  navigateToPage(page: number): void {
    this.currentPage = page;
    this.panel.webview.postMessage({ command: 'navigateToPage', page });
  }

  private async loadPageCount(): Promise<void> {
    const spinePath = path.join(this.baseDir, '.learncode', 'spine.json');
    try {
      const raw = await fs.promises.readFile(spinePath, 'utf-8');
      const pages: number[] = JSON.parse(raw);
      this.pageCount = pages.length;
    } catch {
      this.pageCount = 0;
      logger.warn('Could not load spine.json for PDF');
    }
  }

  private getWebviewHtml(initialPage: number): string {
    const webview = this.panel.webview;
    const nonce = getNonce();

    const pdfUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.baseDir, '.learncode', 'book', 'book.pdf'))
    );
    const pdfjsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'pdfjs', 'pdf.js')
    );
    const pdfjsWorkerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'pdfjs', 'pdf.worker.js')
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'pdf-reader.css')
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'pdf-reader.js')
    );

    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource} blob:; worker-src blob:; img-src ${cspSource} blob: data:; font-src ${cspSource}; connect-src ${cspSource} blob:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${cssUri}">
  <title>PDF Reader</title>
</head>
<body data-pdf-url="${pdfUri}"
      data-worker-url="${pdfjsWorkerUri}"
      data-initial-page="${initialPage}"
      data-page-count="${this.pageCount}">
  <div class="navigation-bar">
    <button id="prevBtn" class="nav-btn">Previous</button>
    <span class="page-info">
      <input type="number" id="pageInput" min="1" max="${this.pageCount}" value="${initialPage}">
      / <span id="pageCount">${this.pageCount}</span>
    </span>
    <button id="nextBtn" class="nav-btn">Next</button>
  </div>
  <div id="pdf-container">
    <div id="page-view">
      <canvas id="pdf-canvas"></canvas>
      <div id="highlight-layer"></div>
      <div id="text-layer" class="textLayer"></div>
    </div>
  </div>
  <div class="navigation-bar bottom">
    <button id="prevBtnBottom" class="nav-btn">Previous</button>
    <span class="page-info">
      <span id="pageInfoBottom">${initialPage} / ${this.pageCount}</span>
    </span>
    <button id="nextBtnBottom" class="nav-btn">Next</button>
  </div>
  <script nonce="${nonce}">
    window.onerror = function(msg, src, line, col, err) {
      var el = document.getElementById('pdf-container');
      if (el) el.innerHTML = '<p style="padding:20px;color:var(--vscode-errorForeground);white-space:pre-wrap">'
        + 'Script error:\\n' + msg + '\\nSource: ' + src + '\\nLine: ' + line + '</p>';
      return true;
    };
  </script>
  <script nonce="${nonce}" src="${pdfjsUri}"></script>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }

  static revive(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    baseDir: string,
    tracker?: ProgressTracker,
    annotationStore?: AnnotationStore
  ): PdfReaderPanel {
    const reader = new PdfReaderPanel(panel, extensionUri, baseDir, tracker, annotationStore);
    PdfReaderPanel.currentPanel = reader;
    reader.loadPageCount().then(() => {
      let initialPage = 1;
      if (tracker) {
        const pos = tracker.getReadingPosition();
        if (pos && pos.type === 'pdf' && pos.page) {
          initialPage = pos.page;
        }
      }
      reader.panel.webview.html = reader.getWebviewHtml(initialPage);
    });
    return reader;
  }

  private dispose(): void {
    PdfReaderPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

function getNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}
