import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');
const buildDirectory = path.join(projectRoot, 'build');

function cleanBuild(): void {
  if (buildDirectory === projectRoot || buildDirectory === path.parse(buildDirectory).root) {
    throw new Error(`Refusing to clean unsafe build path: ${buildDirectory}`);
  }

  if (existsSync(buildDirectory)) {
    rmSync(buildDirectory, { recursive: true, force: true });
  }
}

cleanBuild();
