#!/usr/bin/env node
/**
 * SessionStart — print orientation context for the agent.
 *
 * Reminds the agent to read CODEMAP.md and AGENTS.md before exploring.
 * Non-blocking (exit 0).
 */
const fs = require('fs');
const path = require('path');

const projectDir = process.env.DEVIN_PROJECT_DIR || process.cwd();

let codemapExists = false;
let agentsExists = false;
let skillsExists = false;

try {
  codemapExists = fs.existsSync(path.join(projectDir, 'CODEMAP.md'));
  agentsExists = fs.existsSync(path.join(projectDir, 'AGENTS.md'));
  skillsExists = fs.existsSync(path.join(projectDir, '.agents', 'skills', 'SKILL.md'));
} catch {
  // Ignore
}

const tips = [];
if (codemapExists) {
  tips.push('Read CODEMAP.md first for codebase topology (111 files, 278 exports indexed).');
}
if (agentsExists) {
  tips.push('Read AGENTS.md for project conventions and anti-patterns.');
}
if (skillsExists) {
  tips.push('Load skills from .agents/skills/ on demand (crud-pattern, sqlite-usage, auth-rbac, inertia-patterns, error-handling).');
}
tips.push('Run npm run lint:layers before committing to verify layer boundaries.');

if (tips.length > 0) {
  console.log(JSON.stringify({
    context: 'Nara AI-first project. ' + tips.join(' ')
  }));
}

process.exit(0);
