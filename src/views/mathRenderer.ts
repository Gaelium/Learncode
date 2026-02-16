import katex from 'katex';
import * as logger from '../util/logger';

/**
 * Finds LaTeX math delimiters in HTML and replaces them with
 * KaTeX-rendered MathML (rendered natively by Chromium).
 *
 * Only processes text content between HTML tags — never touches
 * attribute values, so <img alt="$x$" ...> stays intact.
 */
/**
 * Replaces <img> tags whose `alt` attribute contains LaTeX ($$...$$)
 * with KaTeX-rendered HTML. This handles EPUBs that store math as
 * raster PNGs with LaTeX in the alt text.
 */
export function replaceImgMath(html: string): string {
  return html.replace(
    /<img\s[^>]*alt=["']\$\$(.*?)\$\$["'][^>]*\/?>/gi,
    (_, latex) => {
      const trimmed = unescapeHtml(latex).trim();
      const displayMode = trimmed.startsWith('\\displaystyle');
      return renderLatex(trimmed, displayMode);
    }
  );
}

export function renderMathInHtml(html: string): string {
  // Split HTML into tags and text segments.
  // Tags (captured group) appear at odd indices, text at even indices.
  const parts = html.split(/(<[^>]*>)/);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // Skip HTML tags (starts with <)
    if (part.startsWith('<')) continue;
    // Skip empty text
    if (!part) continue;
    parts[i] = renderMathInText(part);
  }

  return parts.join('');
}

function renderMathInText(text: string): string {
  // Display math: $$...$$
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => {
    return renderLatex(unescapeHtml(latex), true);
  });

  // Display math: \[...\]
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => {
    return renderLatex(unescapeHtml(latex), true);
  });

  // Inline math: \(...\)
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => {
    return renderLatex(unescapeHtml(latex), false);
  });

  // Inline math: $...$ (single dollar signs, avoid false positives)
  // Only match when not preceded/followed by a digit (to avoid currency like $5)
  // and content doesn't span multiple lines
  text = text.replace(/(?<!\w)\$([^\$\n]+?)\$(?!\d)/g, (match, latex) => {
    // Skip if it looks like a currency amount
    if (/^\d/.test(latex.trim())) return match;
    return renderLatex(unescapeHtml(latex), false);
  });

  return text;
}

function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex.trim(), {
      output: 'htmlAndMathml',
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch (err) {
    logger.warn(`KaTeX render failed: ${err}`);
    return displayMode ? `<div class="math-error">${escapeHtml(latex)}</div>` : `<span class="math-error">${escapeHtml(latex)}</span>`;
  }
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
