import { rustTemplate } from './templates/rust';
import { pythonTemplate } from './templates/python';
import { javascriptTemplate } from './templates/javascript';
import { goTemplate } from './templates/go';
import { cTemplate } from './templates/c';

export interface TemplateFile {
  path: string;
  template: (name: string) => string;
  isMain?: boolean;
}

export interface ScaffoldTemplate {
  language: string;
  files: TemplateFile[];
  runCommand: string;
}

const registry = new Map<string, ScaffoldTemplate>();

export function initTemplates(): void {
  registry.set('rust', rustTemplate);
  registry.set('python', pythonTemplate);
  registry.set('javascript', javascriptTemplate);
  registry.set('typescript', javascriptTemplate); // Reuse JS template
  registry.set('go', goTemplate);
  registry.set('c', cTemplate);
  registry.set('cpp', cTemplate); // Reuse C template
}

export function getTemplate(language: string): ScaffoldTemplate | undefined {
  return registry.get(language);
}

export function getSupportedLanguages(): string[] {
  return [...registry.keys()];
}
