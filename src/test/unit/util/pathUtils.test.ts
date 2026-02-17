import { describe, it, expect } from 'vitest';
import {
  expandHome,
  resolveEpubHref,
  stripFragment,
  getFragment,
  toForwardSlash,
} from '../../../util/pathUtils';
import * as os from 'os';

describe('expandHome', () => {
  it('expands ~/path to home directory', () => {
    const result = expandHome('~/Documents/book.epub');
    expect(result).toContain(os.homedir());
    expect(result).toContain('Documents/book.epub');
  });

  it('expands lone tilde', () => {
    expect(expandHome('~')).toBe(os.homedir());
  });

  it('does not expand paths without tilde prefix', () => {
    expect(expandHome('/usr/local')).toBe('/usr/local');
  });

  it('does not expand tilde in the middle', () => {
    expect(expandHome('/home/~user')).toBe('/home/~user');
  });
});

describe('resolveEpubHref', () => {
  it('resolves relative href against base path', () => {
    expect(resolveEpubHref('OEBPS/content.opf', 'chapter01.xhtml')).toBe('OEBPS/chapter01.xhtml');
  });

  it('strips fragment before resolving', () => {
    expect(resolveEpubHref('OEBPS/content.opf', 'chapter01.xhtml#sec1')).toBe('OEBPS/chapter01.xhtml');
  });

  it('returns base when href is empty', () => {
    expect(resolveEpubHref('OEBPS/content.opf', '')).toBe('OEBPS/content.opf');
  });

  it('returns base when href is only a fragment', () => {
    expect(resolveEpubHref('OEBPS/content.opf', '#section')).toBe('OEBPS/content.opf');
  });
});

describe('stripFragment', () => {
  it('removes fragment from href', () => {
    expect(stripFragment('chapter01.xhtml#sec1')).toBe('chapter01.xhtml');
  });

  it('returns unchanged when no fragment', () => {
    expect(stripFragment('chapter01.xhtml')).toBe('chapter01.xhtml');
  });

  it('returns empty string for fragment-only href', () => {
    expect(stripFragment('#section')).toBe('');
  });
});

describe('getFragment', () => {
  it('returns fragment without hash', () => {
    expect(getFragment('chapter01.xhtml#sec1')).toBe('sec1');
  });

  it('returns empty string when no fragment', () => {
    expect(getFragment('chapter01.xhtml')).toBe('');
  });
});

describe('toForwardSlash', () => {
  it('converts backslashes to forward slashes', () => {
    expect(toForwardSlash('path\\to\\file')).toBe('path/to/file');
  });

  it('leaves forward slashes unchanged', () => {
    expect(toForwardSlash('path/to/file')).toBe('path/to/file');
  });

  it('handles mixed slashes', () => {
    expect(toForwardSlash('path\\to/file')).toBe('path/to/file');
  });
});
