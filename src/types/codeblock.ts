export type CodeBlockType =
  | 'example'
  | 'exercise'
  | 'output'
  | 'config'
  | 'repl'
  | 'incremental'
  | 'unknown';

export interface CodeBlock {
  id: string;
  content: string;
  language: string;
  languageConfidence: number;
  type: CodeBlockType;
  chapterHref: string;
  precedingHeading: string;
  precedingText: string;
  followingText: string;
  cssClasses: string[];
  lineCount: number;
  elementIndex: number;
}
