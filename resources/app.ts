import { createInertiaApp } from '@inertiajs/svelte'
import { mount, type Component } from 'svelte'
import { ModeWatcher } from 'mode-watcher'
import { Toaster } from 'svelte-sonner'

createInertiaApp({
  resolve: (name: string) => {
    const pages = import.meta.glob('./Pages/**/*.svelte', { eager: true }) as Record<string, { default: Component }>
    return pages[`./Pages/${name}.svelte`]
  },
  setup({ el, App, props }) {
    el!.classList.add('dark:bg-gray-900', 'min-h-screen')
    mount(App, { target: el!, props })

    const portalEl = document.createElement('div')
    portalEl.id = 'inertia-portals'
    document.body.appendChild(portalEl)
    mount(ModeWatcher, { target: portalEl })
    mount(Toaster, { target: portalEl })
  },
})
