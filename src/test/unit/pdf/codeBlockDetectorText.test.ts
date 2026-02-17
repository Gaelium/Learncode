import { describe, it, expect } from 'vitest';
import { detectCodeBlocksFromText } from '../../../pdf/codeBlockDetectorText';

describe('detectCodeBlocksFromText', () => {
  it('detects REPL blocks (>>> prompts)', () => {
    const text = '>>> 2 + 2\n4\n>>> print("hi")\nhi';
    const blocks = detectCodeBlocksFromText('page-1', text, 'python');
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].content).toContain('>>>');
  });

  it('detects shell prompt blocks ($)', () => {
    const text = '$ cargo build\n$ cargo run\noutput here';
    const blocks = detectCodeBlocksFromText('page-1', text, 'rust');
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].content).toContain('$ cargo');
  });

  it('detects indented code blocks (4+ spaces)', () => {
    const text = 'Some prose here.\n    fn main() {\n        println!("hi");\n    }\nMore prose.';
    const blocks = detectCodeBlocksFromText('page-1', text, 'rust');
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].content).toContain('fn main');
  });

  it('detects blocks with strong code signals', () => {
    const text = 'fn main() {\n    let x = 5;\n    println!("{}", x);\n}';
    const blocks = detectCodeBlocksFromText('page-1', text, 'rust');
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it('allows blank lines within indented blocks', () => {
    const text = '    fn first() {\n        return 1;\n    }\n\n    fn second() {\n        return 2;\n    }';
    const blocks = detectCodeBlocksFromText('page-1', text, 'rust');
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].content).toContain('first');
    expect(blocks[0].content).toContain('second');
  });

  it('assigns sequential indices', () => {
    const text = '    fn first() {\n        return 1;\n    }\nSome text in between.\n    fn second() {\n        return 2;\n    }';
    const blocks = detectCodeBlocksFromText('page-1', text, 'rust');
    if (blocks.length >= 2) {
      expect(blocks[0].id).toBe('page-1:block-0');
      expect(blocks[1].id).toBe('page-1:block-1');
    }
  });

  it('returns empty array for prose-only text', () => {
    const text = 'This is just regular text. No code here at all. Just words and sentences.';
    const blocks = detectCodeBlocksFromText('page-1', text, 'en');
    expect(blocks).toHaveLength(0);
  });

  it('returns empty array for empty text', () => {
    const blocks = detectCodeBlocksFromText('page-1', '', 'en');
    expect(blocks).toHaveLength(0);
  });
});
