import { describe, it, expect, beforeEach } from 'vitest';
import { initTemplates, getTemplate, getSupportedLanguages } from '../../../scaffold/templateRegistry';

describe('templateRegistry', () => {
  beforeEach(() => {
    initTemplates();
  });

  it('populates registry with all expected languages', () => {
    const languages = getSupportedLanguages();
    expect(languages).toContain('rust');
    expect(languages).toContain('python');
    expect(languages).toContain('javascript');
    expect(languages).toContain('typescript');
    expect(languages).toContain('go');
    expect(languages).toContain('c');
    expect(languages).toContain('cpp');
  });

  it('returns a template for each supported language', () => {
    for (const lang of getSupportedLanguages()) {
      expect(getTemplate(lang)).toBeDefined();
    }
  });

  it('typescript aliases to javascript template', () => {
    const ts = getTemplate('typescript');
    const js = getTemplate('javascript');
    expect(ts).toBe(js);
  });

  it('cpp aliases to c template', () => {
    const cpp = getTemplate('cpp');
    const c = getTemplate('c');
    expect(cpp).toBe(c);
  });

  it('returns undefined for unsupported language', () => {
    expect(getTemplate('haskell')).toBeUndefined();
  });

  describe('template file structures', () => {
    it('rust has Cargo.toml and src/main.rs', () => {
      const tmpl = getTemplate('rust')!;
      const paths = tmpl.files.map(f => f.path);
      expect(paths).toContain('Cargo.toml');
      expect(paths).toContain('src/main.rs');
    });

    it('python has main.py and requirements.txt', () => {
      const tmpl = getTemplate('python')!;
      const paths = tmpl.files.map(f => f.path);
      expect(paths).toContain('main.py');
      expect(paths).toContain('requirements.txt');
    });

    it('javascript has package.json and index.js', () => {
      const tmpl = getTemplate('javascript')!;
      const paths = tmpl.files.map(f => f.path);
      expect(paths).toContain('package.json');
      expect(paths).toContain('index.js');
    });

    it('go has go.mod and main.go', () => {
      const tmpl = getTemplate('go')!;
      const paths = tmpl.files.map(f => f.path);
      expect(paths).toContain('go.mod');
      expect(paths).toContain('main.go');
    });

    it('c has Makefile and main.c', () => {
      const tmpl = getTemplate('c')!;
      const paths = tmpl.files.map(f => f.path);
      expect(paths).toContain('Makefile');
      expect(paths).toContain('main.c');
    });
  });

  describe('template properties', () => {
    it('every template has a runCommand', () => {
      for (const lang of getSupportedLanguages()) {
        const tmpl = getTemplate(lang)!;
        expect(tmpl.runCommand).toBeTruthy();
      }
    });

    it('every template has exactly one isMain file', () => {
      for (const lang of ['rust', 'python', 'javascript', 'go', 'c']) {
        const tmpl = getTemplate(lang)!;
        const mainFiles = tmpl.files.filter(f => f.isMain);
        expect(mainFiles).toHaveLength(1);
      }
    });

    it('template functions generate content with the given name', () => {
      const tmpl = getTemplate('rust')!;
      const cargoToml = tmpl.files.find(f => f.path === 'Cargo.toml')!;
      const content = cargoToml.template('my_project');
      expect(content).toContain('my_project');
    });
  });
});
