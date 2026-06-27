#!/usr/bin/env node
/**
 * PostToolUse(exec) — after exec commands, check if verification needed.
 *
 * If the agent ran `npm run build` or `npm test` but NOT `npm run lint:layers`,
 * remind to run layer lint. Non-blocking (exit 0).
 */
const fs = require('fs');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cmd = (data.tool_input?.command || '').toString();
    const response = data.tool_response?.output || '';

    // If build or test passed, remind about layer lint
    if (/npm\s+run\s+(build|test)/.test(cmd) && /exit code: 0/i.test(response)) {
      console.log(JSON.stringify({
        context: 'Build/test passed. Consider running `npm run lint:layers` to verify layer boundaries.'
      }));
    }

    // If lint:layers failed, remind to fix violations
    if (/npm\s+run\s+lint:layers/.test(cmd) && /exit code: 1/i.test(response)) {
      console.log(JSON.stringify({
        context: 'Layer boundary lint failed. Fix violations before committing. See scripts/lint-layers.ts for rules.'
      }));
    }
  } catch {
    // Parse error — no-op
  }
  process.exit(0);
});
