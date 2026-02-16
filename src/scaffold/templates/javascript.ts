import { ScaffoldTemplate } from '../templateRegistry';

export const javascriptTemplate: ScaffoldTemplate = {
  language: 'javascript',
  files: [
    {
      path: 'package.json',
      template: (name: string) => JSON.stringify({
        name,
        version: '1.0.0',
        main: 'index.js',
        scripts: { start: 'node index.js' },
      }, null, 2) + '\n',
    },
    {
      path: 'index.js',
      template: () => `console.log("Hello, world!");
`,
      isMain: true,
    },
  ],
  runCommand: 'node index.js',
};
