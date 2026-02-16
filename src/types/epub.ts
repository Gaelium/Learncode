export interface EpubMetadata {
  title: string;
  creator: string;
  language: string;
  identifier: string;
  publisher?: string;
  date?: string;
  description?: string;
  format?: 'epub' | 'pdf';
}

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

export interface SpineItem {
  idref: string;
  linear: boolean;
  href: string;
  mediaType: string;
}

export interface TocEntry {
  title: string;
  href: string;
  depth: number;
  children: TocEntry[];
  spineIndex?: number;
}

export interface EpubStructure {
  metadata: EpubMetadata;
  manifest: Map<string, ManifestItem>;
  spine: SpineItem[];
  toc: TocEntry[];
  content: Map<string, string>;
  images: Map<string, Buffer>;
  opfDir: string;
}
