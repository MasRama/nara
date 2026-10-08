import path from 'node:path';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

describe('Vue frontend production build', () => {
  it('includes utility styles used by Feature-owned pages', async () => {
    const result = await build({
      configFile: path.resolve(process.cwd(), 'vite.config.mjs'),
      mode: 'production',
      build: { write: false },
    });
    const outputs = Array.isArray(result) ? result.flatMap((environment) => environment.output) : result.output;
    const stylesheet = outputs.find(
      (output) => output.type === 'asset' && output.fileName.endsWith('.css'),
    );

    expect(stylesheet?.type).toBe('asset');
    if (!stylesheet || stylesheet.type !== 'asset') {
      throw new Error('The production build did not emit a stylesheet asset');
    }

    const css = typeof stylesheet.source === 'string'
      ? stylesheet.source
      : new TextDecoder().decode(stylesheet.source);
    // Utilities that only Feature pages use prove Tailwind scans src/features.
    expect(css).toContain('.gap-3\\.5');
    expect(css).toContain('.text-\\[13px\\]');
    expect(css).toContain('--nara-bg:#f6f5ef');
  }, 30_000); // A real Vite build can exceed the 5s default while the suite runs in parallel.
});
