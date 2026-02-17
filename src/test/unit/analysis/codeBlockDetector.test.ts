import { describe, it, expect } from 'vitest';
import { detectCodeBlocks } from '../../../analysis/codeBlockDetector';

describe('detectCodeBlocks', () => {
  it('detects <pre><code> blocks', () => {
    const html = '<h2>Example</h2><p>Try this:</p><pre><code>fn main() {}</code></pre><p>Done.</p>';
    const blocks = detectCodeBlocks('ch01.xhtml', html, 'rust');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toBe('fn main() {}');
    expect(blocks[0].chapterHref).toBe('ch01.xhtml');
  });

  it('detects bare <pre> without <code>', () => {
    const html = '<pre>println!("Hello");\nlet x = 5;</pre>';
    const blocks = detectCodeBlocks('ch01.xhtml', html, 'rust');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toContain('println!');
  });

  it('collects CSS classes from both pre and code', () => {
    const html = '<pre class="highlight"><code class="language-rust">fn main() {}</code></pre>';
    const blocks = detectCodeBlocks('ch01.xhtml', html, 'en');
    expect(blocks[0].cssClasses).toContain('highlight');
    expect(blocks[0].cssClasses).toContain('language-rust');
  });

  it('extracts language from CSS classes', () => {
    const html = '<pre><code class="language-python">def hello(): pass</code></pre>';
    const blocks = detectCodeBlocks('ch01.xhtml', html, 'en');
    expect(blocks[0].language).toBe('python');
    expect(blocks[0].languageConfidence).toBe(0.9);
  });

  it('extracts preceding heading and paragraph context', () => {
    const html = '<h2>Getting Started</h2><p>Here is an example:</p><pre><code>fn main() {}</code></pre><p>This works.</p>';
    const blocks = detectCodeBlocks('ch01.xhtml', html, 'rust');
    expect(blocks[0].precedingHeading).toBe('Getting Started');
    expect(blocks[0].precedingText).toBe('Here is an example:');
    expect(blocks[0].followingText).toBe('This works.');
  });

  it('detects Springer-style ProgramCode/FixedLine blocks', () => {
    const html = `
      <div class="ParaTypeProgramcode">
        <div class="FixedLine">fn main() {</div>
        <div class="FixedLine">    println!("Hello");</div>
        <div class="FixedLine">}</div>
      </div>
    `;
    const blocks = detectCodeBlocks('ch01.xhtml', html, 'rust');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toContain('fn main()');
    expect(blocks[0].cssClasses).toContain('ProgramCode');
  });

  it('detects generic programlisting class blocks', () => {
    const html = `<div class="programlisting">fn main() {\n    println!("Hello");\n}</div>`;
    const blocks = detectCodeBlocks('ch01.xhtml', html, 'rust');
    expect(blocks).toHaveLength(1);
  });

  it('detects standalone <code> not inside <pre> or inline parent', () => {
    const html = '<div><code>fn main() {\n    println!("test");\n}</code></div>';
    const blocks = detectCodeBlocks('ch01.xhtml', html, 'rust');
    expect(blocks).toHaveLength(1);
  });

  it('skips inline <code> inside <p>', () => {
    const html = '<p>Use <code>cargo run</code> to build.</p>';
    const blocks = detectCodeBlocks('ch01.xhtml', html, 'rust');
    expect(blocks).toHaveLength(0);
  });

  it('assigns sequential IDs', () => {
    const html = '<pre><code>block1</code></pre><pre><code>block2</code></pre>';
    const blocks = detectCodeBlocks('ch01.xhtml', html, 'en');
    expect(blocks[0].id).toBe('ch01.xhtml:block-0');
    expect(blocks[1].id).toBe('ch01.xhtml:block-1');
    expect(blocks[0].elementIndex).toBe(0);
    expect(blocks[1].elementIndex).toBe(1);
  });

  it('skips empty <pre> blocks', () => {
    const html = '<pre><code>   </code></pre>';
    const blocks = detectCodeBlocks('ch01.xhtml', html, 'en');
    expect(blocks).toHaveLength(0);
  });
});
