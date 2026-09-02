import { describe, expect, it } from 'vitest';
import { runCli, type CliIO } from '../router';

function createTestIO(): CliIO & { output: string[]; errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    output,
    errors,
    stdout: (message) => output.push(message),
    stderr: (message) => errors.push(message),
  };
}

describe('Nara CLI router', () => {
  it('prints help with a successful exit code', () => {
    const io = createTestIO();

    const result = runCli(['--help'], io);

    expect(result.exitCode).toBe(0);
    expect(io.output.join('')).toContain('Nara v3 CLI');
    expect(io.errors).toHaveLength(0);
  });

  it('reports unknown commands with a usage error exit code', () => {
    const io = createTestIO();

    const result = runCli(['missing'], io);

    expect(result.exitCode).toBe(64);
    expect(io.errors.join('')).toContain('Unknown command: missing');
  });
});
