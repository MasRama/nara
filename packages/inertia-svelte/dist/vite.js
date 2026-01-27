"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createViteConfig = createViteConfig;
const vite_1 = require("vite");
const vite_plugin_svelte_1 = require("@sveltejs/vite-plugin-svelte");
const path_1 = require("path");
const fs_1 = require("fs");
function createViteConfig(options = {}) {
    const root = options.root || 'resources';
    const outDir = options.outDir || '../dist';
    const port = options.port || parseInt(process.env.VITE_PORT || '3000');
    const input = {};
    const viewsDir = (0, path_1.resolve)(process.cwd(), root, 'views');
    if ((0, fs_1.existsSync)(viewsDir)) {
        const files = (0, fs_1.readdirSync)(viewsDir);
        for (const filename of files) {
            if (filename.endsWith('.html') && !filename.includes('partial')) {
                const name = filename.replace('.html', '');
                input[name] = (0, path_1.resolve)(viewsDir, filename);
            }
        }
    }
    return (0, vite_1.defineConfig)({
        plugins: [
            (0, vite_plugin_svelte_1.svelte)(),
            {
                name: 'nara-port-handling',
                configureServer(server) {
                    server.httpServer?.on('error', (err) => {
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
//# sourceMappingURL=vite.js.map