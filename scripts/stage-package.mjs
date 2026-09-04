import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = path.join(projectRoot, 'packages', 'nara');
const buildCliDir = path.join(projectRoot, 'build', 'src', 'cli');
const officialSource = path.join(projectRoot, 'official-features');
const distDir = path.join(packageDir, 'dist');
const officialDest = path.join(packageDir, 'official-features');

function fail(message) {
  console.error(`stage:package: ${message}`);
  process.exit(1);
}

if (!existsSync(path.join(packageDir, 'package.json'))) {
  fail(`missing ${path.join(packageDir, 'package.json')}`);
}
if (!existsSync(path.join(buildCliDir, 'index.js'))) {
  fail(`missing ${path.join(buildCliDir, 'index.js')}. Run \`npm run build\` first.`);
}
if (!existsSync(officialSource)) {
  fail(`missing ${officialSource}`);
}

// Clean previous staged artifacts (generated only; never the package source).
for (const directory of [distDir, officialDest]) {
  rmSync(directory, { recursive: true, force: true });
}

// Copy only CLI build output and official-feature source. Root runtime and
// build artifacts (build/client, build/server.js, database/, storage/,
// logs/, app sources) are never staged.
mkdirSync(distDir, { recursive: true });
cpSync(buildCliDir, distDir, { recursive: true });
chmodSync(path.join(distDir, 'index.js'), 0o755);

mkdirSync(officialDest, { recursive: true });
cpSync(officialSource, officialDest, { recursive: true });

// License travels with the published artifact; README is package source.
copyFileSync(path.join(projectRoot, 'LICENSE'), path.join(packageDir, 'LICENSE'));
if (!existsSync(path.join(packageDir, 'README.md'))) {
  fail(`missing ${path.join(packageDir, 'README.md')}`);
}

console.log(`staged ${packageDir}`);
console.log(`  dist <- ${buildCliDir}`);
console.log(`  official-features <- ${officialSource}`);
