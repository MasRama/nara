import { readFileSync } from 'node:fs';
import { compileStyle, parse } from '@vue/compiler-sfc';
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
    expect(container.querySelector('h1')?.textContent).toContain('Build by feature.');

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

  it('keeps login and registration in one landing-aligned design with the same theme preference', async () => {
    await mountAt('/login');
    expect(container.querySelector('.nara-auth-story-title')?.textContent).toContain('Build by feature.');
    expect(container.querySelector('.nara-auth-brand img')?.getAttribute('src')).toBe('/nara.png');
    expect(container.querySelectorAll('.nara-auth-form .nara-auth-input')).toHaveLength(2);
    expect(container.querySelector('.nara-auth-form-kicker')).toBeNull();
    expect(container.querySelector('.nara-auth-principles')).toBeNull();
    expect(container.querySelector('.nara-auth-grid')).toBeNull();
    expect(container.querySelector('.nara-auth-form-description')).toBeNull();

    const loginTheme = container.querySelector<HTMLButtonElement>('.nara-auth-theme');
    expect(loginTheme?.getAttribute('aria-label')).toBe('Use dark mode');
    loginTheme?.click();
    await nextTick();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('nara-theme')).toBe('dark');

    container.querySelector<HTMLAnchorElement>('a[href="/register"]')?.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await nextTick();
    expect(router.currentRoute.value.name).toBe('register');
    expect(container.querySelector('h1')?.textContent).toContain('Create your account.');
    expect(container.querySelector('.nara-auth-theme')?.getAttribute('aria-label')).toBe('Use light mode');
    expect(container.querySelectorAll('.nara-auth-form .nara-auth-input')).toHaveLength(4);
    expect(container.querySelector('.nara-auth-form-kicker')).toBeNull();
    expect(container.querySelector('.nara-auth-form-description')).toBeNull();

    const password = container.querySelector<HTMLInputElement>('#password');
    expect(password?.type).toBe('password');
    container.querySelector<HTMLButtonElement>('button[aria-label="Show password"]')?.click();
    await nextTick();
    expect(password?.type).toBe('text');
    container.querySelector<HTMLButtonElement>('button[aria-label="Show confirmation"]')?.click();
    await nextTick();
    expect(container.querySelector<HTMLInputElement>('#password-confirmation')?.type).toBe('text');
  });

  it('renders the Vue 404 surface for unknown browser routes', async () => {
    await mountAt('/this-route-does-not-exist');

    expect(container.querySelector('[data-testid="not-found-page"]')).not.toBeNull();
    expect(container.querySelector('h1')?.textContent).toContain('Page not found');
  });

  it('renders the landing hero and section navigation', async () => {
    await mountAt('/');

    expect(container.querySelector('.hero-stack')?.textContent).toContain('TypeScript');
    expect(container.querySelector('.hero-title')?.textContent).toContain('Prove every boundary.');
    for (const section of ['why', 'inside', 'workflow']) {
      expect(container.querySelector(`a[href="#${section}"]`)).not.toBeNull();
      expect(container.querySelector(`section[id="${section}"]`)).not.toBeNull();
    }
  });

  it('shares one header frame between the landing page and the authenticated shell', async () => {
    await mountAt('/');
    const header = container.querySelector('.site-header');
    expect(header?.classList.contains('site-header--landing')).toBe(true);
    expect(header?.querySelector('nav[aria-label="Primary navigation"]')?.classList.contains('site-header-nav')).toBe(true);
    expect(header?.querySelector('.site-header-cta')?.textContent).toContain('Sign in');

    const shell = readFileSync('src/app/layouts/AuthenticatedShell.vue', 'utf8');
    expect(shell).toContain(`<SiteHeader :nav-label="t('shell.navLabel')">`);
    const css = parse(readFileSync('src/app/layouts/SiteHeader.vue', 'utf8')).descriptor.styles[0]!.content;
    // Narrow screens move the links to their own horizontally scrollable row.
    expect(css).toMatch(/@media \(max-width: 900px\) \{[^@]*\.site-header-nav \{[^}]*grid-row: 2;[^}]*overflow-x: auto;/);
  });

  it('keeps the hero free of decorative artwork and badges', async () => {
    await mountAt('/');
    expect(container.querySelector('.hero svg')).toBeNull();
    expect(container.querySelector('.hero-kicker')).toBeNull();
    expect(container.querySelector('.feature-map')).toBeNull();
    expect(container.querySelector('.brand-band')).toBeNull();
  });

  it('shows the import, diagnosis, and verified fix in the hero without a terminal pane', async () => {
    await mountAt('/');
    const hero = container.querySelector('.hero');
    const editor = hero?.querySelector('.hero-review-code');
    const buttons = [...hero!.querySelectorAll<HTMLButtonElement>('.hero-review-steps button')];
    expect(buttons).toHaveLength(3);
    expect(hero?.querySelector('.hero-terminal')).toBeNull();
    expect(editor?.textContent).toContain('@/features/users/server/repository');
    expect(hero?.querySelector('.hero-review-diagnostic')?.textContent).toContain('1 issue found');
    buttons[1]!.click();
    await nextTick();
    expect(editor?.textContent).toContain("@/features/users'");
    expect(editor?.textContent).not.toContain('users/server/repository');
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    await nextTick();
    expect(hero?.querySelector('.hero-review-diagnostic')?.textContent).toContain('Use the public boundary.');
    buttons[2]!.click();
    await nextTick();
    expect(buttons[2]!.getAttribute('aria-pressed')).toBe('true');
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    await nextTick();
    expect(hero?.querySelector('.hero-review-diagnostic')?.textContent).toContain('Architecture looks healthy.');
    buttons[0]!.click();
    await nextTick();
    expect(editor?.textContent).toContain('users/server/repository');
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    await nextTick();
    expect(hero?.querySelector('.hero-review-diagnostic')?.textContent).toContain('BOUNDARY VIOLATION');
    expect(container.querySelectorAll('.proof-item')).toHaveLength(4);
  });

  it('explains the feature model through a product example instead of floating architecture cards', async () => {
    await mountAt('/');
    const section = container.querySelector('#why');
    expect(section?.querySelector('h2')?.textContent).toContain('One feature.');
    expect(section?.querySelector('.feature-receipt')?.textContent).toContain('Studio membership');
    expect(section?.querySelectorAll('.feature-anatomy-list li')).toHaveLength(4);
    expect(section?.querySelectorAll('.feature-access')).toHaveLength(2);
    expect(section?.querySelector('.feature-showcase-thread')?.textContent).toContain('ONE FEATURE, TWO SIDES');
    expect(section?.querySelector('.feature-anatomy-lead')?.textContent).toContain('invoice on the left');
    expect([...section!.querySelectorAll('.feature-access code')].map((item) => item.textContent)).toEqual(['index.ts', 'web/index.ts']);
    expect(section?.querySelector('.feature-folio')).toBeNull();
  });

  it('uses one shared inter-section spacing rule without stacking individual section padding', () => {
    const source = readFileSync('src/app/pages/HomePage.vue', 'utf8');
    const { descriptor } = parse(source);
    const css = descriptor.styles[0]!.content;
    expect(css).toMatch(/--lp-section-gap:\s*clamp\(/);
    expect(css).toMatch(/\.landing-page main > section \+ section\s*\{\s*margin-top:\s*var\(--lp-section-gap\)/);
    expect(css).toMatch(/\.site-footer\s*\{\s*margin-top:\s*var\(--lp-section-gap\)/);
    for (const selector of ['proof-strip', 'section', 'closing-section']) {
      const rules = [...css.matchAll(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, 'g'))];
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((rule) => !/padding(?:-top|-bottom)?:\s*(?:[1-9]\d*px|clamp\()/i.test(rule[1] ?? ''))).toBe(true);
    }
  });

  it('lets visitors explore five distinct workflow views without terminal showcases', async () => {
    await mountAt('/');
    const section = container.querySelector('#workflow');
    const tabs = [...section!.querySelectorAll<HTMLButtonElement>('.stage-tab')];
    expect(tabs).toHaveLength(5);
    const scenes = ['wf-compose', 'wf-own', 'wf-understand', 'wf-evolve', 'wf-protect'];
    for (let index = 0; index < tabs.length; index += 1) {
      tabs[index]!.click();
      await nextTick();
      expect(tabs[index]!.getAttribute('aria-selected')).toBe('true');
      expect(section?.querySelector('.workflow-canvas')?.classList.contains(`workflow-canvas--${tabs[index]!.id.replace('stage-tab-', '')}`)).toBe(true);
      expect(section?.querySelector(`.${scenes[index]}`)).not.toBeNull();
      expect(section?.querySelector('.stage-window')).toBeNull();
      expect(section?.querySelector('.stage-commands')).toBeNull();
    }
    tabs[0]!.click();
    await nextTick();
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await nextTick();
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
  });

  it('presents the real ecosystem as SVG marks without the old boxed tech grid', async () => {
    await mountAt('/');
    const section = container.querySelector('#principles');
    expect(section?.querySelector('.principles-stack-list')).toBeNull();
    expect(section?.querySelector('.ecosystem-title')?.textContent).toContain('Own the architecture.');
    expect(section?.querySelectorAll('.ecosystem-logo-entry')).toHaveLength(8);
    expect(section?.querySelectorAll('.ecosystem-footnotes > div')).toHaveLength(3);
    const logos = section?.querySelectorAll<HTMLImageElement>('.ecosystem-logo-mark img');
    expect(logos).toHaveLength(9);
    logos?.forEach((logo) => {
      const path = logo.getAttribute('src');
      expect(path).toMatch(/^\/landing\/brands\/[a-z]+\.svg$/);
      expect(readFileSync(`public${path}`, 'utf8')).toContain('<svg');
    });
    const zodLogo = section?.querySelector<HTMLImageElement>('.ecosystem-logo-entry--zod img');
    expect(zodLogo?.getAttribute('src')).toBe('/landing/brands/zodfull.svg');
    expect(readFileSync('public/landing/brands/zodfull.svg', 'utf8')).toContain('viewBox="0 0 1309 1075"');
  });

  it('shows four editorial principles without the former comparison table', async () => {
    await mountAt('/');
    const section = container.querySelector('#principles');
    expect(section?.querySelector('.principles-manifesto-title')?.textContent).toContain('when to stop.');
    expect(section?.querySelectorAll('.principles-reading .principle-row')).toHaveLength(4);
    expect(section?.querySelectorAll('.principle-detail')).toHaveLength(8);
    expect(section?.querySelector('.principles-ledger-head')).toBeNull();
    expect(section?.querySelector('.principles-ecosystem .ecosystem-logos')).not.toBeNull();
  });

  it('applies compiled dark colors to the landing surface, not just its ancestor', async () => {
    await mountAt('/');
    const source = readFileSync('src/app/pages/HomePage.vue', 'utf8');
    const { descriptor } = parse(source);
    const compiled = compileStyle({ source: descriptor.styles[0]!.content, filename: 'HomePage.vue', id: 'data-v-theme-test', scoped: true });
    expect(compiled.errors).toEqual([]);
    const style = document.createElement('style');
    style.textContent = `${readFileSync('resources/palette.css', 'utf8')}\n${compiled.code}`;
    document.head.append(style);
    const landing = container.querySelector('.landing-page') as HTMLElement;
    landing.setAttribute('data-v-theme-test', '');
    const heroDiagnostic = container.querySelector<HTMLElement>('.hero-review-diagnostic')!;
    const featureShowcase = container.querySelector<HTMLElement>('.feature-showcase')!;
    const workflowCanvas = container.querySelector<HTMLElement>('.workflow-canvas')!;
    const closingPanel = container.querySelector<HTMLElement>('.closing-panel')!;
    const closingTitle = container.querySelector<HTMLElement>('.closing-title')!;
    const heroPrompt = container.querySelector<HTMLElement>('.hero-command-prompt')!;
    const featureIndex = container.querySelector<HTMLElement>('.feature-anatomy-index')!;
    const workflowSignal = container.querySelector<HTMLElement>('.workflow-stage-dot')!;
    const closingEyebrow = container.querySelector<HTMLElement>('.closing-eyebrow')!;
    const heroHeadlineAccent = container.querySelector<HTMLElement>('.hero-title-accent')!;
    const sectionHeadlineAccents = [...container.querySelectorAll<HTMLElement>('.section-title-accent')];
    const featureHeadingAccent = container.querySelector<HTMLElement>('.feature-heading-accent')!;
    const principlesHeadlineAccent = container.querySelector<HTMLElement>('.principles-manifesto-title em')!;
    const ecosystemHeadlineAccent = container.querySelector<HTMLElement>('.ecosystem-title span')!;
    expect(sectionHeadlineAccents).toHaveLength(3);
    for (const node of [heroDiagnostic, featureShowcase, workflowCanvas, closingPanel, closingTitle, heroPrompt, featureIndex, workflowSignal, closingEyebrow, heroHeadlineAccent, ...sectionHeadlineAccents, featureHeadingAccent, principlesHeadlineAccent, ecosystemHeadlineAccent]) {
      node.setAttribute('data-v-theme-test', '');
    }
    try {
      expect(getComputedStyle(landing).getPropertyValue('--nara-bg').trim()).toBe('#f6f5ef');
      container.querySelector<HTMLButtonElement>('.theme-button')?.click();
      expect(getComputedStyle(landing).getPropertyValue('--nara-bg').trim()).toBe('#0d141d');
      expect(getComputedStyle(landing).getPropertyValue('--nara-accent-strong').trim()).toBe('#83ddb0');
      expect(getComputedStyle(landing).getPropertyValue('--nara-ink-accent').trim()).toBe('#a4e7c4');
      expect(getComputedStyle(landing).getPropertyValue('--nara-signal').trim()).toBe('#83ddb0');
      expect(getComputedStyle(heroDiagnostic).backgroundColor).toBe('rgb(52, 63, 76)');
      expect(getComputedStyle(featureShowcase).backgroundColor).toBe('rgb(56, 68, 82)');
      expect(getComputedStyle(workflowCanvas).backgroundColor).toBe('rgb(38, 52, 64)');
      expect(getComputedStyle(closingPanel).getPropertyValue('--closing-bg').trim()).toBe('#f1f2f0');
      expect(getComputedStyle(closingPanel).backgroundColor).toBe('rgb(241, 242, 240)');
      expect(getComputedStyle(closingTitle).color).toBe('rgb(34, 44, 53)');
      for (const node of [heroHeadlineAccent, ...sectionHeadlineAccents, featureHeadingAccent, principlesHeadlineAccent, ecosystemHeadlineAccent]) {
        expect(['rgb(131, 221, 176)', 'var(--nara-accent-strong)']).toContain(getComputedStyle(node).color);
      }
      // Some test browser CSS engines return the unresolved token; its dark-mode
      // value is asserted above, and these checks confirm the correct consumers.
      // The dark hero prompt shares the warm code-string tone of the review panel.
      expect(getComputedStyle(heroPrompt).color).toBe('rgb(235, 222, 208)');
      expect(['rgb(131, 221, 176)', 'var(--nara-signal)']).toContain(getComputedStyle(featureIndex).color);
      // The test DOM does not always resolve custom-property backgrounds.
      // The compiled override and inherited token are both checked instead.
      expect(compiled.code).toContain('.dark .workflow-stage-dot');
      expect(compiled.code).toContain('background: var(--nara-signal)');
      expect(['rgb(23, 109, 76)', 'var(--nara-signal-on-light)']).toContain(getComputedStyle(closingEyebrow).color);
      await nextTick();
      expect(container.querySelector('.theme-button')?.getAttribute('aria-label')).toBe('Use light mode');
      container.querySelector<HTMLButtonElement>('.theme-button')?.click();
      expect(getComputedStyle(landing).getPropertyValue('--nara-bg').trim()).toBe('#f6f5ef');
      expect(getComputedStyle(closingTitle).color).toBe('rgb(255, 255, 255)');
      expect(getComputedStyle(landing).getPropertyValue('--nara-accent-strong').trim()).toBe('#1f7a55');
      expect(['rgb(31, 122, 85)', 'var(--nara-accent-strong)']).toContain(getComputedStyle(featureIndex).color);
    } finally {
      style.remove();
    }
  });

  it('keeps the closing invitation functional without the old banner', async () => {
    await mountAt('/');
    expect(container.querySelector('.final-section')).toBeNull();
    expect(container.querySelector('#closing-title')?.textContent).toContain('Make it yours.');
    const workshop = container.querySelector('.closing-workshop');
    expect(workshop?.textContent).toContain('FROM IDEA TO SOURCE');
    expect(workshop?.textContent).toContain('nara make feature billing');
    expect(workshop?.querySelector('.closing-result-folder')?.textContent).toContain('billing');
    expect([...workshop!.querySelectorAll('.closing-result-files li')].map((item) => item.textContent)).toEqual([
      'index.ts public boundary',
      'contract.ts shared contract',
    ]);
    expect(container.querySelector('.closing-path')).toBeNull();
    const action = container.querySelector<HTMLButtonElement>('.closing-action');
    expect(action).not.toBeNull();
    action?.click();
    await Promise.resolve();
    await nextTick();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('git clone https://github.com/MasRama/nara.git');
    expect(action?.textContent).toContain('Command copied');
    expect(container.querySelector('.closing-feedback')?.textContent).toContain('copied to clipboard');
  });

  it('uses Jakarta Sans for display type and Manrope for landing body text', () => {
    const source = readFileSync('src/app/pages/HomePage.vue', 'utf8');
    const { descriptor } = parse(source);
    const css = descriptor.styles[0]!.content;
    expect(css).toMatch(/\.landing-page\s*\{[^}]*font-family: 'Manrope'/);
    expect(css).toMatch(/\.landing-display\s*\{[^}]*font-family: 'Plus Jakarta Sans'/);
    expect(source).toContain('class="hero-title landing-display"');
    expect(css).not.toContain('Georgia');
  });

  it('preserves landing theme and copy interactions', async () => {
    await mountAt('/');

    const themeButton = container.querySelector('button[aria-label="Use dark mode"]');
    expect(themeButton).not.toBeNull();
    themeButton?.dispatchEvent(new MouseEvent('click'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('nara-theme')).toBe('dark');

    const copyButton = container.querySelector('button[aria-label="Copy clone command"]');
    expect(copyButton).not.toBeNull();
    copyButton?.dispatchEvent(new MouseEvent('click'));
    await Promise.resolve();
    await nextTick();
    expect(copyButton?.textContent).toContain('Copied');
  });
});
