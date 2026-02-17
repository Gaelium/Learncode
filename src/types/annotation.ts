export interface Annotation {
  id: string;
  selectedText: string;
  note: string;
  createdAt: string;
  pageOrSpineIndex: number;
  textPrefix: string;
  textSuffix: string;
}

export interface AnnotationData {
  version: string;
  annotations: Annotation[];
}
