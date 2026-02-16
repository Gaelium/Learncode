import { CodeBlock, CodeBlockType } from '../types/codeblock';
import * as logger from '../util/logger';

export function classifyCodeBlocks(blocks: CodeBlock[]): CodeBlock[] {
  return blocks.map(block => ({
    ...block,
    type: classifyBlock(block),
  }));
}

function classifyBlock(block: CodeBlock): CodeBlockType {
  const context = (block.precedingText + ' ' + block.precedingHeading).toLowerCase();
  const content = block.content;
  const classes = block.cssClasses.join(' ').toLowerCase();

  // Rule 1: Output detection
  if (isOutput(content, context, classes)) {
    return 'output';
  }

  // Rule 2: Config file detection
  if (isConfig(content, context)) {
    return 'config';
  }

  // Rule 3: REPL session detection
  if (isRepl(content)) {
    return 'repl';
  }

  // Rule 4: Incremental code change
  if (isIncremental(content, context)) {
    return 'incremental';
  }

  // Rule 5: Exercise/practice prompt
  if (isExercise(context)) {
    return 'exercise';
  }

  // Rule 6: Default — example for non-trivial blocks with a recognized language
  if (block.lineCount > 3 && block.language !== 'unknown' && block.languageConfidence > 0) {
    return 'example';
  }

  return 'unknown';
}

function isOutput(content: string, context: string, classes: string): boolean {
  // CSS class indicates output
  if (/output|result|console/.test(classes)) return true;

  // Context suggests output
  const outputKeywords = /\b(output|prints?|produces?|results?\s+in|displays?|shows?|returns?)\s*:/i;
  if (outputKeywords.test(context)) return true;

  // Content looks like shell output (starts with $ or > prompts)
  const lines = content.split('\n');
  const promptLines = lines.filter(l => /^\s*[\$>]\s+/.test(l));
  if (promptLines.length > 0 && promptLines.length === lines.length) return true;

  // Content looks like plain output (no code constructs, short lines)
  if (lines.every(l => l.length < 80) && !/[{};=()]\s*$/.test(content) && lines.length <= 5) {
    if (/\b(output|result)\b/i.test(context)) return true;
  }

  return false;
}

function isConfig(content: string, context: string): boolean {
  // Looks like TOML
  if (/^\[[\w.-]+\]\s*$/m.test(content) && /=\s*/.test(content)) return true;

  // Looks like YAML config
  if (/^[\w-]+:\s+\S/m.test(content) && !/^(def|class|fn|func|import|from)\b/m.test(content)) {
    if (/\.(ya?ml|toml|json|ini|cfg)\b/i.test(context)) return true;
  }

  // Looks like JSON
  if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
    try {
      JSON.parse(content);
      if (/\.(json|config)\b/i.test(context)) return true;
    } catch {
      // not valid JSON
    }
  }

  // Looks like Makefile
  if (/^\w+\s*:.*$/m.test(content) && /\t/.test(content)) {
    if (/makefile/i.test(context)) return true;
  }

  // Context references config files
  if (/\b(cargo\.toml|package\.json|go\.mod|requirements\.txt|makefile|dockerfile|\.env)\b/i.test(context)) {
    return true;
  }

  return false;
}

function isRepl(content: string): boolean {
  // Python REPL
  if (/^>>>\s+/m.test(content)) return true;
  // Ruby IRB
  if (/^irb.*>\s+/m.test(content)) return true;
  // Elixir IEx
  if (/^iex.*>\s+/m.test(content)) return true;
  // Node REPL
  if (/^>\s+/.test(content) && /undefined|null/.test(content)) return true;

  return false;
}

function isIncremental(content: string, context: string): boolean {
  // Context suggests modification
  const modKeywords = /\b(add|change|modif|updat|replac|insert|append|remov|delet)\b/i;
  if (modKeywords.test(context)) {
    // Also check for diff-like content
    if (/^[+-]\s/m.test(content)) return true;
    // Or highlighted lines
    if (/\/\/\s*(add|new|change)/i.test(content)) return true;
    return true;
  }

  // Diff markers
  if (/^@@\s+.*\s+@@/m.test(content)) return true;
  if (/^---\s+\w/m.test(content) && /^\+\+\+\s+\w/m.test(content)) return true;

  return false;
}

function isExercise(context: string): boolean {
  const exerciseKeywords = /\b(try\s+(it|this)|exercise|write\s+(a|the|your)|implement|your\s+turn|practice|challenge|task|problem)\b/i;
  return exerciseKeywords.test(context);
}
