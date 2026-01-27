import './index.css';
import { createInertiaApp } from '@inertiajs/svelte';
import { mount, type Component } from 'svelte';

type PageModule = { default: Component };
type PageModules = Record<string, PageModule>;

createInertiaApp({
  resolve: (name: string) => {
    const pages = import.meta.glob<PageModule>('./pages/**/*.svelte', { eager: true });
    return (pages as PageModules)[`./pages/${name}.svelte`];
  },
  setup({ el, App, props }: { el: HTMLElement; App: Component; props: Record<string, unknown> }) {
    mount(App, { target: el, props });
  }
});
