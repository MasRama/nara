import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/app/App.vue';
import router from '../../src/app/router';

describe('Vue frontend shell', () => {
  let container: HTMLDivElement;
  let app: ReturnType<typeof createApp> | undefined;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.append(container);
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    await router.push('/');
  });

  afterEach(async () => {
    app?.unmount();
    app = undefined;
    await router.push('/');
    container.remove();
    document.documentElement.classList.remove('dark');
  });

  async function mountAt(path: string): Promise<void> {
    await router.push(path);
    await router.isReady();
    app = createApp(App).use(router);
    app.mount(container);
    await nextTick();
  }

  it('renders home and navigates to LoginPage without a document reload', async () => {
    await mountAt('/');

    const documentElement = document.documentElement;
    const homeElement = container.firstElementChild;
    expect(container.querySelector('h1')?.textContent).toContain('The craft of');

    const loginLink = container.querySelector('a[href="/login"]');
    expect(loginLink).not.toBeNull();
    loginLink?.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(router.currentRoute.value.path).toBe('/login');
    expect(container.querySelector('h1')?.textContent).toContain('Welcome back');
    expect(container.firstElementChild).not.toBe(homeElement);
    expect(document.documentElement).toBe(documentElement);
  });

  it('resolves the direct login route to the auth Feature page', async () => {
    await mountAt('/login');

    expect(container.querySelector('h1')?.textContent).toContain('Welcome back');
    expect(container.querySelector('form')).not.toBeNull();
  });

  it('preserves landing theme and copy interactions', async () => {
    await mountAt('/');

    const themeButton = container.querySelector('nav button');
    expect(themeButton).not.toBeNull();
    themeButton?.dispatchEvent(new MouseEvent('click'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('nara-theme')).toBe('dark');

    const copyButton = container.querySelector('button[aria-label="Copy clone command"]');
    expect(copyButton).not.toBeNull();
    copyButton?.dispatchEvent(new MouseEvent('click'));
    await Promise.resolve();
    await nextTick();
    expect(copyButton?.textContent).toContain('copied');
  });
});
