import * as path from 'path';
import * as os from 'os';

export function expandHome(filePath: string): string {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

export function resolveEpubHref(base: string, href: string): string {
  const stripped = stripFragment(href);
  if (!stripped) {
    return base;
  }
  return path.posix.join(path.posix.dirname(base), stripped);
}

export function stripFragment(href: string): string {
  const hashIndex = href.indexOf('#');
  return hashIndex >= 0 ? href.substring(0, hashIndex) : href;
}

export function getFragment(href: string): string {
  const hashIndex = href.indexOf('#');
  return hashIndex >= 0 ? href.substring(hashIndex + 1) : '';
}

export function toForwardSlash(p: string): string {
  return p.replace(/\\/g, '/');
}
