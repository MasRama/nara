import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const sourceRoot = path.resolve(process.cwd(), 'src', 'features');
const buildRoot = path.resolve(process.cwd(), 'build', 'src', 'features');

if (existsSync(sourceRoot)) {
  for (const feature of readdirSync(sourceRoot, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue;

    const source = path.join(sourceRoot, feature.name, 'server', 'migrations');
    if (!existsSync(source)) continue;

    const destination = path.join(buildRoot, feature.name, 'server', 'migrations');
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: true });
  }
}
