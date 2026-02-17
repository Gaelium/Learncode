import { describe, it, expect } from 'vitest';
import { classifyCodeBlocks } from '../../../analysis/codeBlockClassifier';
import { makeCodeBlock } from '../../helpers/fixtures';

describe('classifyCodeBlocks', () => {
  describe('output detection', () => {
    it('classifies by CSS class "output"', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({ cssClasses: ['output'], type: 'unknown' }),
      ]);
      expect(block.type).toBe('output');
    });

    it('classifies by context keywords like "output:"', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({ precedingText: 'The output:', precedingHeading: '', type: 'unknown' }),
      ]);
      expect(block.type).toBe('output');
    });

    it('classifies shell prompt lines as output', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: '$ cargo run\n> hello world',
          precedingText: '',
          precedingHeading: '',
          cssClasses: [],
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('output');
    });
  });

  describe('config detection', () => {
    it('classifies TOML content', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: '[package]\nname = "hello"\nversion = "0.1.0"',
          precedingText: '',
          precedingHeading: '',
          cssClasses: [],
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('config');
    });

    it('classifies by context referencing Cargo.toml', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: 'name = "hello"',
          precedingText: 'Add this to your Cargo.toml',
          precedingHeading: '',
          cssClasses: [],
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('config');
    });

    it('classifies JSON with .json context', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: '{"name": "test"}',
          precedingText: 'In your package.json',
          precedingHeading: '',
          cssClasses: [],
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('config');
    });

    it('classifies Makefile-looking content with Makefile context', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: 'all: build\n\tbuild main.c',
          precedingText: 'Create a Makefile:',
          precedingHeading: '',
          cssClasses: [],
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('config');
    });
  });

  describe('REPL detection', () => {
    it('classifies Python REPL (>>>)', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: '>>> 2 + 2\n4',
          precedingText: '',
          precedingHeading: '',
          cssClasses: [],
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('repl');
    });

    it('classifies Ruby IRB', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: 'irb(main):001:0> puts "hello"\nhello',
          precedingText: '',
          precedingHeading: '',
          cssClasses: [],
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('repl');
    });

    it('classifies Elixir IEx', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: 'iex(1)> 1 + 1\n2',
          precedingText: '',
          precedingHeading: '',
          cssClasses: [],
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('repl');
    });
  });

  describe('incremental detection', () => {
    it('classifies by mod keywords in context', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: 'fn updated() {}',
          precedingText: 'Now add the new function',
          precedingHeading: '',
          cssClasses: [],
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('incremental');
    });

    it('classifies by diff markers', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: '@@ -1,3 +1,4 @@\n fn main() {\n+    println!("added");\n }',
          precedingText: '',
          precedingHeading: '',
          cssClasses: [],
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('incremental');
    });
  });

  describe('exercise detection', () => {
    it('classifies by "try it" in context', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: 'fn main() {\n    // your code here\n}',
          precedingText: 'Try it yourself',
          precedingHeading: '',
          cssClasses: [],
          language: 'rust',
          languageConfidence: 0.9,
          lineCount: 3,
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('exercise');
    });

    it('classifies by "implement" in context', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: 'fn add(a: i32, b: i32) -> i32 {\n    todo!()\n}',
          precedingText: 'Implement the following function',
          precedingHeading: '',
          cssClasses: [],
          language: 'rust',
          languageConfidence: 0.9,
          lineCount: 3,
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('exercise');
    });
  });

  describe('example detection', () => {
    it('classifies non-trivial block with recognized language as example', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: 'fn main() {\n    let x = 5;\n    let y = 10;\n    println!("{}", x + y);\n}',
          precedingText: '',
          precedingHeading: '',
          cssClasses: [],
          language: 'rust',
          languageConfidence: 0.9,
          lineCount: 5,
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('example');
    });
  });

  describe('unknown fallback', () => {
    it('returns unknown for short block with no language', () => {
      const [block] = classifyCodeBlocks([
        makeCodeBlock({
          content: 'hello',
          precedingText: '',
          precedingHeading: '',
          cssClasses: [],
          language: 'unknown',
          languageConfidence: 0,
          lineCount: 1,
          type: 'unknown',
        }),
      ]);
      expect(block.type).toBe('unknown');
    });
  });
});
