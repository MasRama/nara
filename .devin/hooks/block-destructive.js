#!/usr/bin/env node
/**
 * PreToolUse(exec) — block destructive commands.
 *
 * Blocks: rm -rf, git push --force, git reset --hard, DROP TABLE, etc.
 * Reads event JSON from stdin, exits 2 to block, 0 to allow.
 */
const fs = require('fs');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cmd = (data.tool_input?.command || '').toString();

    const destructive = [
      { pattern: /rm\s+-rf\s+\//, reason: 'rm -rf on root path is blocked' },
      { pattern: /rm\s+-rf\s+~/, reason: 'rm -rf on home directory is blocked' },
      { pattern: /git\s+push\s+.*--force/, reason: 'force push is blocked — use --force-with-lease' },
      { pattern: /git\s+push\s+-f\b/, reason: 'force push is blocked — use --force-with-lease' },
      { pattern: /git\s+reset\s+--hard/, reason: 'git reset --hard is blocked — uncommitted changes will be lost' },
      { pattern: /git\s+clean\s+-fd/, reason: 'git clean -fd is blocked — untracked files will be deleted' },
      { pattern: /DROP\s+TABLE/i, reason: 'DROP TABLE in shell is blocked — use migrations' },
      { pattern: /DROP\s+DATABASE/i, reason: 'DROP DATABASE is blocked' },
      { pattern: /TRUNCATE\s+TABLE/i, reason: 'TRUNCATE TABLE is blocked — use migrations' },
    ];

    for (const { pattern, reason } of destructive) {
      if (pattern.test(cmd)) {
        console.log(JSON.stringify({ decision: 'block', reason }));
        process.exit(2);
      }
    }
  } catch {
    // Parse error — allow the command
  }
  process.exit(0);
});
