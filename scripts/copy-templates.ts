import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'src', 'templates');
const targetDir = path.join(rootDir, 'out', 'templates');

if (!existsSync(sourceDir)) {
  throw new Error(`Template source directory does not exist: ${sourceDir}`);
}

mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true, force: true });

const templateRendererSource = path.join(sourceDir, 'quote', 'template-renderer.ts');
const templateRendererTarget = path.join(targetDir, 'quote', 'template-renderer.js');

if (existsSync(templateRendererSource)) {
  const source = readFileSync(templateRendererSource, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
      removeComments: false
    },
    fileName: templateRendererSource
  });
  writeFileSync(templateRendererTarget, output.outputText, 'utf8');
  rmSync(path.join(targetDir, 'quote', 'template-renderer.ts'), { force: true });
}

console.log(`Copied templates: ${sourceDir} -> ${targetDir}`);
