export interface ExerciseTemplate {
  id: string;
  title: string;
  language: string;
  type: string;
  files: { path: string; content: string; isMain: boolean }[];
  expectedOutput?: string;
  instructions: string;
  bookmark: { chapterHref: string; heading: string };
  codeBlockIds: string[];
}

export interface SectionTemplate {
  id: string;
  title: string;
  exercises: ExerciseTemplate[];
}

export interface ChapterTemplate {
  id: string;
  title: string;
  href: string;
  sections: SectionTemplate[];
  exercises: ExerciseTemplate[];
}

export interface LearnCodeTemplate {
  version: string;
  bookTitle: string;
  bookAuthor: string;
  language: string;
  generatedAt: string;
  chapters: ChapterTemplate[];
}
