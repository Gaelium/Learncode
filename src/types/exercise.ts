export interface Dependency {
  name: string;
  version?: string;
}

export interface ExerciseFile {
  path: string;
  content: string;
  isMain: boolean;
}

export interface BookmarkLocation {
  chapterHref: string;
  heading: string;
}

export interface Exercise {
  id: string;
  title: string;
  chapterId: string;
  sectionId?: string;
  language: string;
  files: ExerciseFile[];
  expectedOutput?: string;
  instructions: string;
  bookmark: BookmarkLocation;
  dependencies: Dependency[];
  codeBlockIds: string[];
}
