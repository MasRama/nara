import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = path.join(projectRoot, 'packages', 'nara');
const buildCliDir = path.join(projectRoot, 'build', 'src', 'cli');
const officialSource = path.join(projectRoot, 'official-features');
const licenseSource = path.join(projectRoot, 'LICENSE');
const licenseDest = path.join(packageDir, 'LICENSE');
const distDir = path.join(packageDir, 'dist');
const officialDest = path.join(packageDir, 'official-features');
const substrateDest = path.join(packageDir, 'substrate');

// Guaranteed application substrate: source modules every generated app
// carries, mirrored under app-relative paths (substrate/src/shared/...).
// Kept explicit and small; see resolveSubstrateDirectory.
const SUBSTRATE_FILES = [
  'src/shared/database/index.ts',
  'src/shared/database/sqlite.ts',
  'src/shared/database/migrator.ts',
  'src/shared/database/seeder.ts',
  'src/shared/config/index.ts',
  'src/shared/config/constants.ts',
  'src/shared/config/env.ts',
];

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
if (!existsSync(licenseSource)) {
  fail(`missing ${licenseSource}`);
}
for (const relative of SUBSTRATE_FILES) {
  if (!existsSync(path.join(projectRoot, relative))) {
    fail(`missing substrate source ${relative}`);
  }
}

// Clean previous staged artifacts (generated only; never the package source).
for (const directory of [distDir, officialDest, substrateDest]) {
  rmSync(directory, { recursive: true, force: true });
}
rmSync(licenseDest, { force: true });

// Copy only CLI build output and official-feature source. Root runtime and
// build artifacts (build/client, build/server.js, database/, storage/,
// logs/, app sources) are never staged.
mkdirSync(distDir, { recursive: true });
cpSync(buildCliDir, distDir, { recursive: true });
chmodSync(path.join(distDir, 'index.js'), 0o755);

mkdirSync(officialDest, { recursive: true });
cpSync(officialSource, officialDest, { recursive: true });

mkdirSync(substrateDest, { recursive: true });
for (const relative of SUBSTRATE_FILES) {
  const destination = path.join(substrateDest, ...relative.split('/'));
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(projectRoot, relative), destination);
}
copyFileSync(licenseSource, licenseDest);
console.log('stage:package: staged dist, official-features, substrate, LICENSE');
