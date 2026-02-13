import prompts from 'prompts';
import pc from 'picocolors';
import path from 'path';
import { setupProject } from './template.js';
export async function main() {
    console.log(pc.bold(pc.cyan('\n  🚀 NARA - Create New Project\n')));
    let projectName = process.argv[2];
    if (!projectName) {
        const res = await prompts({
            type: 'text',
            name: 'projectName',
            message: 'Project name:',
            initial: 'my-nara-app'
        });
        projectName = res.projectName;
        if (!projectName)
            process.exit(1);
    }
    const targetDir = path.resolve(process.cwd(), projectName);
    console.log(pc.dim(`\nCreating Svelte project in ${targetDir}...\n`));
    await setupProject({ projectName, targetDir });
    console.log(pc.green('\n✓ Project created successfully!\n'));
    console.log('Next steps:\n');
    console.log(pc.cyan(`  cd ${projectName}`));
    console.log(pc.cyan('  npm install'));
    console.log(pc.cyan('  npm run dev\n'));
}
