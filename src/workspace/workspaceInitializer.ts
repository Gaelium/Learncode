import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { parseEpub } from '../epub/index';
import { detectCodeBlocks } from '../analysis/codeBlockDetector';
import { classifyCodeBlocks } from '../analysis/codeBlockClassifier';
import { mapStructure } from '../analysis/structureMapper';
import { assembleExercises } from '../analysis/exerciseAssembler';
import { generateTemplateYaml } from '../scaffold/templateYamlGenerator';
import { generateSandbox } from '../scaffold/sandboxGenerator';
import { ProgressTracker } from './progressTracker';
import { CodeBlock } from '../types/codeblock';
import * as logger from '../util/logger';

export interface InitResult {
  exerciseCount: number;
  chapterCount: number;
  sandboxDir: string;
}

export async function initializeWorkspace(
  epubPath: string,
  sandboxDir: string
): Promise<InitResult> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'LearnCode: Importing Book',
      cancellable: false,
    },
    async (progress) => {
      // Step 1: Parse EPUB
      progress.report({ message: 'Parsing EPUB...', increment: 0 });
      const epub = await parseEpub(epubPath);
      logger.info(`Parsed "${epub.metadata.title}"`);

      // Step 2: Map structure
      progress.report({ message: 'Mapping chapter structure...', increment: 15 });
      const chapters = mapStructure(epub.toc);
      logger.info(`Mapped ${chapters.length} chapters`);

      // Step 3: Detect code blocks
      progress.report({ message: 'Detecting code blocks...', increment: 15 });
      let allBlocks: CodeBlock[] = [];
      for (const [href, html] of epub.content) {
        const blocks = detectCodeBlocks(href, html, epub.metadata.language);
        allBlocks = allBlocks.concat(blocks);
      }
      logger.info(`Detected ${allBlocks.length} code blocks`);

      // Step 4: Classify code blocks
      progress.report({ message: 'Classifying code blocks...', increment: 10 });
      allBlocks = classifyCodeBlocks(allBlocks);
      const typeCounts = new Map<string, number>();
      for (const b of allBlocks) {
        typeCounts.set(b.type, (typeCounts.get(b.type) || 0) + 1);
      }
      logger.info(`Classification: ${[...typeCounts.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`);

      // Step 5: Assemble exercises from code blocks
      progress.report({ message: 'Assembling exercises...', increment: 10 });
      const exercises = assembleExercises(chapters, allBlocks);
      logger.info(`Assembled ${exercises.length} exercises`);

      // Step 6: Generate template YAML
      progress.report({ message: 'Generating template...', increment: 10 });
      await generateTemplateYaml(sandboxDir, epub.metadata, chapters, exercises);

      // Step 7: Generate sandbox directories
      progress.report({ message: 'Creating exercise sandboxes...', increment: 20 });
      await generateSandbox(sandboxDir, chapters, exercises);

      // Step 8: Store EPUB content for book reader
      progress.report({ message: 'Storing book content...', increment: 10 });
      const bookDir = path.join(sandboxDir, '.learncode', 'book');
      await fs.promises.mkdir(bookDir, { recursive: true });

      for (const [href, html] of epub.content) {
        const relativePath = href;
        const destPath = path.join(bookDir, relativePath);
        await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
        await fs.promises.writeFile(destPath, html, 'utf-8');
      }

      // Write images to disk for the book reader
      for (const [imgPath, buffer] of epub.images) {
        const destPath = path.join(bookDir, imgPath);
        await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
        await fs.promises.writeFile(destPath, buffer);
      }

      // Store metadata
      await fs.promises.writeFile(
        path.join(sandboxDir, '.learncode', 'metadata.json'),
        JSON.stringify(epub.metadata, null, 2),
        'utf-8'
      );

      // Store spine order
      await fs.promises.writeFile(
        path.join(sandboxDir, '.learncode', 'spine.json'),
        JSON.stringify(epub.spine.filter(s => s.linear).map(s => s.href), null, 2),
        'utf-8'
      );

      // Initialize progress tracker
      const tracker = new ProgressTracker(sandboxDir);
      tracker.setBookTitle(epub.metadata.title);
      await tracker.save();

      progress.report({ message: 'Done!', increment: 10 });

      return {
        exerciseCount: exercises.length,
        chapterCount: chapters.length,
        sandboxDir,
      };
    }
  );
}
