import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, '..', 'templates');

interface ProjectOptions {
  projectName: string;
  targetDir: string;
  mode: 'minimal' | 'svelte' | 'vue';
  features: string[];
}

export async function setupProject(options: ProjectOptions) {
  const { projectName, targetDir, mode, features } = options;

  // Create target directory
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. Copy base template (shared files like .gitignore, tsconfig, etc)
  copyDir(path.join(templatesDir, 'base'), targetDir);

  // 2. Copy mode-specific template
  const modeTemplateDir = path.join(templatesDir, mode);
  if (fs.existsSync(modeTemplateDir)) {
    copyDir(modeTemplateDir, targetDir);
  }

  // 3. Ensure required directories exist
  fs.mkdirSync(path.join(targetDir, 'app/controllers'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'app/models'), { recursive: true });

  // 4. Generate package.json (dynamic content)
  const pkg = createPackageJson(projectName, mode, features);
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2));
}

function copyDir(src: string, dest: string) {
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function createPackageJson(name: string, mode: string, features: string[]) {
  const pkg: any = {
    name,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: mode === 'minimal' ? 'tsx watch server.ts' : 'concurrently "tsx watch server.ts" "vite"',
      build: 'tsc',
      start: 'node dist/server.js'
    },
    dependencies: {
      '@nara/core': '^0.1.0',
      'dotenv': '^16.4.7'
    },
    devDependencies: {
      'typescript': '^5.7.0',
      'tsx': '^4.19.0',
      '@types/node': '^22.0.0'
    }
  };

  if (mode === 'svelte') {
    pkg.dependencies['@nara/inertia-svelte'] = '^0.1.0';
    pkg.dependencies['svelte'] = '^5.0.0';
    pkg.devDependencies['vite'] = '^6.0.0';
    pkg.devDependencies['@sveltejs/vite-plugin-svelte'] = '^5.0.0';
    pkg.devDependencies['concurrently'] = '^9.0.0';
  } else if (mode === 'vue') {
    pkg.dependencies['@nara/inertia-vue'] = '^0.1.0';
    pkg.dependencies['vue'] = '^3.5.0';
    pkg.devDependencies['vite'] = '^6.0.0';
    pkg.devDependencies['@vitejs/plugin-vue'] = '^5.0.0';
    pkg.devDependencies['concurrently'] = '^9.0.0';
  }

  if (features.includes('db')) {
    pkg.dependencies['knex'] = '^3.1.0';
    pkg.dependencies['better-sqlite3'] = '^11.0.0';
  }

  return pkg;
}
