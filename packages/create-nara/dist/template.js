import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, '..', 'templates');
export async function setupProject(options) {
    const { projectName, targetDir } = options;
    // Create target directory
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    // Copy Svelte template
    const svelteTemplateDir = path.join(templatesDir, 'svelte');
    if (fs.existsSync(svelteTemplateDir)) {
        copyDir(svelteTemplateDir, targetDir);
    }
    // Rename dotfiles (npm doesn't include them by default)
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
    // Ensure required directories exist
    fs.mkdirSync(path.join(targetDir, 'app/controllers'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'app/models'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'database'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'storage'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'migrations'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'seeds'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'commands/native'), { recursive: true });
    // Generate package.json (dynamic content)
    const pkg = createPackageJson(projectName);
    fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2));
}
function copyDir(src, dest) {
    fs.cpSync(src, dest, { recursive: true, force: true });
}
function createPackageJson(name) {
    const pkg = {
        name,
        version: '0.1.0',
        type: 'module',
        scripts: {
            dev: 'concurrently "tsx watch server.ts" "vite"',
            build: 'tsc',
            start: 'node dist/server.js'
        },
        dependencies: {
            '@nara-web/core': '^1.0.0',
            '@nara-web/inertia-svelte': '^1.0.0',
            'dotenv': '^16.4.7',
            'tsconfig-paths': '^4.2.0',
            'svelte': '^5.0.0',
            'knex': '^3.1.0',
            'better-sqlite3': '^11.0.0',
            'dayjs': '^1.11.13',
            'pino': '^10.1.0',
            'pino-pretty': '^13.1.2',
            'pino-roll': '^4.0.0',
            'googleapis': '^144.0.0',
            'axios': '^1.7.0',
            'sharp': '^0.33.0',
        },
        devDependencies: {
            'typescript': '^5.7.0',
            'tsx': '^4.19.0',
            'ts-node': '^10.9.2',
            '@types/node': '^22.0.0',
            '@types/better-sqlite3': '^7.6.0',
            'vite': '^5.4.10',
            '@sveltejs/vite-plugin-svelte': '^4.0.0',
            'concurrently': '^9.0.0',
            'tailwindcss': '^3.4.14',
            'autoprefixer': '^10.4.20',
            '@tailwindcss/typography': '^0.5.16',
        }
    };
    return pkg;
}
