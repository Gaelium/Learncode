import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { EpubMetadata } from '../types/epub';
import { Exercise } from '../types/exercise';
import { Chapter } from '../analysis/structureMapper';
import { LearnCodeTemplate, ChapterTemplate, SectionTemplate, ExerciseTemplate } from '../types/template';
import * as logger from '../util/logger';

export async function generateTemplateYaml(
  baseDir: string,
  metadata: EpubMetadata,
  chapters: Chapter[],
  exercises: Exercise[]
): Promise<LearnCodeTemplate> {
  // Group exercises by chapter and section
  const exercisesByChapter = new Map<string, Exercise[]>();
  const exercisesBySection = new Map<string, Exercise[]>();

  for (const ex of exercises) {
    const chExercises = exercisesByChapter.get(ex.chapterId) || [];
    chExercises.push(ex);
    exercisesByChapter.set(ex.chapterId, chExercises);

    if (ex.sectionId) {
      const secExercises = exercisesBySection.get(ex.sectionId) || [];
      secExercises.push(ex);
      exercisesBySection.set(ex.sectionId, secExercises);
    }
  }

  const template: LearnCodeTemplate = {
    version: '1.0',
    bookTitle: metadata.title,
    bookAuthor: metadata.creator,
    language: detectPrimaryLanguage(exercises),
    generatedAt: new Date().toISOString(),
    chapters: chapters.map(ch => {
      const chExercises = exercisesByChapter.get(ch.id) || [];
      const sectionIds = new Set(ch.sections.map(s => s.id));

      // Exercises not in any section
      const topLevelExercises = chExercises.filter(ex => !ex.sectionId || !sectionIds.has(ex.sectionId));

      const sections: SectionTemplate[] = ch.sections
        .map(sec => ({
          id: sec.id,
          title: sec.title,
          exercises: (exercisesBySection.get(sec.id) || []).map(toExerciseTemplate),
        }))
        .filter(s => s.exercises.length > 0);

      const chapterTemplate: ChapterTemplate = {
        id: ch.id,
        title: ch.title,
        href: ch.href,
        sections,
        exercises: topLevelExercises.map(toExerciseTemplate),
      };

      return chapterTemplate;
    }),
  };

  // Write YAML file
  const learncodeDir = path.join(baseDir, '.learncode');
  await fs.promises.mkdir(learncodeDir, { recursive: true });
  const yamlContent = yaml.dump(template, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
  await fs.promises.writeFile(path.join(learncodeDir, 'template.yaml'), yamlContent, 'utf-8');

  logger.info(`Generated template.yaml with ${exercises.length} exercises`);
  return template;
}

function toExerciseTemplate(ex: Exercise): ExerciseTemplate {
  return {
    id: ex.id,
    title: ex.title,
    language: ex.language,
    type: 'example',
    files: ex.files.map(f => ({
      path: f.path,
      content: f.content,
      isMain: f.isMain,
    })),
    expectedOutput: ex.expectedOutput,
    instructions: ex.instructions,
    bookmark: ex.bookmark,
    codeBlockIds: ex.codeBlockIds,
  };
}

function detectPrimaryLanguage(exercises: Exercise[]): string {
  const counts = new Map<string, number>();
  for (const ex of exercises) {
    counts.set(ex.language, (counts.get(ex.language) || 0) + 1);
  }

  let bestLang = 'unknown';
  let bestCount = 0;
  for (const [lang, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestLang = lang;
    }
  }
  return bestLang;
}
