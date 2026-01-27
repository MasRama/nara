import { UserConfig } from 'vite';
export { InitOptions, initInertiaApp } from './client/app.cjs';

/**
 * Nara Request and Response minimal interfaces for the adapter
 */
interface NaraRequest {
    protocol: string;
    get(header: string): string | undefined;
    header(header: string): string | undefined;
    originalUrl: string;
    cookies: Record<string, any>;
    [key: string]: any;
}
interface NaraResponse {
    type(type: string): this;
    send(body: any): any;
    json(body: any): any;
    setHeader(name: string, value: string): this;
    status(code: number): this;
    cookie(name: string, value: any, options?: any): this;
    clearCookie(name: string): this;
    inertia?: (component: string, props?: Record<string, any>, viewProps?: Record<string, any>) => Promise<any>;
    [key: string]: any;
}
type AdapterMiddlewareHandler = (req: NaraRequest, res: NaraResponse, next: () => void) => unknown | Promise<unknown>;
interface FrontendAdapter {
    name: string;
    middleware: () => AdapterMiddlewareHandler;
    extendResponse: (res: NaraResponse) => void;
}

interface VueAdapterOptions {
    /**
     * The root view template file name
     * @default 'inertia.html'
     */
    rootView?: string;
    /**
     * The version of the assets
     * @default '1.0.0'
     */
    version?: string;
}

/**
 * Vue 3 adapter for Inertia.js
 *
 * Provides Inertia.js support for Vue 3 components.
 */
declare function vueAdapter(options?: VueAdapterOptions): FrontendAdapter;

interface ViteOptions {
    /**
     * Options for the Vue plugin
     */
    vueOptions?: any;
}
/**
 * Creates a Vite configuration for NARA + Vue 3
 */
declare function createViteConfig(options?: ViteOptions): UserConfig;

export { type ViteOptions, type VueAdapterOptions, createViteConfig, vueAdapter };
