export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

export function chapterId(index: number, title: string): string {
  const num = String(index + 1).padStart(2, '0');
  const slug = slugify(title);
  return `ch${num}${slug ? '-' + slug : ''}`;
}

export function sectionId(chapterIndex: number, sectionIndex: number, title: string): string {
  const ch = String(chapterIndex + 1).padStart(2, '0');
  const sec = String(sectionIndex + 1).padStart(2, '0');
  const slug = slugify(title);
  return `ch${ch}-sec${sec}${slug ? '-' + slug : ''}`;
}

export function exerciseId(chapterIndex: number, exerciseIndex: number): string {
  const ch = String(chapterIndex + 1).padStart(2, '0');
  const ex = String(exerciseIndex + 1).padStart(2, '0');
  return `ch${ch}-ex${ex}`;
}

export function exerciseDirName(id: string, title: string): string {
  const slug = slugify(title);
  return slug ? `${id}-${slug}` : id;
}

export function chapterDirName(id: string, title: string): string {
  const slug = slugify(title);
  return slug ? `${id}-${slug}` : id;
}
