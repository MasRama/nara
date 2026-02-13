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

  // 3. Copy feature-specific templates
  const featuresDir = path.join(templatesDir, 'features');
  for (const feature of features) {
    const featureDir = path.join(featuresDir, feature);
    if (fs.existsSync(featureDir)) {
      copyDir(featureDir, targetDir);
    }
  }

  // 4. Rename dotfiles (npm doesn't include them by default)
  // Must happen AFTER all templates are copied
  const gitignoreTemplate = path.join(targetDir, 'gitignore.template');
  const gitignoreDest = path.join(targetDir, '.gitignore');
  if (fs.existsSync(gitignoreTemplate)) {
    fs.renameSync(gitignoreTemplate, gitignoreDest);
  }

  // Rename env files
  const envFiles = [
    { src: 'env.example', dest: '.env.example' },
    { src: 'env.production.example', dest: '.env.production.example' }
  ];
  for (const envFile of envFiles) {
    const envSrc = path.join(targetDir, envFile.src);
    const envDest = path.join(targetDir, envFile.dest);
    if (fs.existsSync(envSrc)) {
      fs.renameSync(envSrc, envDest);
    }
  }

  // Copy .env.example to .env for development convenience
  const envExample = path.join(targetDir, '.env.example');
  const envFile = path.join(targetDir, '.env');
  if (fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envFile);
  }

  // 5. Ensure required directories exist
  fs.mkdirSync(path.join(targetDir, 'app/controllers'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'app/models'), { recursive: true });

  // Create database directory if db feature is selected
  if (features.includes('db')) {
    fs.mkdirSync(path.join(targetDir, 'database'), { recursive: true });
  }

  // Create uploads directory if uploads feature is selected
  if (features.includes('uploads')) {
    fs.mkdirSync(path.join(targetDir, 'uploads'), { recursive: true });
  }

  // 6. Generate package.json (dynamic content)
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
      start: 'node dist/server.js',
      "db:migrate": 'knex migrate:latest --knexfile knexfile.ts',
      "db:migrate:rollback": 'knex migrate:rollback --knexfile knexfile.ts',
      "db:seed": 'knex seed:run --knexfile knexfile.ts'
    },
    dependencies: {
      '@nara-web/core': '^1.0.0',
      'dotenv': '^16.4.7',
      'tsconfig-paths': '^4.2.0'
    },
    devDependencies: {
      'typescript': '^5.7.0',
      'tsx': '^4.19.0',
      '@types/node': '^22.0.0'
    }
  };

  if (mode === 'svelte') {
    pkg.dependencies['@nara-web/inertia-svelte'] = '^1.0.0';
    pkg.dependencies['svelte'] = '^5.0.0';
    pkg.dependencies['@tailwindcss/typography'] = '^0.5.16';
    pkg.dependencies['tsconfig-paths'] = '^4.2.0';
    pkg.devDependencies['vite'] = '^5.4.10';
    pkg.devDependencies['@sveltejs/vite-plugin-svelte'] = '^4.0.0';
    pkg.devDependencies['concurrently'] = '^9.0.0';
    pkg.devDependencies['tailwindcss'] = '^3.4.14';
    pkg.devDependencies['autoprefixer'] = '^10.4.20';
  } else if (mode === 'vue') {
    pkg.dependencies['@nara-web/inertia-vue'] = '^1.0.0';
    pkg.dependencies['vue'] = '^3.5.0';
    pkg.dependencies['tsconfig-paths'] = '^4.2.0';
    pkg.devDependencies['vite'] = '^6.0.0';
    pkg.devDependencies['@vitejs/plugin-vue'] = '^5.0.0';
    pkg.devDependencies['concurrently'] = '^9.0.0';
    pkg.devDependencies['tailwindcss'] = '^4.0.0';
    pkg.devDependencies['@tailwindcss/postcss'] = '^4.0.0';
    pkg.devDependencies['autoprefixer'] = '^10.4.20';
  }

  if (features.includes('db')) {
    pkg.dependencies['knex'] = '^3.1.0';
    pkg.dependencies['better-sqlite3'] = '^11.0.0';
    pkg.dependencies['dayjs'] = '^1.11.13';
    pkg.devDependencies['@types/better-sqlite3'] = '^7.6.0';
  }

  if (features.includes('auth')) {
    pkg.dependencies['bcrypt'] = '^5.1.0';
    pkg.dependencies['jsonwebtoken'] = '^9.0.0';
    pkg.devDependencies['@types/bcrypt'] = '^5.0.0';
    pkg.devDependencies['@types/jsonwebtoken'] = '^9.0.0';
  }

  if (features.includes('uploads')) {
    pkg.dependencies['sharp'] = '^0.33.0';
    pkg.devDependencies['@types/sharp'] = '^0.32.0';
  }

  return pkg;
}
