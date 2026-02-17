import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseOpf } from '../../../epub/opfParser';

function makeZipWithOpf(opfContent: string, opfPath = 'OEBPS/content.opf'): JSZip {
  const zip = new JSZip();
  zip.file(opfPath, opfContent);
  return zip;
}

const sampleOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier>urn:isbn:1234567890</dc:identifier>
    <dc:publisher>Test Publisher</dc:publisher>
    <dc:date>2024-01-01</dc:date>
    <dc:description>A test book</dc:description>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="chapter01.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter02.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;

describe('parseOpf', () => {
  it('extracts metadata', async () => {
    const zip = makeZipWithOpf(sampleOpf);
    const result = await parseOpf(zip, 'OEBPS/content.opf');
    expect(result.metadata.title).toBe('Test Book');
    expect(result.metadata.creator).toBe('Test Author');
    expect(result.metadata.language).toBe('en');
    expect(result.metadata.identifier).toBe('urn:isbn:1234567890');
    expect(result.metadata.publisher).toBe('Test Publisher');
    expect(result.metadata.date).toBe('2024-01-01');
    expect(result.metadata.description).toBe('A test book');
  });

  it('builds manifest map', async () => {
    const zip = makeZipWithOpf(sampleOpf);
    const result = await parseOpf(zip, 'OEBPS/content.opf');
    expect(result.manifest.size).toBe(5);
    expect(result.manifest.get('ch1')?.href).toBe('chapter01.xhtml');
    expect(result.manifest.get('css')?.mediaType).toBe('text/css');
  });

  it('builds spine array', async () => {
    const zip = makeZipWithOpf(sampleOpf);
    const result = await parseOpf(zip, 'OEBPS/content.opf');
    expect(result.spine).toHaveLength(2);
    expect(result.spine[0].idref).toBe('ch1');
    expect(result.spine[0].href).toBe('chapter01.xhtml');
    expect(result.spine[0].linear).toBe(true);
    expect(result.spine[1].idref).toBe('ch2');
  });

  it('detects nav href (EPUB3)', async () => {
    const zip = makeZipWithOpf(sampleOpf);
    const result = await parseOpf(zip, 'OEBPS/content.opf');
    expect(result.navHref).toBe('nav.xhtml');
  });

  it('detects NCX href (EPUB2)', async () => {
    const zip = makeZipWithOpf(sampleOpf);
    const result = await parseOpf(zip, 'OEBPS/content.opf');
    expect(result.ncxHref).toBe('toc.ncx');
  });

  it('sets opfDir correctly', async () => {
    const zip = makeZipWithOpf(sampleOpf);
    const result = await parseOpf(zip, 'OEBPS/content.opf');
    expect(result.opfDir).toBe('OEBPS');
  });

  it('throws error for missing OPF file', async () => {
    const zip = new JSZip();
    await expect(parseOpf(zip, 'missing.opf')).rejects.toThrow('OPF file not found');
  });

  it('handles OPF with no nav properties', async () => {
    const opf = `<?xml version="1.0"?>
      <package xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>No Nav</dc:title>
          <dc:creator>Author</dc:creator>
        </metadata>
        <manifest>
          <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine><itemref idref="ch1"/></spine>
      </package>`;
    const zip = makeZipWithOpf(opf);
    const result = await parseOpf(zip, 'OEBPS/content.opf');
    expect(result.navHref).toBeUndefined();
    expect(result.ncxHref).toBeUndefined();
  });
});
