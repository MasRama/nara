// src/client/app.ts
import { createApp, h } from "vue";
import { createInertiaApp } from "@inertiajs/vue3";
function initInertiaApp(options = {}) {
  const {
    el = "#app",
    resolve = (name) => {
      const pages = import.meta.glob("./pages/**/*.vue", { eager: true });
      return pages[`./pages/${name}.vue`];
    }
  } = options;
  createInertiaApp({
    resolve,
    setup({ el: element, App, props, plugin }) {
      createApp({ render: () => h(App, props) }).use(plugin).mount(element);
    }
  });
}

export {
  initInertiaApp
};
