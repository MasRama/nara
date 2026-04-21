import { createInertiaApp } from '@inertiajs/svelte'
import { mount } from 'svelte'
import axios from 'axios'
import { configureAxiosCSRF } from '$lib/csrf'
import { ModeWatcher } from 'mode-watcher'
import { Toaster } from '$lib/components/ui/sonner'

configureAxiosCSRF(axios)

createInertiaApp({
  resolve: name => {
    const pages = import.meta.glob('./Pages/**/*.svelte', { eager: true })
    return pages[`./Pages/${name}.svelte`]
  },
  setup({ el, App, props }) {
    el.classList.add('dark:bg-gray-900', 'min-h-screen');
    mount(App, { target: el, props })

    const portalEl = document.createElement('div');
    portalEl.id = 'inertia-portals';
    document.body.appendChild(portalEl);
    mount(ModeWatcher, { target: portalEl });
    mount(Toaster, { target: portalEl });
  },
})
