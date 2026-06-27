#!/usr/bin/env node
/**
 * PostToolUse(edit) — after file edits, check if layer lint should run.
 *
 * If the edited file is a .ts handler or .svelte component, output a reminder
 * to run `npm run lint:layers`. Non-blocking (exit 0).
 */
const fs = require('fs');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = data.tool_input?.file_path || '';

    // Only care about .ts and .svelte files
    if (!filePath.match(/\.(ts|svelte)$/)) {
      process.exit(0);
    }

    // Check if file is in a layer that lint:layers covers
    const isHandler = filePath.includes('/app/handlers/');
    const isFrontend = filePath.includes('/resources/') && filePath.endsWith('.svelte');
    const isBackend = filePath.includes('/app/') && filePath.endsWith('.ts');

    if (isHandler || isFrontend || isBackend) {
      // Output context for the agent — non-blocking
      console.log(JSON.stringify({
        context: `Layer boundary lint may be needed after editing ${filePath.split('/').pop()}. Run: npm run lint:layers`
      }));
    }
  } catch {
    // Parse error — no-op
  }
  process.exit(0);
});
