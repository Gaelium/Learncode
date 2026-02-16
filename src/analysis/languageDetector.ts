export interface LanguageResult {
  language: string;
  confidence: number;
}

export function detectLanguage(
  content: string,
  cssLanguage: string | undefined,
  bookLanguage: string
): LanguageResult {
  // Priority 1: CSS class specified language (high confidence)
  if (cssLanguage) {
    return { language: cssLanguage, confidence: 0.9 };
  }

  // Priority 2: Content-based heuristics
  const detected = detectFromContent(content);
  if (detected) {
    return detected;
  }

  // Priority 3: Book's primary language (low confidence)
  if (bookLanguage && bookLanguage !== 'en') {
    return { language: bookLanguage, confidence: 0.3 };
  }

  return { language: 'unknown', confidence: 0 };
}

function detectFromContent(content: string): LanguageResult | null {
  const lines = content.split('\n');
  const firstLine = lines[0]?.trim() || '';
  const scores: Record<string, number> = {};

  // Rust signals
  if (/fn\s+\w+\s*\(/.test(content)) scores['rust'] = (scores['rust'] || 0) + 3;
  if (/let\s+mut\s+/.test(content)) scores['rust'] = (scores['rust'] || 0) + 4;
  if (/println!\s*\(/.test(content)) scores['rust'] = (scores['rust'] || 0) + 5;
  if (/use\s+std::/.test(content)) scores['rust'] = (scores['rust'] || 0) + 5;
  if (/impl\s+\w+/.test(content)) scores['rust'] = (scores['rust'] || 0) + 3;
  if (/&str|&mut|Vec<|Option<|Result</.test(content)) scores['rust'] = (scores['rust'] || 0) + 4;
  if (/\.unwrap\(\)/.test(content)) scores['rust'] = (scores['rust'] || 0) + 3;

  // Python signals
  if (/^def\s+\w+\s*\(/.test(content)) scores['python'] = (scores['python'] || 0) + 4;
  if (/^import\s+\w+/m.test(content)) scores['python'] = (scores['python'] || 0) + 2;
  if (/^from\s+\w+\s+import/m.test(content)) scores['python'] = (scores['python'] || 0) + 4;
  if (/print\s*\(/.test(content)) scores['python'] = (scores['python'] || 0) + 2;
  if (/:\s*$/.test(firstLine) && /^\s{4}/.test(lines[1] || '')) scores['python'] = (scores['python'] || 0) + 3;
  if (/__init__|self\.\w+|__name__/.test(content)) scores['python'] = (scores['python'] || 0) + 5;

  // JavaScript/TypeScript signals
  if (/console\.log\s*\(/.test(content)) scores['javascript'] = (scores['javascript'] || 0) + 4;
  if (/const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=/.test(content)) scores['javascript'] = (scores['javascript'] || 0) + 2;
  if (/=>\s*\{/.test(content)) scores['javascript'] = (scores['javascript'] || 0) + 3;
  if (/require\s*\(|module\.exports/.test(content)) scores['javascript'] = (scores['javascript'] || 0) + 4;
  if (/import\s+.*\s+from\s+['"]/.test(content)) scores['javascript'] = (scores['javascript'] || 0) + 3;
  if (/document\.|window\.|addEventListener/.test(content)) scores['javascript'] = (scores['javascript'] || 0) + 3;

  // TypeScript signals
  if (/:\s*(string|number|boolean|void)\b/.test(content)) scores['typescript'] = (scores['typescript'] || 0) + 3;
  if (/interface\s+\w+|type\s+\w+\s*=/.test(content)) scores['typescript'] = (scores['typescript'] || 0) + 4;

  // Go signals
  if (/^package\s+\w+/m.test(content)) scores['go'] = (scores['go'] || 0) + 5;
  if (/func\s+\w+\s*\(/.test(content)) scores['go'] = (scores['go'] || 0) + 3;
  if (/fmt\.Print/.test(content)) scores['go'] = (scores['go'] || 0) + 5;
  if (/:=/.test(content)) scores['go'] = (scores['go'] || 0) + 2;

  // C signals
  if (/^#include\s*</.test(content)) scores['c'] = (scores['c'] || 0) + 5;
  if (/int\s+main\s*\(/.test(content)) scores['c'] = (scores['c'] || 0) + 3;
  if (/printf\s*\(/.test(content)) scores['c'] = (scores['c'] || 0) + 4;
  if (/malloc\s*\(|free\s*\(/.test(content)) scores['c'] = (scores['c'] || 0) + 4;

  // Java signals
  if (/public\s+class\s+\w+/.test(content)) scores['java'] = (scores['java'] || 0) + 5;
  if (/System\.out\.print/.test(content)) scores['java'] = (scores['java'] || 0) + 5;
  if (/public\s+static\s+void\s+main/.test(content)) scores['java'] = (scores['java'] || 0) + 5;

  // Ruby signals
  if (/puts\s+/.test(content)) scores['ruby'] = (scores['ruby'] || 0) + 3;
  if (/def\s+\w+.*\n.*end$/m.test(content)) scores['ruby'] = (scores['ruby'] || 0) + 3;
  if (/require\s+['"]/.test(content)) scores['ruby'] = (scores['ruby'] || 0) + 2;

  // Bash signals
  if (firstLine.startsWith('#!/bin/') || firstLine.startsWith('#!')) scores['bash'] = (scores['bash'] || 0) + 5;
  if (/^\$\s+/m.test(content)) scores['bash'] = (scores['bash'] || 0) + 3;
  if (/echo\s+/.test(content)) scores['bash'] = (scores['bash'] || 0) + 2;

  // Find the best match
  let bestLang = '';
  let bestScore = 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }

  if (bestScore >= 4) {
    const confidence = Math.min(bestScore / 10, 0.85);
    return { language: bestLang, confidence };
  }

  return null;
}
