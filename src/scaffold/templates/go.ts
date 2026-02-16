import { ScaffoldTemplate } from '../templateRegistry';

export const goTemplate: ScaffoldTemplate = {
  language: 'go',
  files: [
    {
      path: 'go.mod',
      template: (name: string) => `module ${name}

go 1.21
`,
    },
    {
      path: 'main.go',
      template: () => `package main

import "fmt"

func main() {
\tfmt.Println("Hello, world!")
}
`,
      isMain: true,
    },
  ],
  runCommand: 'go run .',
};
