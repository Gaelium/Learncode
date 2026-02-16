import { CodeBlock } from '../types/codeblock';
import { detectLanguage } from '../analysis/languageDetector';
import * as logger from '../util/logger';

/**
 * Detect code blocks from plain text (extracted from PDF pages).
 * Unlike the HTML-based detector, this uses heuristics on raw text
 * since PDFs don't have semantic <pre>/<code> markup.
 */
export function detectCodeBlocksFromText(
  chapterHref: string,
  text: string,
  bookLanguage: string
): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = text.split('\n');
  let elementIndex = 0;

  let i = 0;
  while (i < lines.length) {
    // Try to find a code block starting at line i
    const result = tryExtractCodeBlock(lines, i);
    if (result) {
      const { codeLines, startIdx, endIdx } = result;
      const content = codeLines.join('\n').trim();

      if (content && codeLines.length >= 2) {
        const { language, confidence } = detectLanguage(content, undefined, bookLanguage);

        // Get surrounding context
        const precedingHeading = findPrecedingHeading(lines, startIdx);
        const precedingText = findPrecedingProse(lines, startIdx);
        const followingText = findFollowingProse(lines, endIdx);

        const id = `${chapterHref}:block-${elementIndex}`;
        blocks.push({
          id,
          content,
          language,
          languageConfidence: confidence,
          type: 'unknown',
          chapterHref,
          precedingHeading,
          precedingText,
          followingText,
          cssClasses: [],
          lineCount: codeLines.length,
          elementIndex,
        });
        elementIndex++;
      }

      i = endIdx + 1;
    } else {
      i++;
    }
  }

  logger.debug(`Found ${blocks.length} code blocks in ${chapterHref} (text-based)`);
  return blocks;
}

interface ExtractResult {
  codeLines: string[];
  startIdx: number;
  endIdx: number;
}

/**
 * Try to extract a code block starting at the given line index.
 * Returns null if the line doesn't look like the start of code.
 */
function tryExtractCodeBlock(lines: string[], startIdx: number): ExtractResult | null {
  const line = lines[startIdx];
  if (!line) return null;

  // Strategy 1: REPL/shell prompt blocks (>>>, $, %)
  if (isReplLine(line)) {
    return collectContiguousBlock(lines, startIdx, (l) => isReplLine(l) || isReplContinuation(l));
  }

  // Strategy 2: Indented code blocks (4+ spaces or tab indent)
  // Must have at least 2 consecutive indented lines
  if (isIndentedCodeLine(line) && startIdx + 1 < lines.length && isIndentedCodeLine(lines[startIdx + 1])) {
    return collectContiguousBlock(lines, startIdx, (l, idx, collected) => {
      // Allow single blank lines within the block
      if (l.trim() === '' && idx + 1 < lines.length && isIndentedCodeLine(lines[idx + 1])) {
        return true;
      }
      return isIndentedCodeLine(l);
    });
  }

  // Strategy 3: Lines with strong code indicators
  if (hasStrongCodeSignal(line) && startIdx + 1 < lines.length) {
    const nextLine = lines[startIdx + 1];
    if (hasCodeSignal(nextLine) || isIndentedCodeLine(nextLine)) {
      return collectContiguousBlock(lines, startIdx, (l, idx, collected) => {
        if (l.trim() === '' && idx + 1 < lines.length && hasCodeSignal(lines[idx + 1])) {
          return true;
        }
        return hasCodeSignal(l) || isIndentedCodeLine(l);
      });
    }
  }

  return null;
}

function collectContiguousBlock(
  lines: string[],
  startIdx: number,
  predicate: (line: string, idx: number, collected: string[]) => boolean
): ExtractResult {
  const codeLines: string[] = [];
  let endIdx = startIdx;

  for (let i = startIdx; i < lines.length; i++) {
    if (predicate(lines[i], i, codeLines)) {
      codeLines.push(lines[i]);
      endIdx = i;
    } else {
      break;
    }
  }

  // Trim trailing blank lines
  while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') {
    codeLines.pop();
    endIdx--;
  }

  return { codeLines, startIdx, endIdx };
}

function isReplLine(line: string): boolean {
  return /^\s*(>>>|\.\.\.|\$|%|>)\s+/.test(line);
}

function isReplContinuation(line: string): boolean {
  // Output lines following REPL input
  const trimmed = line.trim();
  return trimmed.length > 0 && !isProseLine(line);
}

function isIndentedCodeLine(line: string): boolean {
  // 4+ spaces or tab indent, and not empty
  return /^(\s{4,}|\t)/.test(line) && line.trim().length > 0;
}

function hasStrongCodeSignal(line: string): boolean {
  const patterns = [
    /^\s*(def|class|fn|func|function|import|from|package|use|pub|struct|enum|trait|impl)\s/,
    /^\s*#include\s*[<"]/,
    /^\s*(if|else|for|while|switch|match|return)\s*[\({]/,
    /^\s*(let|const|var|mut)\s+\w+/,
    /^\s*\w+\s*=\s*.+;?\s*$/,
    /^\s*\/\/|^\s*#(?!include)|^\s*\/\*/,
  ];
  return patterns.some(p => p.test(line));
}

function hasCodeSignal(line: string): boolean {
  if (line.trim() === '') return false;
  if (hasStrongCodeSignal(line)) return true;
  // Weaker signals
  const patterns = [
    /[{};()]/, // Braces, semicolons, parens
    /^\s+\w/, // Indented text (likely code body)
    /->|=>|::|\.\./, // Operators common in code
  ];
  return patterns.some(p => p.test(line));
}

function isProseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Prose typically starts without indent, contains mostly words, ends with punctuation
  if (/^[A-Z]/.test(trimmed) && /[.!?:,]$/.test(trimmed)) return true;
  // Sentence-like: multiple words with spaces
  const words = trimmed.split(/\s+/);
  if (words.length > 8 && !/[{};()=]/.test(trimmed)) return true;
  return false;
}

function findPrecedingHeading(lines: string[], startIdx: number): string {
  // Look back for a line that looks like a heading (short, no code signals)
  for (let i = startIdx - 1; i >= Math.max(0, startIdx - 10); i--) {
    const line = lines[i].trim();
    if (!line) continue;
    // Short line with no code signals could be a heading
    if (line.length < 100 && line.length > 2 && !hasCodeSignal(lines[i]) && /^[A-Z0-9]/.test(line)) {
      // If it looks like a title (capitalized, no ending period)
      if (!/[.!?,;:]$/.test(line) || /^Chapter\s|^Section\s|^\d+\.\d*/i.test(line)) {
        return line;
      }
    }
  }
  return '';
}

function findPrecedingProse(lines: string[], startIdx: number): string {
  const proseLines: string[] = [];
  for (let i = startIdx - 1; i >= Math.max(0, startIdx - 5); i--) {
    const line = lines[i].trim();
    if (!line) {
      if (proseLines.length > 0) break;
      continue;
    }
    if (isProseLine(lines[i])) {
      proseLines.unshift(line);
    } else {
      break;
    }
  }
  return proseLines.join(' ').substring(0, 500);
}

function findFollowingProse(lines: string[], endIdx: number): string {
  const proseLines: string[] = [];
  for (let i = endIdx + 1; i < Math.min(lines.length, endIdx + 5); i++) {
    const line = lines[i].trim();
    if (!line) {
      if (proseLines.length > 0) break;
      continue;
    }
    if (isProseLine(lines[i])) {
      proseLines.push(line);
    } else {
      break;
    }
  }
  return proseLines.join(' ').substring(0, 500);
}
