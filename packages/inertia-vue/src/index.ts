export { vueAdapter } from './adapter';
export type { VueAdapterOptions } from './adapter';
export { createViteConfig } from './vite';
export type { ViteOptions } from './vite';
export { initInertiaApp } from './client/app';
export type { InitOptions } from './client/app';
// Note: Vue components and pages are templates, not bundled exports
// They are copied to user projects via create-nara CLI
