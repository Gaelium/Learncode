import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, 'src/test/__mocks__/vscode.ts'),
    },
  },
  test: {
    root: '.',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/test/**',
        'src/extension.ts',
        'src/views/bookReaderPanel.ts',
        'src/views/pdfReaderPanel.ts',
        'src/views/sidebarTreeProvider.ts',
        'src/views/sidebarTreeItems.ts',
        'src/commands/**',
        'src/workspace/workspaceInitializer.ts',
        'src/epub/unzipper.ts',
        'src/epub/contentExtractor.ts',
        'src/epub/index.ts',
        'src/pdf/pdfParser.ts',
        'src/pdf/index.ts',
      ],
    },
  },
});
