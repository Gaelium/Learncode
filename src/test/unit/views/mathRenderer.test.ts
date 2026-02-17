import { describe, it, expect } from 'vitest';
import { replaceImgMath, renderMathInHtml } from '../../../views/mathRenderer';

describe('replaceImgMath', () => {
  it('replaces <img> with $$LaTeX$$ alt text with KaTeX output', () => {
    const html = '<img src="eq.png" alt="$$x^2 + y^2$$" />';
    const result = replaceImgMath(html);
    expect(result).toContain('katex');
    expect(result).not.toContain('<img');
  });

  it('preserves non-math <img> tags', () => {
    const html = '<img src="photo.jpg" alt="A sunset" />';
    const result = replaceImgMath(html);
    expect(result).toBe(html);
  });

  it('preserves <img> with non-LaTeX alt text', () => {
    const html = '<img src="diagram.png" alt="Figure 1" />';
    const result = replaceImgMath(html);
    expect(result).toBe(html);
  });
});

describe('renderMathInHtml', () => {
  it('renders display math $$...$$', () => {
    const html = '<p>The equation $$x^2$$ is quadratic.</p>';
    const result = renderMathInHtml(html);
    expect(result).toContain('katex');
    expect(result).not.toContain('$$');
  });

  it('renders display math \\[...\\]', () => {
    const html = '<p>The equation \\[x^2\\] is here.</p>';
    const result = renderMathInHtml(html);
    expect(result).toContain('katex');
  });

  it('renders inline math \\(...\\)', () => {
    const html = '<p>Inline \\(x^2\\) math.</p>';
    const result = renderMathInHtml(html);
    expect(result).toContain('katex');
  });

  it('renders inline math $...$', () => {
    const html = '<p>Inline $x^2$ math.</p>';
    const result = renderMathInHtml(html);
    expect(result).toContain('katex');
  });

  it('avoids rendering currency like $5', () => {
    const html = '<p>This costs $5 per item.</p>';
    const result = renderMathInHtml(html);
    expect(result).toContain('$5');
    expect(result).not.toContain('katex');
  });

  it('does not modify attribute values', () => {
    const html = '<div data-formula="$x$">Content</div>';
    const result = renderMathInHtml(html);
    expect(result).toContain('data-formula="$x$"');
  });

  it('handles invalid LaTeX gracefully', () => {
    const html = '<p>$$\\invalid{command$$</p>';
    const result = renderMathInHtml(html);
    // Should not throw; should produce some output (KaTeX with throwOnError: false)
    expect(result).toBeTruthy();
  });

  it('handles multiple math expressions in one text node', () => {
    const html = '<p>Given $a$ and $b$, then $a+b$.</p>';
    const result = renderMathInHtml(html);
    // All three should be rendered
    const katexCount = (result.match(/katex/g) || []).length;
    expect(katexCount).toBeGreaterThanOrEqual(3);
  });
});
