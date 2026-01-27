import { createApp, h, type DefineComponent } from 'vue';
import { createInertiaApp } from '@inertiajs/vue3';

export interface InitOptions {
  /**
   * Resolve a page component by name
   */
  resolve?: (name: string) => any;
  /**
   * Element selector to mount the app
   * @default '#app'
   */
  el?: string;
}

/**
 * Initializes the Inertia app for Vue 3
 */
export function initInertiaApp(options: InitOptions = {}) {
  const {
    el = '#app',
    resolve = (name: string) => {
      const pages = (import.meta as any).glob('./pages/**/*.vue', { eager: true });
      return pages[`./pages/${name}.vue`];
    }
  } = options;

  createInertiaApp({
    resolve,
    setup({ el: element, App, props, plugin }: any) {
      createApp({ render: () => h(App, props) })
        .use(plugin)
        .mount(element);
    },
  });
}
