/**
 * Nara CLI
 * 
 * Command-line interface for Nara framework.
 * Usage: node nara <command> [options]
 */
import * as fs from 'fs';
import * as path from 'path';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  red: '\x1b[31m',
};

const c = colors;

function printBanner() {
  console.log(`
${c.cyan}${c.bright}    _   __                 
   / | / /___ __________ _ 
  /  |/ / __ \`/ ___/ __ \`/ 
 / /|  / /_/ / /  / /_/ /  
/_/ |_/\__,_/_/   \__,_/   
${c.reset}
${c.dim}High-performance TypeScript Web Framework${c.reset}
${c.dim}Version 1.0.9${c.reset}
`);
}

function printHelp(commands: Array<{ name: string; description: string }>) {
  printBanner();
  
  console.log(`${c.yellow}${c.bright}Usage:${c.reset}`);
  console.log(`  node nara <command> [arguments]\n`);
  
  console.log(`${c.yellow}${c.bright}Available Commands:${c.reset}`);
  
  // Group commands
  const makeCommands = commands.filter(cmd => cmd.name.startsWith('make:'));
  const otherCommands = commands.filter(cmd => !cmd.name.startsWith('make:'));
  
  if (makeCommands.length > 0) {
    console.log(`\n  ${c.green}${c.bright}make${c.reset}`);
    for (const cmd of makeCommands) {
      const cmdName = cmd.name.padEnd(20);
      console.log(`    ${c.cyan}${cmdName}${c.reset} ${c.dim}${cmd.description}${c.reset}`);
    }
  }
  
  if (otherCommands.length > 0) {
    console.log(`\n  ${c.green}${c.bright}other${c.reset}`);
    for (const cmd of otherCommands) {
      const cmdName = cmd.name.padEnd(20);
      console.log(`    ${c.cyan}${cmdName}${c.reset} ${c.dim}${cmd.description}${c.reset}`);
    }
  }
  
  console.log(`\n${c.yellow}${c.bright}Examples:${c.reset}`);
  console.log(`  ${c.dim}node nara make:controller User${c.reset}`);
  console.log(`  ${c.dim}node nara make:service Payment${c.reset}`);
  console.log(`  ${c.dim}node nara make:middleware RateLimit${c.reset}`);
  console.log(`  ${c.dim}node nara make:validator CreatePost${c.reset}`);
  console.log(`  ${c.dim}node nara make:migration create_posts_table${c.reset}`);
  console.log();
}

function printSuccess(message: string) {
  console.log(`\n${c.green}✔${c.reset} ${message}`);
}

function printError(message: string) {
  console.log(`\n${c.red}✖${c.reset} ${message}`);
}

function printInfo(message: string) {
  console.log(`${c.blue}ℹ${c.reset} ${message}`);
}

// Export utilities for commands to use
export { printSuccess, printError, printInfo, colors };

(async () => {
  const nativesDir = path.join(__dirname, 'native');
  const natives = fs.readdirSync(nativesDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  
  const args = process.argv.slice(2);
  const commandName = args[0];
  
  // Load all commands
  const commands: Array<{ name: string; description: string; instance: any }> = [];
  
  for (const file of natives) {
    const command = await import('./native/' + file.replace(/\.(ts|js)$/, ''));
    if (command.default && command.default.commandName) {
      commands.push({
        name: command.default.commandName,
        description: command.default.description || '',
        instance: command.default,
      });
    }
  }
  
  // Sort commands alphabetically
  commands.sort((a, b) => a.name.localeCompare(b.name));
  
  // No command or help command
  if (!commandName || commandName === 'help' || commandName === '--help' || commandName === '-h') {
    printHelp(commands);
    process.exit(0);
  }
  
  // Find and run command
  const cmd = commands.find(c => c.name === commandName);
  
  if (cmd) {
    cmd.instance.args = args;
    await cmd.instance.run();
  } else {
    printError(`Command "${commandName}" not found.`);
    console.log(`\n${c.dim}Run "node nara help" to see available commands.${c.reset}\n`);
    process.exit(1);
  }
})();