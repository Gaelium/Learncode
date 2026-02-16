import * as fs from 'fs';
import * as path from 'path';
import * as logger from '../util/logger';

// pdf.js needs browser APIs (DOMMatrix, Path2D) that don't exist in Node.js.
// The legacy build tries to polyfill from @napi-rs/canvas, but its polyfill
// uses process.getBuiltinModule() (Node 22+) which fails in VS Code's
// extension host (Node 18-20). We polyfill manually before importing.
let pdfjsLib: typeof import('pdfjs-dist') | undefined;

function ensureBrowserPolyfills(): void {
  const g = globalThis as any;

  // pdf.js destructures `{ platform, userAgent }` from `navigator` at load time.
  // Node 21+ exposes `navigator` as a read-only getter on globalThis with only
  // `hardwareConcurrency`, `language`, and `userAgent` — no `platform`.
  // We can't replace the getter, so we redefine it with a full replacement object.
  const platformStr = process.platform === 'darwin' ? 'MacIntel' : process.platform === 'win32' ? 'Win32' : 'Linux';
  const existingNav = (typeof g.navigator !== 'undefined') ? g.navigator : {};
  const navShim = {
    language: existingNav.language || 'en-US',
    userAgent: existingNav.userAgent || '',
    platform: existingNav.platform || platformStr,
    hardwareConcurrency: existingNav.hardwareConcurrency || 1,
  };
  // Override the read-only getter by redefining the property
  Object.defineProperty(globalThis, 'navigator', {
    value: navShim,
    writable: true,
    configurable: true,
  });

  // DOMMatrix, ImageData, Path2D — needed by pdf.js internals.
  // The legacy build tries to polyfill via @napi-rs/canvas using
  // process.getBuiltinModule() (Node 22+), which doesn't exist in
  // VS Code's extension host (Node 18-20). Load it ourselves.
  if (typeof g.DOMMatrix === 'undefined') {
    try {
      const canvas = require('@napi-rs/canvas');
      if (canvas.DOMMatrix) g.DOMMatrix = canvas.DOMMatrix;
      if (canvas.ImageData && typeof g.ImageData === 'undefined') g.ImageData = canvas.ImageData;
      if (canvas.Path2D && typeof g.Path2D === 'undefined') g.Path2D = canvas.Path2D;
    } catch {
      // @napi-rs/canvas not available — provide a minimal DOMMatrix stub.
      // Sufficient for text extraction and outline parsing (no rendering).
      g.DOMMatrix = class DOMMatrix {
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
        m11 = 1; m12 = 0; m13 = 0; m14 = 0;
        m21 = 0; m22 = 1; m23 = 0; m24 = 0;
        m31 = 0; m32 = 0; m33 = 1; m34 = 0;
        m41 = 0; m42 = 0; m43 = 0; m44 = 1;
        is2D = true; isIdentity = true;
        inverse() { return new DOMMatrix(); }
        multiply() { return new DOMMatrix(); }
        scale() { return new DOMMatrix(); }
        translate() { return new DOMMatrix(); }
        transformPoint(p: any) { return p || { x: 0, y: 0, z: 0, w: 1 }; }
        static fromMatrix() { return new DOMMatrix(); }
        static fromFloat64Array() { return new DOMMatrix(); }
        static fromFloat32Array() { return new DOMMatrix(); }
      };
    }
  }
}

async function getPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsLib) {
    ensureBrowserPolyfills();
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // The fake worker needs a resolvable path to the worker module.
    // The legacy build should set this automatically for Node.js, but VS Code's
    // Electron extension host isn't detected as isNodeJS.
    const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
  }
  return pdfjsLib;
}

export interface PdfOutlineItem {
  title: string;
  dest: string | any[] | null;
  pageNumber?: number;
  items: PdfOutlineItem[];
}

export interface PdfParseResult {
  metadata: { title: string; creator: string; language: string; pageCount: number };
  outline: PdfOutlineItem[];
  pageCount: number;
  textByPage: Map<number, string>;
}

/**
 * Parse a PDF file, extracting metadata, outline, and text content per page.
 */
export async function parsePdf(pdfPath: string): Promise<PdfParseResult> {
  const pdfjs = await getPdfjs();

  const data = new Uint8Array(await fs.promises.readFile(pdfPath));
  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    disableAutoFetch: true,
    useWorkerFetch: false,
  }).promise;

  // Extract metadata
  const info = await doc.getMetadata();
  const pdfInfo = (info.info as any) || {};
  const title = pdfInfo.Title || path.basename(pdfPath, '.pdf');
  const creator = pdfInfo.Author || '';
  const language = pdfInfo.Language || 'en';
  const pageCount = doc.numPages;

  // Extract outline
  const rawOutline = await doc.getOutline();
  const outline = await resolveOutline(doc, rawOutline || []);

  // Extract text per page
  const textByPage = new Map<number, string>();
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => {
        if ('str' in item) {
          return item.hasEOL ? item.str + '\n' : item.str;
        }
        return '';
      })
      .join('');
    textByPage.set(i, text);
  }

  logger.info(`Parsed PDF: "${title}" — ${pageCount} pages, ${outline.length} top-level outline entries`);

  return {
    metadata: { title, creator, language, pageCount },
    outline,
    pageCount,
    textByPage,
  };
}

/**
 * Quick metadata extraction without reading all pages — used for title preview.
 */
export async function parsePdfMetadata(pdfPath: string): Promise<{ title: string; creator: string }> {
  const pdfjs = await getPdfjs();

  const data = new Uint8Array(await fs.promises.readFile(pdfPath));
  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    disableAutoFetch: true,
    useWorkerFetch: false,
  }).promise;

  const info = await doc.getMetadata();
  const pdfInfo = (info.info as any) || {};
  const title = pdfInfo.Title || path.basename(pdfPath, '.pdf');
  const creator = pdfInfo.Author || '';

  doc.destroy();
  return { title, creator };
}

async function resolveOutline(
  doc: any,
  items: any[]
): Promise<PdfOutlineItem[]> {
  const result: PdfOutlineItem[] = [];

  for (const item of items) {
    let pageNumber: number | undefined;

    try {
      if (item.dest) {
        let dest = item.dest;
        // Named destinations need to be resolved
        if (typeof dest === 'string') {
          dest = await doc.getDestination(dest);
        }
        if (Array.isArray(dest) && dest.length > 0) {
          const ref = dest[0];
          const pageIdx = await doc.getPageIndex(ref);
          pageNumber = pageIdx + 1; // 1-based
        }
      }
    } catch {
      // Could not resolve destination — leave pageNumber undefined
    }

    const children = item.items && item.items.length > 0
      ? await resolveOutline(doc, item.items)
      : [];

    result.push({
      title: item.title || 'Untitled',
      dest: item.dest,
      pageNumber,
      items: children,
    });
  }

  return result;
}
