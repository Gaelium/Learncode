import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../../analysis/languageDetector';

describe('detectLanguage', () => {
  describe('CSS-language priority', () => {
    it('returns CSS language with high confidence when provided', () => {
      const result = detectLanguage('some code', 'python', 'rust');
      expect(result).toEqual({ language: 'python', confidence: 0.9 });
    });

    it('CSS language takes priority over content detection', () => {
      const rustCode = 'fn main() {\n    println!("Hello");\n}';
      const result = detectLanguage(rustCode, 'javascript', 'rust');
      expect(result).toEqual({ language: 'javascript', confidence: 0.9 });
    });
  });

  describe('content-based detection', () => {
    it('detects Rust from println! and fn', () => {
      const result = detectLanguage('fn main() {\n    println!("Hello");\n}', undefined, 'en');
      expect(result.language).toBe('rust');
      expect(result.confidence).toBeGreaterThan(0.4);
    });

    it('detects Rust from let mut', () => {
      const result = detectLanguage('let mut x = 5;\nx = x + 1;', undefined, 'en');
      expect(result.language).toBe('rust');
    });

    it('detects Python from def and self', () => {
      const code = 'def __init__(self, name):\n    self.name = name';
      const result = detectLanguage(code, undefined, 'en');
      expect(result.language).toBe('python');
    });

    it('detects Python from from...import', () => {
      const code = 'from os import path\nimport sys';
      const result = detectLanguage(code, undefined, 'en');
      expect(result.language).toBe('python');
    });

    it('detects JavaScript from console.log', () => {
      const code = 'const x = 42;\nconsole.log(x);';
      const result = detectLanguage(code, undefined, 'en');
      expect(result.language).toBe('javascript');
    });

    it('detects Go from package and fmt.Print', () => {
      const code = 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hi")\n}';
      const result = detectLanguage(code, undefined, 'en');
      expect(result.language).toBe('go');
    });

    it('detects C from #include and printf', () => {
      const code = '#include <stdio.h>\nint main() {\n    printf("Hello\\n");\n}';
      const result = detectLanguage(code, undefined, 'en');
      expect(result.language).toBe('c');
    });

    it('detects Java from public class and System.out', () => {
      const code = 'public class Hello {\n    public static void main(String[] args) {\n        System.out.println("Hello");\n    }\n}';
      const result = detectLanguage(code, undefined, 'en');
      expect(result.language).toBe('java');
    });

    it('detects Bash from shebang', () => {
      const code = '#!/bin/bash\necho "Hello"';
      const result = detectLanguage(code, undefined, 'en');
      expect(result.language).toBe('bash');
    });
  });

  describe('confidence thresholds', () => {
    it('returns null for low-signal content, falls through to bookLanguage', () => {
      const result = detectLanguage('x = 5', undefined, 'python');
      expect(result.language).toBe('python');
      expect(result.confidence).toBe(0.3);
    });

    it('caps confidence at 0.85', () => {
      const code = 'fn main() {\n    println!("Hello");\n    use std::io;\n    let mut x = Vec::new();\n    x.unwrap();\n}';
      const result = detectLanguage(code, undefined, 'en');
      expect(result.confidence).toBeLessThanOrEqual(0.85);
    });
  });

  describe('fallback behavior', () => {
    it('falls back to bookLanguage with low confidence', () => {
      const result = detectLanguage('x = 5', undefined, 'rust');
      expect(result).toEqual({ language: 'rust', confidence: 0.3 });
    });

    it('returns unknown when bookLanguage is en', () => {
      const result = detectLanguage('x = 5', undefined, 'en');
      expect(result).toEqual({ language: 'unknown', confidence: 0 });
    });

    it('returns unknown when no signals at all', () => {
      const result = detectLanguage('hello world', undefined, 'en');
      expect(result).toEqual({ language: 'unknown', confidence: 0 });
    });
  });
});
