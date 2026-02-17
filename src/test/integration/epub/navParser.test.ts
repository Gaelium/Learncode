import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseNav } from '../../../epub/navParser';
import { SpineItem } from '../../../types/epub';

const spine: SpineItem[] = [
  { idref: 'ch1', linear: true, href: 'chapter01.xhtml', mediaType: 'application/xhtml+xml' },
  { idref: 'ch2', linear: true, href: 'chapter02.xhtml', mediaType: 'application/xhtml+xml' },
  { idref: 'ch3', linear: true, href: 'chapter03.xhtml', mediaType: 'application/xhtml+xml' },
];

describe('parseNav', () => {
  describe('EPUB3 nav parsing', () => {
    it('parses EPUB3 nav with toc type', async () => {
      const navHtml = `
        <html xmlns:epub="http://www.idpf.org/2007/ops">
        <body>
          <nav epub:type="toc">
            <ol>
              <li><a href="chapter01.xhtml">Chapter 1</a></li>
              <li><a href="chapter02.xhtml">Chapter 2</a></li>
            </ol>
          </nav>
        </body>
        </html>`;
      const zip = new JSZip();
      zip.file('OEBPS/nav.xhtml', navHtml);

      const toc = await parseNav(zip, 'OEBPS', 'nav.xhtml', undefined, spine);
      expect(toc).toHaveLength(2);
      expect(toc[0].title).toBe('Chapter 1');
      expect(toc[1].title).toBe('Chapter 2');
    });

    it('resolves href relative to nav directory', async () => {
      const navHtml = `
        <html xmlns:epub="http://www.idpf.org/2007/ops">
        <body>
          <nav epub:type="toc">
            <ol>
              <li><a href="chapter01.xhtml">Chapter 1</a></li>
            </ol>
          </nav>
        </body>
        </html>`;
      const zip = new JSZip();
      zip.file('OEBPS/nav.xhtml', navHtml);

      const toc = await parseNav(zip, 'OEBPS', 'nav.xhtml', undefined, spine);
      expect(toc[0].href).toBe('OEBPS/chapter01.xhtml');
    });

    it('assigns spineIndex from spine lookup', async () => {
      const navHtml = `
        <html xmlns:epub="http://www.idpf.org/2007/ops">
        <body>
          <nav epub:type="toc">
            <ol>
              <li><a href="chapter02.xhtml">Chapter 2</a></li>
            </ol>
          </nav>
        </body>
        </html>`;
      const zip = new JSZip();
      zip.file('OEBPS/nav.xhtml', navHtml);

      const toc = await parseNav(zip, 'OEBPS', 'nav.xhtml', undefined, spine);
      expect(toc[0].spineIndex).toBe(1);
    });

    it('parses nested children', async () => {
      const navHtml = `
        <html xmlns:epub="http://www.idpf.org/2007/ops">
        <body>
          <nav epub:type="toc">
            <ol>
              <li>
                <a href="chapter01.xhtml">Chapter 1</a>
                <ol>
                  <li><a href="chapter01.xhtml#sec1">Section 1.1</a></li>
                  <li><a href="chapter01.xhtml#sec2">Section 1.2</a></li>
                </ol>
              </li>
            </ol>
          </nav>
        </body>
        </html>`;
      const zip = new JSZip();
      zip.file('OEBPS/nav.xhtml', navHtml);

      const toc = await parseNav(zip, 'OEBPS', 'nav.xhtml', undefined, spine);
      expect(toc).toHaveLength(1);
      expect(toc[0].children).toHaveLength(2);
      expect(toc[0].children[0].title).toBe('Section 1.1');
      expect(toc[0].depth).toBe(0);
      expect(toc[0].children[0].depth).toBe(1);
    });
  });

  describe('NCX fallback', () => {
    it('parses NCX when nav is not available', async () => {
      const ncxXml = `<?xml version="1.0"?>
        <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
          <navMap>
            <navPoint>
              <navLabel><text>Chapter 1</text></navLabel>
              <content src="chapter01.xhtml"/>
            </navPoint>
            <navPoint>
              <navLabel><text>Chapter 2</text></navLabel>
              <content src="chapter02.xhtml"/>
            </navPoint>
          </navMap>
        </ncx>`;
      const zip = new JSZip();
      zip.file('OEBPS/toc.ncx', ncxXml);

      const toc = await parseNav(zip, 'OEBPS', undefined, 'toc.ncx', spine);
      expect(toc).toHaveLength(2);
      expect(toc[0].title).toBe('Chapter 1');
      expect(toc[0].href).toBe('OEBPS/chapter01.xhtml');
    });

    it('NCX supports nested navPoints', async () => {
      const ncxXml = `<?xml version="1.0"?>
        <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
          <navMap>
            <navPoint>
              <navLabel><text>Chapter 1</text></navLabel>
              <content src="chapter01.xhtml"/>
              <navPoint>
                <navLabel><text>Section 1.1</text></navLabel>
                <content src="chapter01.xhtml#sec1"/>
              </navPoint>
            </navPoint>
          </navMap>
        </ncx>`;
      const zip = new JSZip();
      zip.file('OEBPS/toc.ncx', ncxXml);

      const toc = await parseNav(zip, 'OEBPS', undefined, 'toc.ncx', spine);
      expect(toc).toHaveLength(1);
      expect(toc[0].children).toHaveLength(1);
      expect(toc[0].children[0].title).toBe('Section 1.1');
    });
  });

  describe('spine fallback', () => {
    it('generates ToC from spine when no nav or NCX', async () => {
      const zip = new JSZip();
      const toc = await parseNav(zip, 'OEBPS', undefined, undefined, spine);
      expect(toc).toHaveLength(3);
      expect(toc[0].title).toBe('Chapter 1');
      expect(toc[0].href).toBe('chapter01.xhtml');
      expect(toc[0].spineIndex).toBe(0);
      expect(toc[1].title).toBe('Chapter 2');
      expect(toc[2].title).toBe('Chapter 3');
    });

    it('skips non-linear spine items in fallback', async () => {
      const mixedSpine: SpineItem[] = [
        { idref: 'ch1', linear: true, href: 'ch1.xhtml', mediaType: 'application/xhtml+xml' },
        { idref: 'ad', linear: false, href: 'ad.xhtml', mediaType: 'application/xhtml+xml' },
        { idref: 'ch2', linear: true, href: 'ch2.xhtml', mediaType: 'application/xhtml+xml' },
      ];
      const zip = new JSZip();
      const toc = await parseNav(zip, 'OEBPS', undefined, undefined, mixedSpine);
      expect(toc).toHaveLength(2);
    });
  });
});
