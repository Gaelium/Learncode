import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import * as logger from '../util/logger';
import { replaceImgMath, renderMathInHtml } from './mathRenderer';

export class BookReaderPanel {
  public static currentPanel: BookReaderPanel | undefined;
  private static readonly viewType = 'learncode.bookReader';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private baseDir: string;
  private spineHrefs: string[] = [];
  private currentSpineIndex = 0;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    baseDir: string
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.baseDir = baseDir;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'navigate':
            await this.navigateRelative(message.direction);
            break;
          case 'navigateTo':
            await this.navigateToIndex(message.index);
            break;
        }
      },
      null,
      this.disposables
    );
  }

  static async createOrShow(
    extensionUri: vscode.Uri,
    baseDir: string,
    targetHref?: string
  ): Promise<BookReaderPanel> {
    const column = vscode.ViewColumn.Beside;

    if (BookReaderPanel.currentPanel) {
      BookReaderPanel.currentPanel.panel.reveal(column);
      if (targetHref) {
        await BookReaderPanel.currentPanel.navigateToHref(targetHref);
      }
      return BookReaderPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      BookReaderPanel.viewType,
      'Book Reader',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.file(path.join(baseDir, '.learncode', 'book')),
        ],
      }
    );

    const reader = new BookReaderPanel(panel, extensionUri, baseDir);
    BookReaderPanel.currentPanel = reader;

    await reader.loadSpine();

    if (targetHref) {
      await reader.navigateToHref(targetHref);
    } else {
      await reader.navigateToIndex(0);
    }

    return reader;
  }

  private async loadSpine(): Promise<void> {
    const spinePath = path.join(this.baseDir, '.learncode', 'spine.json');
    try {
      const raw = await fs.promises.readFile(spinePath, 'utf-8');
      this.spineHrefs = JSON.parse(raw);
    } catch {
      this.spineHrefs = [];
      logger.warn('Could not load spine.json');
    }
  }

  async navigateToHref(href: string): Promise<void> {
    const idx = this.spineHrefs.findIndex(
      h => href.endsWith(h) || h.endsWith(href) || h === href
    );
    if (idx >= 0) {
      await this.navigateToIndex(idx);
    } else {
      logger.warn(`Could not find spine index for href: ${href}`);
      await this.navigateToIndex(0);
    }
  }

  private async navigateRelative(direction: number): Promise<void> {
    const newIndex = this.currentSpineIndex + direction;
    if (newIndex >= 0 && newIndex < this.spineHrefs.length) {
      await this.navigateToIndex(newIndex);
    }
  }

  private async navigateToIndex(index: number): Promise<void> {
    if (index < 0 || index >= this.spineHrefs.length) return;
    this.currentSpineIndex = index;

    const href = this.spineHrefs[index];
    const bookDir = path.join(this.baseDir, '.learncode', 'book');

    // Try to find the content file, tracking its actual disk path
    let html = '<p>Content not available.</p>';
    let contentFileDir = bookDir;
    const contentPath = path.join(bookDir, href);
    try {
      html = await fs.promises.readFile(contentPath, 'utf-8');
      contentFileDir = path.dirname(contentPath);
    } catch {
      // Try with opfDir prefix already included in stored path
      const found = await findFile(bookDir, href);
      if (found) {
        html = await fs.promises.readFile(found, 'utf-8');
        contentFileDir = path.dirname(found);
      }
    }

    const sanitized = sanitizeHtml(html);
    const withImgMath = replaceImgMath(sanitized);
    const withMath = renderMathInHtml(withImgMath);
    const withImages = this.rewriteImageSrcs(withMath, contentFileDir);
    this.panel.webview.html = this.getWebviewHtml(withImages, index);
  }

  private getWebviewHtml(bookContent: string, spineIndex: number): string {
    const cssUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'book-reader.css')
    );
    const katexCssUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'katex.min.css')
    );
    const jsUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'book-reader.js')
    );

    const hasPrev = spineIndex > 0;
    const hasNext = spineIndex < this.spineHrefs.length - 1;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src ${this.panel.webview.cspSource}; img-src ${this.panel.webview.cspSource}; font-src ${this.panel.webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${katexCssUri}">
  <link rel="stylesheet" href="${cssUri}">
  <title>Book Reader</title>
</head>
<body>
  <div class="navigation-bar">
    <button id="prevBtn" class="nav-btn" ${hasPrev ? '' : 'disabled'}>Previous</button>
    <span class="page-info">${spineIndex + 1} / ${this.spineHrefs.length}</span>
    <button id="nextBtn" class="nav-btn" ${hasNext ? '' : 'disabled'}>Next</button>
  </div>
  <div class="book-content">
    ${bookContent}
  </div>
  <div class="navigation-bar bottom">
    <button id="prevBtnBottom" class="nav-btn" ${hasPrev ? '' : 'disabled'}>Previous</button>
    <span class="page-info">${spineIndex + 1} / ${this.spineHrefs.length}</span>
    <button id="nextBtnBottom" class="nav-btn" ${hasNext ? '' : 'disabled'}>Next</button>
  </div>
  <script src="${jsUri}"></script>
</body>
</html>`;
  }

  private rewriteImageSrcs(html: string, contentFileDir: string): string {
    return html.replace(/<img\s([^>]*?)src=["']([^"']+)["']/gi, (match, before, src) => {
      // Skip data URIs and already-absolute URIs
      if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('vscode-webview')) {
        return match;
      }

      // Resolve relative path against the actual content file's directory on disk
      const absPath = path.resolve(contentFileDir, src);
      const webviewUri = this.panel.webview.asWebviewUri(vscode.Uri.file(absPath));
      return `<img ${before}src="${webviewUri}"`;
    });
  }

  static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, baseDir: string): BookReaderPanel {
    const reader = new BookReaderPanel(panel, extensionUri, baseDir);
    BookReaderPanel.currentPanel = reader;
    reader.loadSpine().then(() => reader.navigateToIndex(0));
    return reader;
  }

  private dispose(): void {
    BookReaderPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

function sanitizeHtml(html: string): string {
  const $ = cheerio.load(html, { xmlMode: false });

  // Remove scripts and styles — EPUB stylesheets are designed for
  // white-background readers and conflict with VS Code theming
  $('script').remove();
  $('style').remove();
  $('link[rel="stylesheet"]').remove();

  // Remove potentially dangerous attributes
  $('*').each((_, el) => {
    const elem = $(el);
    const onAttrs = Object.keys(elem.attr() || {}).filter(a => a.startsWith('on'));
    for (const attr of onAttrs) {
      elem.removeAttr(attr);
    }
  });

  // Extract body content (or whole doc if no body)
  const body = $('body');
  return body.length > 0 ? body.html() || '' : $.html() || '';
}

async function findFile(baseDir: string, href: string): Promise<string | null> {
  // Try to find the file by walking possible paths
  const segments = href.split('/');
  const fileName = segments[segments.length - 1];

  async function search(dir: string): Promise<string | null> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = await search(fullPath);
          if (found) return found;
        } else if (entry.name === fileName) {
          return fullPath;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  return search(baseDir);
}
