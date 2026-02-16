import { CodeBlock, CodeBlockType } from '../types/codeblock';
import { Exercise, ExerciseFile } from '../types/exercise';
import { Chapter, Section } from './structureMapper';
import { exerciseId } from '../util/slugify';
import * as logger from '../util/logger';

interface AssemblerContext {
  chapters: Chapter[];
  blocks: CodeBlock[];
}

export function assembleExercises(
  chapters: Chapter[],
  blocks: CodeBlock[]
): Exercise[] {
  const exercises: Exercise[] = [];
  const ctx: AssemblerContext = { chapters, blocks };

  for (const chapter of chapters) {
    const chapterBlocks = getBlocksForChapter(chapter, blocks);
    let exIndex = 0;

    for (let i = 0; i < chapterBlocks.length; i++) {
      const block = chapterBlocks[i];

      // Skip blocks that don't produce exercises
      if (block.type === 'output' || block.type === 'config' || block.type === 'repl' || block.type === 'unknown') {
        continue;
      }

      // Skip blocks with unrecognized language (e.g., Turtle/RDF, data formats)
      if (block.language === 'unknown' && block.languageConfidence === 0) {
        continue;
      }

      // Handle consecutive incremental blocks
      if (block.type === 'incremental') {
        const incrementalGroup = collectConsecutive(chapterBlocks, i, 'incremental');
        const lastBlock = incrementalGroup[incrementalGroup.length - 1];
        const outputBlock = findFollowingOutput(chapterBlocks, i + incrementalGroup.length);

        const exercise = createExercise(
          chapter,
          exIndex,
          lastBlock,
          incrementalGroup,
          outputBlock,
          findSection(chapter, lastBlock.chapterHref)
        );
        exercises.push(exercise);
        exIndex++;
        i += incrementalGroup.length - 1;
        continue;
      }

      // Handle exercise or example blocks
      if (block.type === 'exercise' || block.type === 'example') {
        const outputBlock = findFollowingOutput(chapterBlocks, i + 1);
        const exercise = createExercise(
          chapter,
          exIndex,
          block,
          [block],
          outputBlock,
          findSection(chapter, block.chapterHref)
        );
        exercises.push(exercise);
        exIndex++;
      }
    }
  }

  logger.info(`Assembled ${exercises.length} exercises from ${blocks.length} code blocks`);
  return exercises;
}

function getBlocksForChapter(chapter: Chapter, blocks: CodeBlock[]): CodeBlock[] {
  const hrefs = new Set<string>();
  hrefs.add(chapter.href);
  for (const section of chapter.sections) {
    hrefs.add(section.href);
  }

  // Also match blocks whose chapterHref ends with any of these paths
  return blocks.filter(b => {
    for (const href of hrefs) {
      if (b.chapterHref === href || b.chapterHref.endsWith('/' + href) || href.endsWith('/' + b.chapterHref)) {
        return true;
      }
    }
    return false;
  });
}

function collectConsecutive(blocks: CodeBlock[], startIndex: number, type: CodeBlockType): CodeBlock[] {
  const group: CodeBlock[] = [];
  for (let i = startIndex; i < blocks.length; i++) {
    if (blocks[i].type === type) {
      group.push(blocks[i]);
    } else {
      break;
    }
  }
  return group;
}

function findFollowingOutput(blocks: CodeBlock[], index: number): CodeBlock | undefined {
  if (index < blocks.length && blocks[index].type === 'output') {
    return blocks[index];
  }
  return undefined;
}

function findSection(chapter: Chapter, href: string): Section | undefined {
  return chapter.sections.find(s =>
    s.href === href || href.endsWith('/' + s.href) || s.href.endsWith('/' + href)
  );
}

function createExercise(
  chapter: Chapter,
  exIndex: number,
  mainBlock: CodeBlock,
  allBlocks: CodeBlock[],
  outputBlock: CodeBlock | undefined,
  section: Section | undefined
): Exercise {
  const id = exerciseId(chapter.index, exIndex);
  const title = generateTitle(mainBlock, exIndex);
  const mainFile = getMainFileName(mainBlock.language);
  const content = mainBlock.content;

  const files: ExerciseFile[] = [{
    path: mainFile,
    content,
    isMain: true,
  }];

  const instructions = generateInstructions(mainBlock, allBlocks);

  return {
    id,
    title,
    chapterId: chapter.id,
    sectionId: section?.id,
    language: mainBlock.language,
    files,
    expectedOutput: outputBlock?.content,
    instructions,
    bookmark: {
      chapterHref: mainBlock.chapterHref,
      heading: mainBlock.precedingHeading,
    },
    dependencies: [],
    codeBlockIds: allBlocks.map(b => b.id),
  };
}

function generateTitle(block: CodeBlock, exIndex: number): string {
  if (block.precedingHeading) {
    return block.precedingHeading;
  }
  // Try to extract a meaningful title from the code
  const fnMatch = block.content.match(/(?:fn|func|def|function)\s+(\w+)/);
  if (fnMatch) {
    return fnMatch[1];
  }
  return `Exercise ${exIndex + 1}`;
}

function generateInstructions(mainBlock: CodeBlock, allBlocks: CodeBlock[]): string {
  const parts: string[] = [];

  if (mainBlock.precedingText) {
    parts.push(mainBlock.precedingText);
  }

  if (mainBlock.type === 'exercise') {
    parts.push('Implement the code as described above.');
  } else if (mainBlock.type === 'incremental' && allBlocks.length > 1) {
    parts.push(`This exercise builds incrementally through ${allBlocks.length} steps. The final version is provided.`);
  } else {
    parts.push('Study and run this code example.');
  }

  return parts.join('\n\n');
}

function getMainFileName(language: string): string {
  const fileNames: Record<string, string> = {
    rust: 'src/main.rs',
    python: 'main.py',
    javascript: 'index.js',
    typescript: 'index.ts',
    go: 'main.go',
    c: 'main.c',
    cpp: 'main.cpp',
    java: 'Main.java',
    ruby: 'main.rb',
    bash: 'script.sh',
    haskell: 'Main.hs',
    elixir: 'main.exs',
  };
  return fileNames[language] || 'main.txt';
}
