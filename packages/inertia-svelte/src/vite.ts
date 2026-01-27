import { defineConfig, type UserConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { readdirSync, existsSync } from 'fs';

export interface ViteOptions {
  /**
   * Root directory for the frontend resources
   * @default 'resources'
   */
  root?: string;

  /**
   * Output directory for the build
   * @default '../dist'
   */
  outDir?: string;

  /**
   * Port for the Vite dev server
   * @default process.env.VITE_PORT || 3000
   */
  port?: number;
}

/**
 * Creates a Vite configuration optimized for NARA + Svelte + Inertia
 *
 * @param options - Configuration options
 * @returns A Vite UserConfig object
 */
export function createViteConfig(options: ViteOptions = {}): UserConfig {
  const root = options.root || 'resources';
  const outDir = options.outDir || '../dist';
  const port = options.port || parseInt(process.env.VITE_PORT || '3000');

  // Automatically find entry points in views directory
  const input: Record<string, string> = {};
  const viewsDir = resolve(process.cwd(), root, 'views');

  if (existsSync(viewsDir)) {
    const files = readdirSync(viewsDir);
    for (const filename of files) {
      if (filename.endsWith('.html') && !filename.includes('partial')) {
        const name = filename.replace('.html', '');
        input[name] = resolve(viewsDir, filename);
      }
    }
  }

  return defineConfig({
    plugins: [
      svelte(),
      {
        name: 'nara-port-handling',
        configureServer(server) {
          server.httpServer?.on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
              console.error(`\x1b[31mError: Vite Port ${port} is already in use. Shutting down server.\x1b[0m`);
              process.exit(1);
            }
          });
        }
      }
    ],
    root,
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
    },
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        input,
      },
    },
  });
}
