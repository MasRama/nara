import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/app/App.vue';

describe('Vue frontend shell', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
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
  });

  afterEach(() => {
    container.remove();
    document.documentElement.classList.remove('dark');
  });

  it('mounts the landing shell and preserves theme and copy interactions', async () => {
    const app = createApp(App);
    app.mount(container);
    await nextTick();

    expect(container.querySelector('h1')?.textContent).toContain('The craft of');

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

    app.unmount();
  });
});
