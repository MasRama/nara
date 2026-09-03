import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');
const buildDirectories = [path.join(projectRoot, 'build'), path.join(projectRoot, 'dist')];

for (const directory of buildDirectories) {
  if (directory === projectRoot || directory === path.parse(directory).root) {
    throw new Error(`Refusing to clean unsafe build path: ${directory}`);
  }

  if (existsSync(directory)) {
    rmSync(directory, { recursive: true, force: true });
  }
}
