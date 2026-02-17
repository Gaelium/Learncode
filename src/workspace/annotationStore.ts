import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Annotation, AnnotationData } from '../types/annotation';

export class AnnotationStore {
  private filePath: string;
  private data: AnnotationData;
  private saving = false;
  private pendingSave = false;

  constructor(baseDir: string) {
    this.filePath = path.join(baseDir, '.learncode', 'annotations.json');
    this.data = { version: '1.0', annotations: [] };
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(raw);
    } catch {
      // File doesn't exist yet — use defaults
    }
  }

  private async save(): Promise<void> {
    if (this.saving) {
      this.pendingSave = true;
      return;
    }
    this.saving = true;
    try {
      const dir = path.dirname(this.filePath);
      await fs.promises.mkdir(dir, { recursive: true });

      // Use same-directory temp file to avoid cross-filesystem rename issues
      const tmpPath = this.filePath + '.tmp';
      await fs.promises.writeFile(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
      await fs.promises.rename(tmpPath, this.filePath);
    } finally {
      this.saving = false;
      if (this.pendingSave) {
        this.pendingSave = false;
        await this.save();
      }
    }
  }

  async addAnnotation(
    selectedText: string,
    note: string,
    pageOrSpineIndex: number,
    textPrefix: string,
    textSuffix: string
  ): Promise<Annotation> {
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      selectedText,
      note,
      createdAt: new Date().toISOString(),
      pageOrSpineIndex,
      textPrefix,
      textSuffix,
    };
    this.data.annotations.push(annotation);
    await this.save();
    return annotation;
  }

  async removeAnnotation(id: string): Promise<void> {
    this.data.annotations = this.data.annotations.filter(a => a.id !== id);
    await this.save();
  }

  getAnnotationsForPage(pageOrSpineIndex: number): Annotation[] {
    return this.data.annotations.filter(a => a.pageOrSpineIndex === pageOrSpineIndex);
  }

  getAllAnnotations(): Annotation[] {
    return [...this.data.annotations];
  }
}
