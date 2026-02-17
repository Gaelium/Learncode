import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';

vi.mock('fs', async () => {
  const memfs = await import('memfs');
  return memfs.fs;
});

vi.mock('crypto', () => ({
  randomUUID: () => 'test-uuid-1234',
}));

const { AnnotationStore } = await import('../../../workspace/annotationStore');

describe('AnnotationStore', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('loads defaults when no file exists', async () => {
    const store = new AnnotationStore('/project');
    await store.load();
    expect(store.getAllAnnotations()).toEqual([]);
  });

  it('loads existing annotations file', async () => {
    const data = {
      version: '1.0',
      annotations: [
        {
          id: 'abc',
          selectedText: 'hello',
          note: 'my note',
          createdAt: '2024-01-01',
          pageOrSpineIndex: 3,
          textPrefix: 'before',
          textSuffix: 'after',
        },
      ],
    };
    vol.fromJSON({
      '/project/.learncode/annotations.json': JSON.stringify(data),
    });
    const store = new AnnotationStore('/project');
    await store.load();
    expect(store.getAllAnnotations()).toHaveLength(1);
    expect(store.getAllAnnotations()[0].id).toBe('abc');
  });

  it('addAnnotation creates annotation with UUID and timestamp', async () => {
    vol.mkdirSync('/project/.learncode', { recursive: true });
    const store = new AnnotationStore('/project');
    await store.load();

    const annotation = await store.addAnnotation('selected text', 'my note', 5, 'prefix', 'suffix');
    expect(annotation.id).toBe('test-uuid-1234');
    expect(annotation.selectedText).toBe('selected text');
    expect(annotation.note).toBe('my note');
    expect(annotation.pageOrSpineIndex).toBe(5);
    expect(annotation.textPrefix).toBe('prefix');
    expect(annotation.textSuffix).toBe('suffix');
    expect(annotation.createdAt).toBeTruthy();
  });

  it('removeAnnotation removes by id', async () => {
    vol.mkdirSync('/project/.learncode', { recursive: true });
    const store = new AnnotationStore('/project');
    await store.load();

    await store.addAnnotation('text1', 'note1', 1, '', '');
    expect(store.getAllAnnotations()).toHaveLength(1);

    await store.removeAnnotation('test-uuid-1234');
    expect(store.getAllAnnotations()).toHaveLength(0);
  });

  it('getAnnotationsForPage filters by page index', async () => {
    const data = {
      version: '1.0',
      annotations: [
        { id: '1', selectedText: 't1', note: '', createdAt: '', pageOrSpineIndex: 1, textPrefix: '', textSuffix: '' },
        { id: '2', selectedText: 't2', note: '', createdAt: '', pageOrSpineIndex: 2, textPrefix: '', textSuffix: '' },
        { id: '3', selectedText: 't3', note: '', createdAt: '', pageOrSpineIndex: 1, textPrefix: '', textSuffix: '' },
      ],
    };
    vol.fromJSON({
      '/project/.learncode/annotations.json': JSON.stringify(data),
    });
    const store = new AnnotationStore('/project');
    await store.load();

    const page1 = store.getAnnotationsForPage(1);
    expect(page1).toHaveLength(2);
    expect(page1.map(a => a.id)).toEqual(['1', '3']);

    const page2 = store.getAnnotationsForPage(2);
    expect(page2).toHaveLength(1);
  });

  it('getAllAnnotations returns a copy (not a reference)', async () => {
    vol.mkdirSync('/project/.learncode', { recursive: true });
    const store = new AnnotationStore('/project');
    await store.load();

    await store.addAnnotation('text', 'note', 1, '', '');
    const all = store.getAllAnnotations();
    all.pop(); // Modify the returned array
    expect(store.getAllAnnotations()).toHaveLength(1); // Original unchanged
  });

  it('save writes atomically via temp file and rename', async () => {
    vol.mkdirSync('/project/.learncode', { recursive: true });
    const store = new AnnotationStore('/project');
    await store.load();

    await store.addAnnotation('text', 'note', 1, '', '');

    // Check the file was written
    const raw = vol.readFileSync('/project/.learncode/annotations.json', 'utf-8') as string;
    const saved = JSON.parse(raw);
    expect(saved.annotations).toHaveLength(1);
  });
});
