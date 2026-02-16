import { ScaffoldTemplate } from '../templateRegistry';

export const pythonTemplate: ScaffoldTemplate = {
  language: 'python',
  files: [
    {
      path: 'main.py',
      template: () => `def main():
    print("Hello, world!")

if __name__ == "__main__":
    main()
`,
      isMain: true,
    },
    {
      path: 'requirements.txt',
      template: () => '',
    },
  ],
  runCommand: 'python main.py',
};
