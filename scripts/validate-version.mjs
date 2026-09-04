import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  const absolute = path.join(projectRoot, relativePath);
  try {
    return JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    console.error(`validate:version: cannot read ${relativePath}: ${error.message}`);
    process.exit(1);
  }
}

const rootManifest = readJson('package.json');
const publishableManifest = readJson('packages/nara/package.json');
const lockfile = readJson('package-lock.json');

// npm lockfileVersion 3 records the root version twice: top-level
// `version` and `packages[""].version`. Both must track the manifests.
const observed = new Map([
  ['package.json → version', rootManifest.version],
  ['packages/nara/package.json → version', publishableManifest.version],
  ['package-lock.json → version', lockfile.version],
  ['package-lock.json → packages[""].version', lockfile.packages?.['']?.version],
]);

let failed = false;
for (const [label, value] of observed) {
  if (typeof value !== 'string' || value.length === 0) {
    console.error(`validate:version: ${label} is missing or not a string`);
    failed = true;
  }
}

const distinct = new Set(observed.values());
if (distinct.size > 1 || failed) {
  console.error('validate:version: version incoherence detected:');
  for (const [label, value] of observed) {
    console.error(`  ${label}: ${JSON.stringify(value)}`);
  }
  console.error('Fix: bump every manifest together (root `npm version <v> --no-git-tag-version` plus packages/nara/package.json).');
  process.exit(1);
}

console.log(`validate:version: coherent at ${rootManifest.version}`);
