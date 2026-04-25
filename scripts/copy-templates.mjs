import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

console.log(`Copied templates: ${sourceDir} -> ${targetDir}`);
