/**
 * Bundle pdfjs-dist into IIFE scripts for use in VS Code webviews.
 * Webviews don't support ESM imports, so we use esbuild to convert
 * the ESM modules into plain scripts that set globals on `window`.
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, 'media', 'pdfjs');
fs.mkdirSync(destDir, { recursive: true });

async function bundle() {
  // Bundle pdf.mjs → pdf.js (IIFE, sets window.pdfjsLib)
  await esbuild.build({
    entryPoints: [require.resolve('pdfjs-dist/build/pdf.mjs')],
    bundle: true,
    format: 'iife',
    globalName: 'pdfjsLib',
    outfile: path.join(destDir, 'pdf.js'),
    platform: 'browser',
    target: 'es2020',
    minify: false,
  });
  console.log('Bundled pdf.js');

  // Bundle pdf.worker.mjs → pdf.worker.js (IIFE)
  await esbuild.build({
    entryPoints: [require.resolve('pdfjs-dist/build/pdf.worker.mjs')],
    bundle: true,
    format: 'iife',
    outfile: path.join(destDir, 'pdf.worker.js'),
    platform: 'browser',
    target: 'es2020',
    minify: false,
  });
  console.log('Bundled pdf.worker.js');

  console.log('pdfjs files bundled to media/pdfjs/');
}

bundle().catch((err) => {
  console.error('Failed to bundle pdfjs:', err);
  process.exit(1);
});
