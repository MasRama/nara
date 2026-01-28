import prompts from 'prompts';
import pc from 'picocolors';
import path from 'path';
import { setupProject } from './template.js';

export async function main() {
  console.log(pc.bold(pc.cyan('\n  🚀 NARA - Create New Project\n')));

  let projectName = process.argv[2];
  let mode = process.argv[3];

  if (!projectName) {
    const res = await prompts({
      type: 'text',
      name: 'projectName',
      message: 'Project name:',
      initial: 'my-nara-app'
    });
    projectName = res.projectName;
    if (!projectName) process.exit(1);
  }

  const validModes = ['minimal', 'svelte', 'vue'];
  if (!mode || !validModes.includes(mode)) {
    const res = await prompts({
      type: 'select',
      name: 'mode',
      message: 'Select project mode:',
      choices: [
        { title: 'Minimal (API only)', value: 'minimal', description: 'Backend API without frontend' },
        { title: 'Fullstack with Svelte 5', value: 'svelte', description: 'Recommended - Full stack with Svelte' },
        { title: 'Fullstack with Vue 3', value: 'vue', description: 'Full stack with Vue' }
      ],
      initial: 1
    });
    mode = res.mode;
    if (!mode) process.exit(1);
  }

  const features = ['auth', 'db', 'uploads'];

  const targetDir = path.resolve(process.cwd(), projectName);

  console.log(pc.dim(`\nCreating project in ${targetDir}...\n`));

  await setupProject({ projectName, targetDir, mode: mode as 'minimal' | 'svelte' | 'vue', features: features || [] });

  console.log(pc.green('\n✓ Project created successfully!\n'));
  console.log('Next steps:\n');
  console.log(pc.cyan(`  cd ${projectName}`));
  console.log(pc.cyan('  npm install'));
  console.log(pc.cyan('  npm run dev\n'));
}
