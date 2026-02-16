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
          case 'linkClicked':
            await this.handleLinkClick(message.href);
            break;
          case 'openExternal':
            if (message.href) {
              vscode.env.openExternal(vscode.Uri.parse(message.href));
            }
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
    // Separate fragment from the file path
    const hashIndex = href.indexOf('#');
    const fragment = hashIndex >= 0 ? href.substring(hashIndex + 1) : '';
    const cleanHref = hashIndex >= 0 ? href.substring(0, hashIndex) : href;

    const idx = this.spineHrefs.findIndex(
      h => cleanHref.endsWith(h) || h.endsWith(cleanHref) || h === cleanHref
    );
    if (idx >= 0) {
      await this.navigateToIndex(idx, fragment);
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

  private async handleLinkClick(href: string): Promise<void> {
    // Resolve relative href against the current spine entry's directory.
    // Links in EPUB content are relative to the current file, e.g.
    // "513120_3_En_8_Chapter.xhtml#Fig10" from within the html/ directory.
    const currentSpineHref = this.spineHrefs[this.currentSpineIndex] || '';
    const currentDir = path.posix.dirname(currentSpineHref);

    const hashIndex = href.indexOf('#');
    const fragment = hashIndex >= 0 ? href.substring(hashIndex + 1) : '';
    const filePart = hashIndex >= 0 ? href.substring(0, hashIndex) : href;

    // Resolve the file part relative to the current spine entry's directory
    const resolvedFile = filePart
      ? path.posix.join(currentDir, filePart)
      : currentSpineHref;

    // Find matching spine entry
    const idx = this.spineHrefs.findIndex(h =>
      h === resolvedFile ||
      resolvedFile.endsWith(h) || h.endsWith(resolvedFile) ||
      resolvedFile.endsWith('/' + h) || h.endsWith('/' + resolvedFile)
    );

    if (idx >= 0) {
      await this.navigateToIndex(idx, fragment);
    } else {
      logger.warn(`Link target not found in spine: ${href} (resolved: ${resolvedFile})`);
    }
  }

  private async navigateToIndex(index: number, fragment?: string): Promise<void> {
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
    this.panel.webview.html = this.getWebviewHtml(withImages, index, fragment);
  }

  private getWebviewHtml(bookContent: string, spineIndex: number, fragment?: string): string {
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
<body${fragment ? ` data-fragment="${fragment.replace(/"/g, '&quot;')}"` : ''}>
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

  // Convert code-styled elements to <pre><code> blocks before we strip
  // classes.  EPUB stylesheets are removed, so code that relies on CSS
  // classes for monospace rendering must be converted structurally.

  // Springer-style: <div class="ParaTypeProgramcode"> wrapping
  // <div class="ProgramCode"> → <div class="LineGroup"> → <div class="FixedLine">
  // Each FixedLine is one code line with spans for tokens.
  $('div.ParaTypeProgramcode, div.ProgramCode').each((_, el) => {
    const elem = $(el);
    if (elem.parents('pre').length > 0) return;
    // Already handled by a parent match
    if (elem.is('.ProgramCode') && elem.parents('.ParaTypeProgramcode').length > 0
        && elem.parent().is('pre')) return;

    const lines: string[] = [];
    elem.find('div.FixedLine').each((__, lineEl) => {
      lines.push($(lineEl).text());
    });

    if (lines.length > 0) {
      const code = lines.join('\n');
      elem.replaceWith(`<pre><code>${escapeForPre(code)}</code></pre>`);
    }
  });

  // Generic class-based detection for other EPUB publishers
  const codeClassPattern = /\b(code|programlisting|sourcecode|literal-block|doctest|repl|console|screen|computeroutput|pre)\b/i;
  $('p, div, span').each((_, el) => {
    const elem = $(el);
    const cls = elem.attr('class') || '';
    if (!codeClassPattern.test(cls)) return;
    if (elem.parents('pre').length > 0) return;
    // Skip Springer elements already handled above
    if (/ParaTypeProgramcode|ProgramCode|FixedLine|LineGroup/i.test(cls)) return;
    const text = elem.text();
    if (!text.trim()) return;
    elem.replaceWith(`<pre><code>${escapeForPre(text)}</code></pre>`);
  });

  // Fallback: detect <p> elements containing >>> REPL lines
  $('p').each((_, el) => {
    const elem = $(el);
    if (elem.parents('pre').length > 0) return;
    const text = elem.text().trim();
    if (text.startsWith('>>>') || text.startsWith('...')) {
      elem.replaceWith(`<pre><code>${escapeForPre(elem.text())}</code></pre>`);
    }
  });

  // Merge adjacent <pre> blocks produced by the conversions above
  $('pre + pre').each((_, el) => {
    const elem = $(el);
    const prev = elem.prev('pre');
    if (prev.length > 0) {
      const prevCode = prev.find('code');
      const currCode = elem.find('code');
      const prevText = prevCode.length > 0 ? prevCode.text() : prev.text();
      const currText = currCode.length > 0 ? currCode.text() : elem.text();
      prev.html(`<code>${escapeForPre(prevText + '\n' + currText)}</code>`);
      elem.remove();
    }
  });

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

function escapeForPre(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
