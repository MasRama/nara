import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = path.join(projectRoot, 'packages', 'nara');
const buildCliDir = path.join(projectRoot, 'build', 'src', 'cli');
// Official Features live installed in the reference app, marked by `.nara/`.
const featuresRoot = path.join(projectRoot, 'src', 'features');
const licenseSource = path.join(projectRoot, 'LICENSE');
const licenseDest = path.join(packageDir, 'LICENSE');
const distDir = path.join(packageDir, 'dist');
const officialDest = path.join(packageDir, 'official-features');
const legacySubstrateDest = path.join(packageDir, 'substrate');

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
const officialFeatures = readdirSync(featuresRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(featuresRoot, entry.name, '.nara')))
  .map((entry) => entry.name)
  .sort();
if (officialFeatures.length === 0) {
  fail(`no official Feature (a src/features/<name> with .nara/) under ${featuresRoot}`);
}
if (!existsSync(licenseSource)) {
  fail(`missing ${licenseSource}`);
}
// Clean previous staged artifacts (generated only; never the package source).
for (const directory of [distDir, officialDest]) {
  rmSync(directory, { recursive: true, force: true });
}
rmSync(legacySubstrateDest, { recursive: true, force: true });
rmSync(licenseDest, { force: true });

// Copy only CLI build output and official-feature source. Root runtime and
// build artifacts (build/client, build/server.js, database/, storage/,
// logs/, app sources) are never staged.
mkdirSync(distDir, { recursive: true });
cpSync(buildCliDir, distDir, { recursive: true });
chmodSync(path.join(distDir, 'index.js'), 0o755);

// Tests under tests/app/ exercise the reference application; they stay behind.
for (const feature of officialFeatures) {
  const source = path.join(featuresRoot, feature);
  const applicationTests = path.join(source, 'tests', 'app');
  cpSync(source, path.join(officialDest, feature), {
    recursive: true,
    filter: (entry) => entry !== applicationTests && !entry.startsWith(`${applicationTests}${path.sep}`),
  });
}

copyFileSync(licenseSource, licenseDest);
console.log(`stage:package: staged dist, official-features (${officialFeatures.join(', ')}), LICENSE`);
