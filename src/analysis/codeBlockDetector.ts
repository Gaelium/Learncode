import * as cheerio from 'cheerio';
import { CodeBlock } from '../types/codeblock';
import { detectLanguage } from './languageDetector';
import * as logger from '../util/logger';

export function detectCodeBlocks(
  chapterHref: string,
  html: string,
  bookLanguage: string
): CodeBlock[] {
  const $ = cheerio.load(html, { xmlMode: true });
  const blocks: CodeBlock[] = [];
  let elementIndex = 0;

  // Find all <pre> elements (which may contain <code>)
  $('pre').each((_, preEl) => {
    const $pre = $(preEl);
    const $code = $pre.find('code').first();
    const rawText = ($code.length > 0 ? $code.text() : $pre.text()).trim();

    if (!rawText) return;

    // Collect CSS classes from both pre and code
    const preClasses = ($pre.attr('class') || '').split(/\s+/).filter(Boolean);
    const codeClasses = $code.length > 0
      ? ($code.attr('class') || '').split(/\s+/).filter(Boolean)
      : [];
    const cssClasses = [...new Set([...preClasses, ...codeClasses])];

    // Get surrounding context
    const precedingHeading = findPrecedingHeading($pre, $);
    const precedingText = findPrecedingParagraph($pre, $);
    const followingText = findFollowingParagraph($pre, $);

    // Detect language from CSS classes and content
    const classLang = extractLanguageFromClasses(cssClasses);
    const { language, confidence } = detectLanguage(rawText, classLang, bookLanguage);

    const id = `${chapterHref}:block-${elementIndex}`;
    blocks.push({
      id,
      content: rawText,
      language,
      languageConfidence: confidence,
      type: 'unknown', // Will be classified later
      chapterHref,
      precedingHeading,
      precedingText,
      followingText,
      cssClasses,
      lineCount: rawText.split('\n').length,
      elementIndex,
    });
    elementIndex++;
  });

  // Find standalone <code> blocks that are NOT inside <pre> and NOT inline
  $('code').each((_, codeEl) => {
    const $code = $(codeEl);
    // Skip if inside a <pre>
    if ($code.parents('pre').length > 0) return;
    // Skip inline code (inside <p>, <li>, <span>, etc.)
    const parent = $code.parent();
    if (parent.is('p, li, span, a, td, th, dt, dd, em, strong, b, i')) return;

    const rawText = $code.text().trim();
    if (!rawText || rawText.split('\n').length < 2) return;

    const cssClasses = ($code.attr('class') || '').split(/\s+/).filter(Boolean);
    const precedingHeading = findPrecedingHeading($code, $);
    const precedingText = findPrecedingParagraph($code, $);
    const followingText = findFollowingParagraph($code, $);

    const classLang = extractLanguageFromClasses(cssClasses);
    const { language, confidence } = detectLanguage(rawText, classLang, bookLanguage);

    const id = `${chapterHref}:block-${elementIndex}`;
    blocks.push({
      id,
      content: rawText,
      language,
      languageConfidence: confidence,
      type: 'unknown',
      chapterHref,
      precedingHeading,
      precedingText,
      followingText,
      cssClasses,
      lineCount: rawText.split('\n').length,
      elementIndex,
    });
    elementIndex++;
  });

  logger.debug(`Found ${blocks.length} code blocks in ${chapterHref}`);
  return blocks;
}

function findPrecedingHeading(
  $el: cheerio.Cheerio<any>,
  $: cheerio.CheerioAPI
): string {
  let current = $el;
  for (let i = 0; i < 10; i++) {
    const prev = current.prev();
    if (prev.length === 0) {
      current = current.parent();
      if (current.length === 0) break;
      continue;
    }
    if (prev.is('h1, h2, h3, h4, h5, h6')) {
      return prev.text().trim();
    }
    // Check if prev contains a heading
    const heading = prev.find('h1, h2, h3, h4, h5, h6').last();
    if (heading.length > 0) {
      return heading.text().trim();
    }
    current = prev;
  }
  return '';
}

function findPrecedingParagraph(
  $el: cheerio.Cheerio<any>,
  $: cheerio.CheerioAPI
): string {
  const prev = $el.prev();
  if (prev.is('p')) {
    return prev.text().trim().substring(0, 500);
  }
  // Check two levels back
  const prev2 = prev.prev();
  if (prev2.is('p')) {
    return prev2.text().trim().substring(0, 500);
  }
  return '';
}

function findFollowingParagraph(
  $el: cheerio.Cheerio<any>,
  $: cheerio.CheerioAPI
): string {
  const next = $el.next();
  if (next.is('p')) {
    return next.text().trim().substring(0, 500);
  }
  return '';
}

function extractLanguageFromClasses(classes: string[]): string | undefined {
  for (const cls of classes) {
    // language-X, lang-X, sourceCode X
    const match = cls.match(/^(?:language-|lang-)(.+)$/);
    if (match) return normalizeLanguage(match[1]);
    if (cls === 'sourceCode') continue;
    // Check if class itself is a known language
    const normalized = normalizeLanguage(cls);
    if (isKnownLanguage(normalized)) return normalized;
  }
  return undefined;
}

function normalizeLanguage(lang: string): string {
  const map: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    'c++': 'cpp',
    'c#': 'csharp',
    golang: 'go',
  };
  const lower = lang.toLowerCase();
  return map[lower] || lower;
}

function isKnownLanguage(lang: string): boolean {
  const known = new Set([
    'javascript', 'typescript', 'python', 'ruby', 'rust', 'go', 'c', 'cpp',
    'csharp', 'java', 'bash', 'html', 'css', 'sql', 'yaml', 'toml', 'json',
    'xml', 'haskell', 'elixir', 'erlang', 'scala', 'kotlin', 'swift',
    'php', 'perl', 'lua', 'r', 'julia', 'zig', 'nim', 'ocaml', 'clojure',
  ]);
  return known.has(lang);
}
