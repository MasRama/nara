interface InitOptions {
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
declare function initInertiaApp(options?: InitOptions): void;

export { type InitOptions, initInertiaApp };
