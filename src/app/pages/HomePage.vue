<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthSession } from '../../features/auth/web';
import SiteHeader from '../layouts/SiteHeader.vue';

type Tone = 'cm' | 'str' | 'kw' | 'ty' | 'num' | 'fn';
type StageId = 'compose' | 'own' | 'understand' | 'evolve' | 'protect';
type ReviewPhase = 'detect' | 'fix' | 'pass';

interface Token {
  text: string;
  tone?: Tone;
}

interface CodeLine {
  number: number;
  mark?: 'add' | 'del';
  tokens: Token[];
}

interface Stage {
  id: StageId;
  name: string;
  hint: string;
  title: string;
  copy: string;
  outcome: string;
}

const repositoryUrl = 'https://github.com/MasRama/nara';
const docsUrl = `${repositoryUrl}#readme`;
const architectureUrl = `${repositoryUrl}/blob/main/ARCHITECTURE.md`;
const cliUrl = `${repositoryUrl}/blob/main/docs/cli.md`;
const cloneCommand = 'git clone https://github.com/MasRama/nara.git';
const currentYear = new Date().getFullYear();
const copied = ref(false);
const reviewPhase = ref<ReviewPhase>('detect');
const activeStageId = ref<StageId>('compose');
const activeFoundationStep = ref(0);
const motionReady = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
let revealObserver: IntersectionObserver | undefined;
let foundationObserver: IntersectionObserver | undefined;
let reviewObserver: IntersectionObserver | undefined;
let ideaTimer: ReturnType<typeof setInterval> | undefined;
const reviewTimers: ReturnType<typeof setTimeout>[] = [];

const authSession = useAuthSession();
const authLink = computed(() =>
  authSession.isAuthenticated.value
    ? { label: 'Dashboard', to: '/dashboard' }
    : { label: 'Sign in', to: '/login' },
);

const tokenPattern = /(\/\/.*)|('[^']*')|\b(import|from|export|default|const|function|return|type|new|async|await|if|void|undefined)\b|\b([A-Z]\w*)\b|\b(\d+)\b|([a-z_$][\w$]*)(?=\()/g;
const tokenTones: Tone[] = ['cm', 'str', 'kw', 'ty', 'num', 'fn'];

function highlight(source: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  for (const match of source.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ text: source.slice(cursor, index) });
    tokens.push({ text: match[0], tone: tokenTones[match.slice(1).findIndex(Boolean)] });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) tokens.push({ text: source.slice(cursor) });
  return tokens;
}

const line = (number: number, source: string, mark?: CodeLine['mark']): CodeLine => ({ number, mark, tokens: highlight(source) });

const heroStack = ['Hono', 'Vue 3', 'TypeScript', 'SQLite', 'Zod', 'Vitest'] as const;

const heroCodeLines: CodeLine[] = [
  line(1, "import { Hono } from 'hono';"),
  line(2, "import { getUser } from '@/features/users/server/repository';", 'del'),
  line(2, "import { getUser } from '@/features/users';", 'add'),
  line(3, "import { invoiceSchema } from '../contract';"),
  line(4, "import { createInvoice, created, invalid } from './service';"),
  line(5, ''),
  line(6, "export const billingRoutes = new Hono().post('/', async (c) => {"),
  line(7, '  const input = invoiceSchema.safeParse(await c.req.json());'),
  line(8, '  if (!input.success) return c.json(invalid(input), 422);'),
  line(9, '  const invoice = createInvoice(getUser(input.data.userId));'),
  line(10, '  return c.json(created(invoice), 201);'),
  line(11, '});'),
];

const heroCode = computed(() => heroCodeLines.filter((row) => row.mark !== (reviewPhase.value === 'detect' ? 'add' : 'del')));

const proofs = computed(() => [
  { title: 'Deterministic', copy: 'Same source. Same answer. No model required.' },
  { title: 'Scriptable', copy: 'JSON output for CI, scripts, and agents.' },
  { title: 'Fail-closed', copy: 'Changes land completely, or not at all.' },
  { title: 'Unwrapped', copy: 'Hono, Vue, and SQLite remain themselves.' },
]);

const stages = computed<Stage[]>(() => [
  {
    id: 'compose',
    name: 'Compose',
    hint: 'Give it a home',
    title: 'A place for every idea.',
    copy: 'Start with a feature, not another folder of unrelated layers. Nara gives the capability a clear home in your repository.',
    outcome: 'A feature you can open and grow.',
  },
  {
    id: 'own',
    name: 'Own',
    hint: 'Stay in control',
    title: 'The wiring belongs to you.',
    copy: 'Connect features through application-owned bindings. No invisible container decides how your application works.',
    outcome: 'Your integrations, your decisions.',
  },
  {
    id: 'understand',
    name: 'Understand',
    hint: 'See what connects',
    title: 'Know before you change.',
    copy: 'Follow feature boundaries and real dependencies straight from source. See what a change might touch before you make it.',
    outcome: 'No guessing where things lead.',
  },
  {
    id: 'evolve',
    name: 'Evolve',
    hint: 'Keep your changes',
    title: 'Move forward, without starting over.',
    copy: 'Bring in upstream improvements while keeping the edits you own. A dry run makes the outcome visible before anything is applied.',
    outcome: 'Your changes stay in the picture.',
  },
  {
    id: 'protect',
    name: 'Protect',
    hint: 'Guard the shape',
    title: 'Keep good boundaries intact.',
    copy: 'Check the architecture as it grows. Guard catches new violations without making old technical debt everyone’s problem.',
    outcome: 'New problems stop before they land.',
  },
]);

const activeStage = computed(() => stages.value.find((stage) => stage.id === activeStageId.value) ?? stages.value[0]);

const permissions = ['users.view', 'users.create', 'users.edit', 'users.delete', 'roles.view', 'roles.edit', 'activity.view'] as const;

const migrations = [
  { file: '202609030001_create_users.sql', owner: 'auth' },
  { file: '202609030002_create_sessions.sql', owner: 'auth' },
  { file: '202609030007_create_assets.sql', owner: 'users' },
  { file: '202610050001_create_activity_events.sql', owner: 'activity' },
] as const;

const endpoints = computed(() => [
  { path: '/', detail: 'Vue SPA' },
  { path: '/api/*', detail: 'Hono API' },
  { path: '/health', detail: 'Liveness' },
  { path: '/ready', detail: 'Schema-aware' },
]);

const officialFeatures = ['health', 'users', 'activity'] as const;

const foundationLanes = computed(() => [
  {
    label: 'runtime',
    title: 'Node · Hono · Vue',
    chips: ['request id', 'secure headers', 'rate limit', 'structured logs'],
    status: '200 · one process',
    caption: 'A request crosses the minimum surface.',
  },
  {
    label: 'server gate',
    title: 'session → permission',
    chips: ['session', 'csrf', 'throttle', 'users.view'],
    status: 'users.view · allowed',
    caption: 'Identity stays a server-side decision.',
  },
  {
    label: 'owned data',
    title: 'users → SQLite',
    chips: ['server/migrations/', 'WAL', 'checksums', 'backups'],
    status: 'owner · users',
    caption: 'Data remains attached to its owner.',
  },
  {
    label: 'product surface',
    title: 'src/features/*',
    chips: ['users', 'activity', 'assets', '+ your feature'],
    status: 'nara add activity',
    caption: 'The product grows by adding visible source.',
  },
]);

const activeLane = computed(() => foundationLanes.value[activeFoundationStep.value]);

const stack = computed(() => [
  { name: 'TypeScript', role: 'App and CLI', logos: ['typescript'] },
  { name: 'Node.js 22+', role: 'Runtime', logos: ['nodedotjs'] },
  { name: 'Hono', role: 'HTTP, no wrapper', logos: ['hono'] },
  { name: 'Vue 3 + Vite', role: 'Browser app', logos: ['vuedotjs', 'vite'] },
  { name: 'SQLite', role: 'Raw SQL', logos: ['sqlite'] },
  { name: 'Zod', role: 'Feature schemas', logos: ['zodfull'] },
  { name: 'Vitest', role: 'Tests', logos: ['vitest'] },
  { name: 'Tailwind CSS', role: 'Styling', logos: ['tailwindcss'] },
]);

const principles = computed(() => [
  {
    label: 'Ownership',
    title: 'Own the source.',
    copy: 'Installed features land as ordinary files in your repository. Wiring lives in bindings you can read, edit, and delete.',
    uses: ['src/features/*', 'src/app/bindings/'],
    rejects: ['Plugin registry'],
  },
  {
    label: 'Ecosystem',
    title: 'Use the ecosystem directly.',
    copy: 'Hono serves HTTP, Vue renders the browser, Node runs both. Their documentation stays your documentation.',
    uses: ['hono', 'vue', 'node'],
    rejects: ['Custom runtime', 'HTTP framework'],
  },
  {
    label: 'Clarity',
    title: 'Stay explicit.',
    copy: 'Raw SQL in prepared statements, Zod at the route boundary, typed host contracts between features.',
    uses: ['better-sqlite3', 'zod', 'index.ts'],
    rejects: ['ORM', 'DI container', 'RPC system'],
  },
  {
    label: 'Verification',
    title: 'Derive, don’t guess.',
    copy: 'Architecture facts are parsed from source — the same answer for you, your CI, and your coding agents.',
    uses: ['nara doctor', '--json'],
    rejects: ['AI wrapper'],
  },
]);

// Dates on the illustrative invoice.
const receiptMonth = new Date(2026, 8, 1);
const receiptPaidOn = new Date(2026, 8, 24);

const featureIdeas = ['billing', 'bookings', 'invoices', 'inventory'] as const;
const ideaIndex = ref(0);
const activeIdea = computed(() => featureIdeas[ideaIndex.value]);

function setupScrollReveals(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (targets.length === 0) return;

  motionReady.value = true;
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        revealObserver?.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );

  targets.forEach((target) => revealObserver?.observe(target));
}

function setupFoundationStory(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  const steps = document.querySelectorAll<HTMLElement>('[data-foundation-step]');
  if (steps.length === 0) return;

  foundationObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      activeFoundationStep.value = Number((visible.target as HTMLElement).dataset.foundationStep ?? 0);
    },
    { rootMargin: '-28% 0px -38% 0px', threshold: [0.2, 0.45, 0.7] },
  );

  steps.forEach((step) => foundationObserver?.observe(step));
}

function selectReviewPhase(phase: ReviewPhase): void {
  reviewObserver?.disconnect();
  reviewTimers.forEach(clearTimeout);
  reviewTimers.length = 0;
  reviewPhase.value = phase;
}

function setupHeroReview(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reviewPhase.value = 'pass';
    return;
  }
  if (!('IntersectionObserver' in window)) return;
  const target = document.querySelector<HTMLElement>('.hero-window');
  if (!target) return;
  reviewObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    reviewObserver?.disconnect();
    reviewTimers.push(setTimeout(() => { reviewPhase.value = 'fix'; }, 1600));
    reviewTimers.push(setTimeout(() => { reviewPhase.value = 'pass'; }, 3500));
  }, { threshold: 0.3 });
  reviewObserver.observe(target);
}

function moveStage(event: KeyboardEvent, index: number): void {
  const targets: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: stages.value.length - 1 };
  const target = targets[event.key];
  if (target === undefined) return;
  event.preventDefault();
  const stage = stages.value[(target + stages.value.length) % stages.value.length];
  activeStageId.value = stage.id;
  document.getElementById(`stage-tab-${stage.id}`)?.focus();
}

async function copyCommand(): Promise<void> {
  await navigator.clipboard.writeText(cloneCommand);
  copied.value = true;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copied.value = false;
  }, 1800);
}

onMounted(() => {
  setupScrollReveals();
  setupFoundationStory();
  setupHeroReview();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ideaTimer = setInterval(() => {
      ideaIndex.value = (ideaIndex.value + 1) % featureIdeas.length;
    }, 2400);
  }
});

onBeforeUnmount(() => {
  revealObserver?.disconnect();
  foundationObserver?.disconnect();
  reviewObserver?.disconnect();
  reviewTimers.forEach(clearTimeout);
  if (copyTimer) clearTimeout(copyTimer);
  if (ideaTimer) clearInterval(ideaTimer);
});
</script>

<template>
  <div class="landing-page min-h-[100dvh] antialiased" :class="{ 'landing-page--motion': motionReady }">
    <SiteHeader variant="landing" nav-label="Primary navigation">
      <template #nav>
        <a href="#why" class="site-header-link">Why Nara</a>
        <a href="#workflow" class="site-header-link">Workflow</a>
        <a href="#inside" class="site-header-link">Inside</a>
        <a :href="docsUrl" target="_blank" rel="noreferrer" class="site-header-link">Docs</a>
      </template>
      <template #actions-start>
        <a :href="repositoryUrl" target="_blank" rel="noreferrer" class="site-header-icon" aria-label="View source on GitHub">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.6 9.6 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>
        </a>
      </template>
      <template #actions>
        <RouterLink :to="authLink.to" class="site-header-cta">{{ authLink.label }}</RouterLink>
      </template>
    </SiteHeader>

    <main>
      <section class="hero" aria-labelledby="hero-title">
        <div class="lp-container">
          <div class="hero-copy">
            <h1 id="hero-title" class="hero-title landing-display">Build by feature.<br /><span class="hero-title-accent">Prove every boundary.</span></h1>
            <p class="hero-description">Nara is an architecture-aware TypeScript application kit. Each capability lives in one feature folder, and a deterministic CLI checks its boundaries on every change — for you, your CI, and your coding agents.</p>
            <div class="hero-actions">
              <button type="button" class="hero-command" aria-label="Copy clone command" @click="copyCommand">
                <span class="hero-command-prompt" aria-hidden="true">$</span>
                <span class="hero-command-text">{{ cloneCommand }}</span>
                <span class="hero-command-copy">{{ copied ? 'Copied' : 'Copy' }}</span>
              </button>
              <a :href="docsUrl" target="_blank" rel="noreferrer" class="hero-docs">Read the docs <span aria-hidden="true">↗</span></a>
            </div>
            <ul class="hero-stack" aria-label="Built with">
              <li v-for="item in heroStack" :key="item">{{ item }}</li>
            </ul>
          </div>

          <figure class="window hero-window" aria-label="Interactive demonstration of nara doctor detecting and verifying a cross-feature import correction">
            <div class="window-bar">
              <span class="window-dots" aria-hidden="true"><span></span><span></span><span></span></span>
              <span class="window-title">acme / billing</span>
              <span class="hero-review-top-label">ARCHITECTURE / REVIEW</span>
            </div>
            <div class="hero-review-main">
              <div class="hero-review-editor">
                <div class="pane-head"><span>src/features/billing/server/routes.ts</span><span :class="reviewPhase === 'detect' ? 'hero-review-file--issue' : 'hero-review-file--clear'">{{ reviewPhase === 'detect' ? '1 issue' : reviewPhase === 'fix' ? 'Modified' : 'Verified' }}</span></div>
                <div class="code hero-review-code" aria-label="TypeScript import before and after correcting a feature boundary">
                  <p v-for="(row, index) in heroCode" :key="`${row.number}-${row.mark ?? index}`" class="code-line" :class="row.mark && `code-line--${row.mark}`"><span class="code-number" aria-hidden="true">{{ row.number }}</span><span class="code-mark" aria-hidden="true">{{ row.mark === 'add' ? '+' : row.mark === 'del' ? '−' : '' }}</span><code><span v-for="(token, part) in row.tokens" :key="part" :class="token.tone && `tk-${token.tone}`">{{ token.text }}</span></code></p>
                </div>
                <div class="hero-review-editor-caption"><span>FEATURE / BILLING</span><span>IMPORT BOUNDARY ↗</span></div>
              </div>
              <div class="hero-review-diagnostic" :class="`hero-review-diagnostic--${reviewPhase}`">
                <div class="hero-review-diagnostic-head"><span>NARA / DOCTOR</span><span>{{ reviewPhase === 'detect' ? '01 / 03' : reviewPhase === 'fix' ? '02 / 03' : '03 / 03' }}</span></div>
                <Transition name="hero-diagnostic" mode="out-in">
                  <div :key="reviewPhase" class="hero-review-diagnostic-body" role="status">
                    <span class="hero-review-symbol" aria-hidden="true">{{ reviewPhase === 'pass' ? '✓' : reviewPhase === 'fix' ? '↗' : '!' }}</span>
                    <p class="hero-review-state">{{ reviewPhase === 'detect' ? 'BOUNDARY VIOLATION' : reviewPhase === 'fix' ? 'THE CORRECTION' : 'CHECK COMPLETE' }}</p>
                    <h3 class="hero-review-heading landing-display">{{ reviewPhase === 'detect' ? 'A feature crossed the line.' : reviewPhase === 'fix' ? 'Use the public boundary.' : 'Boundary restored.' }}</h3>
                    <p class="hero-review-explanation">{{ reviewPhase === 'detect' ? 'Billing reaches into the private internals of Users instead of its public interface.' : reviewPhase === 'fix' ? 'The import now points to the public index. The feature stays independent of another feature’s internals.' : 'Nara checked the corrected import. The architecture is healthy again.' }}</p>
                    <div class="hero-review-evidence">
                      <span>{{ reviewPhase === 'detect' ? 'CROSS_FEATURE_INTERNAL_IMPORT' : reviewPhase === 'fix' ? 'PUBLIC FEATURE API' : 'NARA DOCTOR' }}</span>
                      <strong>{{ reviewPhase === 'detect' ? '1 issue found' : reviewPhase === 'fix' ? '@/features/users' : 'Architecture looks healthy.' }}</strong>
                    </div>
                  </div>
                </Transition>
                <div class="hero-review-diagnostic-foot"><span class="hero-review-diagnostic-dot" aria-hidden="true"></span>{{ reviewPhase === 'detect' ? 'Action required' : reviewPhase === 'fix' ? 'Ready to verify' : 'Verified from source' }}</div>
              </div>
            </div>
            <div class="hero-review-footer">
              <span class="hero-review-footer-label">SEE WHAT CHANGES</span>
              <div class="hero-review-steps" role="group" aria-label="Explore architecture diagnosis">
                <button type="button" :aria-pressed="reviewPhase === 'detect'" :class="{ 'is-active': reviewPhase === 'detect' }" @click="selectReviewPhase('detect')"><span>01</span> Detect</button>
                <button type="button" :aria-pressed="reviewPhase === 'fix'" :class="{ 'is-active': reviewPhase === 'fix' }" @click="selectReviewPhase('fix')"><span>02</span> Fix</button>
                <button type="button" :aria-pressed="reviewPhase === 'pass'" :class="{ 'is-active': reviewPhase === 'pass' }" @click="selectReviewPhase('pass')"><span>03</span> Verify</button>
              </div>
              <span class="hero-review-footer-note">Your code. Nara checks.</span>
            </div>
          </figure>
        </div>
      </section>

      <section class="proof-strip" aria-label="What Nara guarantees">
        <div class="lp-container proof-grid" data-reveal-group>
          <div v-for="(proof, index) in proofs" :key="proof.title" class="proof-item" data-reveal>
            <span class="proof-number">0{{ index + 1 }} / NARA</span>
            <p class="proof-title landing-display">{{ proof.title }}</p>
            <p class="proof-copy">{{ proof.copy }}</p>
          </div>
        </div>
      </section>

      <section id="why" class="section" aria-labelledby="why-title">
        <div class="lp-container">
          <div class="section-head" data-reveal>
            <div>
              <p class="eyebrow"><span>01</span>Feature model</p>
              <h2 id="why-title" class="section-title landing-display">One feature.<br /><span class="section-title-accent">Everything it needs.</span></h2>
            </div>
            <p class="section-description">The experience is one thing. The code behind it should be, too. Nara keeps each part of a capability together, with clear ways to connect to the rest of your app.</p>
          </div>

          <div class="feature-story" data-reveal>
            <div class="feature-story-topline">
              <span>FEATURE / 001</span>
              <span>AN EXAMPLE, NOT A BUNDLED MODULE</span>
            </div>

            <div class="feature-story-body">
              <div class="feature-showcase">
                <div class="feature-showcase-top">
                  <span>WHAT SOMEONE USES</span>
                  <span class="feature-showcase-mark" aria-hidden="true">↗</span>
                </div>

                <div class="feature-receipt" aria-label="Illustrative billing interface showing a paid invoice">
                  <div class="feature-receipt-head">
                    <span class="feature-receipt-symbol" aria-hidden="true">a.</span>
                    <span class="feature-receipt-brand">acme <small>studio</small></span>
                    <span class="feature-receipt-number">#INV-024</span>
                  </div>
                  <div class="feature-receipt-details">
                    <p class="feature-receipt-label">Invoice for</p>
                    <h3 class="landing-display">Studio membership</h3>
                    <p class="feature-receipt-subtitle">{{ receiptMonth.toLocaleDateString('en', { month: 'long', year: 'numeric' }) }} · Monthly plan</p>
                    <div class="feature-receipt-amount">
                      <span>Total</span>
                      <strong class="landing-display">$240<span>.00</span></strong>
                    </div>
                    <div class="feature-receipt-item"><span>Membership</span><strong>$240.00</strong></div>
                    <div class="feature-receipt-item"><span>Amount remaining</span><strong>$0.00</strong></div>
                  </div>
                  <div class="feature-receipt-paid"><span class="feature-receipt-paid-dot" aria-hidden="true"></span><strong>Paid in full</strong><span>{{ receiptPaidOn.toLocaleDateString('en', { dateStyle: 'medium' }) }}</span></div>
                </div>

                <div class="feature-showcase-bottom">
                  <span class="feature-showcase-thread" aria-hidden="true"><span></span> ONE FEATURE, TWO SIDES</span>
                  <p>A complete experience on the outside.<br /><strong>A complete feature on the inside.</strong></p>
                </div>
              </div>

              <div class="feature-anatomy">
                <div class="feature-anatomy-heading">
                  <span>WHAT MAKES IT WORK</span>
                  <h3 class="landing-display">The pieces belong <span class="feature-heading-accent">together.</span></h3>
                  <p class="feature-anatomy-lead">The invoice on the left is the result. These are the pieces behind it.</p>
                </div>
                <ol class="feature-anatomy-list">
                  <li>
                    <span class="feature-anatomy-index">01</span>
                    <div><h4 class="landing-display">Contract</h4><p>The shared rules and shapes everyone can count on.</p></div>
                    <span class="feature-anatomy-side">promise</span>
                  </li>
                  <li>
                    <span class="feature-anatomy-index">02</span>
                    <div><h4 class="landing-display">Server</h4><p>The logic and data that make the feature work.</p></div>
                    <span class="feature-anatomy-side">behavior</span>
                  </li>
                  <li>
                    <span class="feature-anatomy-index">03</span>
                    <div><h4 class="landing-display">Web <span>(when needed)</span></h4><p>The screens people see and interact with.</p></div>
                    <span class="feature-anatomy-side">experience</span>
                  </li>
                  <li>
                    <span class="feature-anatomy-index">04</span>
                    <div><h4 class="landing-display">Tests</h4><p>The checks that keep changes from breaking it.</p></div>
                    <span class="feature-anatomy-side">confidence</span>
                  </li>
                </ol>
                <div class="feature-anatomy-home"><span>ONE HOME FOR ALL OF IT</span><code>src/features/billing/</code></div>
              </div>
            </div>

            <div class="feature-story-bottom">
              <p class="feature-story-bottom-lead landing-display">Connected, without getting tangled.</p>
              <div class="feature-access"><span class="feature-access-arrow" aria-hidden="true">↗</span><div><strong>Public boundary</strong><span>What other features can use</span><code>index.ts</code></div></div>
              <div class="feature-access"><span class="feature-access-arrow" aria-hidden="true">↗</span><div><strong>Web boundary</strong><span>What the app can display</span><code>web/index.ts</code></div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" class="section" aria-labelledby="workflow-title">
        <div class="lp-container">
          <div class="section-head" data-reveal>
            <div>
              <p class="eyebrow"><span>02</span>Workflow</p>
              <h2 id="workflow-title" class="section-title landing-display">Useful long after<br /><span class="section-title-accent">the first commit.</span></h2>
            </div>
            <p class="section-description">One project, five moments. From a new idea to the next change, see how Nara helps without taking over your codebase.</p>
          </div>

          <div class="workflow-experience" data-reveal>
            <div class="workflow-navigation">
              <div class="workflow-navigation-meta"><span>THE PROJECT LIFECYCLE</span><span>01 — 05</span></div>
              <div class="workflow-stages" role="tablist" aria-label="Nara workflow" aria-orientation="vertical">
                <button
                  v-for="(stage, index) in stages"
                  :id="`stage-tab-${stage.id}`"
                  :key="stage.id"
                  type="button"
                  role="tab"
                  class="stage-tab"
                  :class="{ 'stage-tab--active': stage.id === activeStage.id }"
                  :aria-selected="stage.id === activeStage.id"
                  aria-controls="stage-panel"
                  :tabindex="stage.id === activeStage.id ? 0 : -1"
                  @click="activeStageId = stage.id"
                  @keydown="moveStage($event, index)"
                >
                  <span class="stage-step">0{{ index + 1 }}</span>
                  <span class="stage-tab-copy"><strong class="stage-name landing-display">{{ stage.name }}</strong><small class="stage-hint">{{ stage.hint }}</small></span>
                  <span class="stage-tab-arrow" aria-hidden="true">↗</span>
                </button>
              </div>
              <p class="workflow-navigation-note">Choose a moment to explore how the same project moves forward.</p>
            </div>

            <div id="stage-panel" :key="activeStage.id" class="workflow-stage-panel" role="tabpanel" :aria-labelledby="`stage-tab-${activeStage.id}`">
              <div class="workflow-stage-head">
                <p class="workflow-stage-kicker"><span class="workflow-stage-dot" aria-hidden="true"></span>{{ activeStage.name }} / IN PRACTICE</p>
                <h3 class="stage-title landing-display">{{ activeStage.title }}</h3>
                <p class="stage-copy">{{ activeStage.copy }}</p>
              </div>

              <div class="workflow-canvas" :class="`workflow-canvas--${activeStage.id}`">
                <div class="workflow-canvas-top"><span>ACME / SOURCE OVERVIEW</span><span>ILLUSTRATIVE</span></div>

                <div v-if="activeStage.id === 'compose'" class="wf-compose">
                  <div class="wf-tree">
                    <p class="wf-mini-label">PROJECT FILES</p>
                    <div class="wf-tree-line"><span class="wf-folder" aria-hidden="true"></span><span>src</span></div>
                    <div class="wf-tree-line wf-tree-line--nested"><span class="wf-folder" aria-hidden="true"></span><span>app</span></div>
                    <div class="wf-tree-line wf-tree-line--nested wf-tree-line--dim"><span class="wf-folder" aria-hidden="true"></span><span>shared</span></div>
                    <div class="wf-tree-line wf-tree-line--nested"><span class="wf-folder" aria-hidden="true"></span><span>features</span></div>
                    <div class="wf-tree-line wf-tree-line--feature"><span class="wf-folder wf-folder--accent" aria-hidden="true"></span><strong>billing</strong><span class="wf-new-tag">NEW</span></div>
                    <div class="wf-tree-line wf-tree-line--file"><span class="wf-file-symbol" aria-hidden="true"></span><span>contract.ts</span></div>
                    <div class="wf-tree-line wf-tree-line--file"><span class="wf-file-symbol" aria-hidden="true"></span><span>index.ts</span></div>
                  </div>
                  <div class="wf-compose-side">
                    <span class="wf-status-mark" aria-hidden="true">↗</span>
                    <p class="wf-mini-label">A NEW CAPABILITY</p>
                    <strong class="landing-display">billing<span>.</span></strong>
                    <p>Own files. Clear boundaries. Ready for the code that makes it yours.</p>
                    <div class="wf-micro-result"><span class="wf-success-dot" aria-hidden="true"></span>Feature created</div>
                  </div>
                </div>

                <div v-else-if="activeStage.id === 'own'" class="wf-own">
                  <p class="wf-mini-label">EXPLICIT CONNECTIONS</p>
                  <div class="wf-own-diagram">
                    <div class="wf-own-node wf-own-node--feature"><span>FEATURE</span><strong class="landing-display">Activity</strong><small>Declares what it needs</small></div>
                    <div class="wf-own-connector" aria-hidden="true"><span></span><b>↔</b><span></span></div>
                    <div class="wf-own-node wf-own-node--binding"><span>YOUR APP</span><strong class="landing-display">Binding</strong><small>Chooses how to provide it</small></div>
                  </div>
                  <div class="wf-own-footer"><span class="wf-success-dot" aria-hidden="true"></span><p>Auth, sessions, and permissions are connected by <strong>your application</strong>—not a hidden plugin runtime.</p></div>
                </div>

                <div v-else-if="activeStage.id === 'understand'" class="wf-understand">
                  <div class="wf-understand-intro"><span class="wf-mini-label">FEATURE RELATIONSHIPS</span><span class="wf-understand-live"><span class="wf-success-dot" aria-hidden="true"></span> Derived from source</span></div>
                  <div class="wf-relations">
                    <div class="wf-relations-branches" aria-hidden="true"><span></span><span></span></div>
                    <div class="wf-relation wf-relation--primary"><span>IN FOCUS</span><strong class="landing-display">Activity</strong><small>Public feature boundary</small></div>
                    <div class="wf-relation wf-relation--link"><span class="wf-relation-line" aria-hidden="true"></span><span>USES PUBLIC API</span><strong class="landing-display">Auth</strong><small>Session &amp; permissions</small></div>
                    <div class="wf-relation wf-relation--link"><span class="wf-relation-line" aria-hidden="true"></span><span>OWNED BY</span><strong class="landing-display">App</strong><small>Route composition</small></div>
                  </div>
                  <p class="wf-understand-caption">Follow who owns it, who it uses, and where changes can travel.</p>
                </div>

                <div v-else-if="activeStage.id === 'evolve'" class="wf-evolve">
                  <div class="wf-evolve-labels"><span>BASE</span><span>LOCAL</span><span>INCOMING</span></div>
                  <div class="wf-evolve-columns">
                    <div class="wf-evolve-version"><span class="wf-evolve-version-mark" aria-hidden="true">○</span><strong>Starting point</strong><small>Known upstream source</small></div>
                    <div class="wf-evolve-version wf-evolve-version--local"><span class="wf-evolve-version-mark" aria-hidden="true">✳</span><strong>Your edits</strong><small>Keep what's yours</small></div>
                    <div class="wf-evolve-version"><span class="wf-evolve-version-mark" aria-hidden="true">+</span><strong>Update</strong><small>Upstream improvements</small></div>
                  </div>
                  <div class="wf-evolve-join" aria-hidden="true"><span></span><b>↓</b><span></span></div>
                  <div class="wf-evolve-output"><span class="wf-success-dot" aria-hidden="true"></span><div><strong>One considered change</strong><small>Preview first. Apply only when reconciliation passes.</small></div><span class="wf-evolve-output-arrow" aria-hidden="true">↗</span></div>
                </div>

                <div v-else class="wf-protect">
                  <div class="wf-protect-verdict"><div class="wf-protect-check" aria-hidden="true">✓</div><p>EXAMPLE / GUARD REPORT</p><strong class="landing-display">No new<br />violations.</strong><span>Architecture guard passed</span></div>
                  <div class="wf-protect-facts"><div><span>01</span><strong>Boundaries</strong><small>Checked at the source</small></div><div><span>02</span><strong>Dependencies</strong><small>New issues prevented</small></div><div><span>03</span><strong>Baseline</strong><small>Existing debt tracked</small></div></div>
                </div>

                <div class="workflow-canvas-bottom"><span>NO HIDDEN RUNTIME</span><span>YOUR REPOSITORY ↗</span></div>
              </div>
              <p class="workflow-outcome"><span aria-hidden="true">↳</span>{{ activeStage.outcome }}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="inside" class="section foundation-section" aria-labelledby="inside-title">
        <div class="lp-container">
          <div class="section-head" data-reveal>
            <div>
              <p class="eyebrow"><span>03</span>Foundation</p>
              <h2 id="inside-title" class="section-title landing-display">A real application<br /><span class="section-title-accent">from the first clone.</span></h2>
            </div>
            <p class="section-description">The reference app proves the substrate every product needs, so the first feature you write can be your actual product.</p>
          </div>

          <div class="foundation-story">
            <div class="foundation-visual" data-reveal>
              <div class="foundation-scene" :aria-label="`Architecture view, step ${activeFoundationStep + 1} of 4`">
                <div class="foundation-map-meta">
                  <span><i class="foundation-map-live" aria-hidden="true"></i>reference app · one node process</span>
                  <span>0{{ activeFoundationStep + 1 }} / 04</span>
                </div>

                <div class="foundation-request" aria-hidden="true">
                  <span class="foundation-request-method">GET</span>
                  <code>/api/users</code>
                  <Transition name="foundation-swap" mode="out-in">
                    <span :key="activeFoundationStep" class="foundation-request-status">{{ activeLane.status }}</span>
                  </Transition>
                </div>

                <ol class="foundation-lanes" aria-hidden="true">
                  <li v-for="(lane, index) in foundationLanes" :key="lane.label" class="foundation-lane" :class="{ 'foundation-lane--active': index === activeFoundationStep, 'foundation-lane--passed': index < activeFoundationStep }">
                    <span class="foundation-lane-index">0{{ index + 1 }}</span>
                    <div class="foundation-lane-body">
                      <small>{{ lane.label }}</small>
                      <strong class="landing-display">{{ lane.title }}</strong>
                      <div class="foundation-lane-more">
                        <ul class="foundation-lane-chips">
                          <li v-for="chip in lane.chips" :key="chip" :class="{ 'foundation-lane-chip--next': chip.startsWith('+') }">{{ chip }}</li>
                        </ul>
                      </div>
                    </div>
                  </li>
                </ol>

                <Transition name="foundation-swap" mode="out-in">
                  <p :key="activeFoundationStep" class="foundation-map-caption">{{ activeLane.caption }}</p>
                </Transition>
              </div>
            </div>

            <div class="foundation-narrative">
              <article class="foundation-step" :class="{ 'foundation-step--active': activeFoundationStep === 0 }" data-foundation-step="0">
                <p class="foundation-step-index">01 / runtime</p>
                <h3 class="foundation-step-title landing-display">One deployable unit. No second architecture hiding behind it.</h3>
                <p class="foundation-step-copy">Node serves the built Vue app and Hono API together. Request IDs, rate limits, security headers, and structured logs all live in the same production story.</p>
                <ul class="foundation-step-facts" aria-label="Runtime surface">
                  <li v-for="endpoint in endpoints" :key="endpoint.path"><code>{{ endpoint.path }}</code><span>{{ endpoint.detail }}</span></li>
                </ul>
              </article>

              <article class="foundation-step" :class="{ 'foundation-step--active': activeFoundationStep === 1 }" data-foundation-step="1">
                <p class="foundation-step-index">02 / identity</p>
                <h3 class="foundation-step-title landing-display">The browser can ask. The server decides.</h3>
                <p class="foundation-step-copy">Sessions, CSRF protection, login throttling, roles, and <code>resource.action</code> permissions are enforced at the Hono boundary — never only in Vue.</p>
                <ul class="foundation-permissions" aria-label="Seeded permissions">
                  <li class="foundation-permission foundation-permission--admin">admin</li>
                  <li v-for="permission in permissions" :key="permission" class="foundation-permission">{{ permission }}</li>
                </ul>
              </article>

              <article class="foundation-step" :class="{ 'foundation-step--active': activeFoundationStep === 2 }" data-foundation-step="2">
                <p class="foundation-step-index">03 / persistence</p>
                <h3 class="foundation-step-title landing-display">The data model has an owner, not a miscellaneous folder.</h3>
                <p class="foundation-step-copy">Forward-only migrations stay with their feature. Checksums, WAL, backups, integrity checks, and bounded maintenance remain explicit and inspectable.</p>
                <ul class="foundation-migrations" aria-label="Feature-owned migrations">
                  <li v-for="migration in migrations" :key="migration.file"><code>{{ migration.file }}</code><span>{{ migration.owner }}</span></li>
                </ul>
              </article>

              <article class="foundation-step" :class="{ 'foundation-step--active': activeFoundationStep === 3 }" data-foundation-step="3">
                <p class="foundation-step-index">04 / product</p>
                <h3 class="foundation-step-title landing-display">Start with product-shaped source, then keep adding source.</h3>
                <p class="foundation-step-copy">Users, profiles, activity, and asset storage are already real application code. Official features arrive the same way: visible source, installed into the project you own.</p>
                <div class="foundation-product-list">
                  <span>Users &amp; profiles</span><span>Activity trail</span><span>Asset storage</span>
                </div>
                <ul class="foundation-install-list" aria-label="Official features">
                  <li v-for="feature in officialFeatures" :key="feature"><span aria-hidden="true">$</span> nara add {{ feature }}</li>
                </ul>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section id="principles" class="section principles-section" aria-labelledby="principles-title">
        <div class="lp-container">
          <div class="principles-manifesto">
            <div class="principles-intro" data-reveal>
              <p class="eyebrow"><span>04</span>Principles</p>
              <h2 id="principles-title" class="principles-manifesto-title landing-display">Nara knows<br />when <em>to stop.</em></h2>
              <p class="principles-manifesto-copy">Four convictions shape what belongs in the kit. The rest is yours to build, change, or leave out.</p>
              <div class="principles-intro-foot">
                <span class="principles-intro-rule" aria-hidden="true"></span>
                <p>Less machinery between<br />you and your product.</p>
              </div>
            </div>

            <div class="principles-reading">
              <div class="principles-reading-head" aria-hidden="true"><span>The four rules</span><span>01 — 04</span></div>
              <ol class="principles-ledger">
                <li v-for="(principle, index) in principles" :key="principle.title" class="principle-row" data-reveal>
                  <div class="principle-row-head">
                    <span class="principle-index">0{{ index + 1 }}</span>
                    <span class="principle-type">{{ principle.label }}</span>
                    <span class="principle-arrow" aria-hidden="true">↗</span>
                  </div>
                  <h3 class="principle-title landing-display">{{ principle.title }}</h3>
                  <p class="principle-copy">{{ principle.copy }}</p>
                  <div class="principle-details">
                    <div class="principle-detail">
                      <span class="principle-detail-label">What stays</span>
                      <ul class="principle-uses" aria-label="Nara uses">
                        <li v-for="item in principle.uses" :key="item"><code>{{ item }}</code></li>
                      </ul>
                    </div>
                    <div class="principle-detail">
                      <span class="principle-detail-label">What doesn't</span>
                      <ul class="principle-rejects" aria-label="Not included">
                        <li v-for="item in principle.rejects" :key="item"><s>{{ item }}</s></li>
                      </ul>
                    </div>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          <div class="principles-ecosystem" data-reveal>
            <div class="ecosystem-intro">
              <p class="ecosystem-kicker">The ecosystem, unwrapped <span aria-hidden="true">↗</span></p>
              <h3 class="ecosystem-title landing-display">Keep the tools.<br /><span>Own the architecture.</span></h3>
              <p class="ecosystem-description">Nara has opinions about where code belongs, not about replacing the tools you already trust. Every part stays recognizable, documented, and yours to change.</p>
              <p class="ecosystem-signoff"><span aria-hidden="true">↳</span> Your codebase, not another framework to learn.</p>
            </div>

            <div class="ecosystem-directory">
              <div class="ecosystem-directory-head"><span>USED DIRECTLY</span><span>08 / THE STACK</span></div>
              <ul class="ecosystem-logos" aria-label="Technologies used directly by Nara">
                <li v-for="item in stack" :key="item.name" class="ecosystem-logo-entry" :class="{ 'ecosystem-logo-entry--zod': item.name === 'Zod' }">
                  <span class="ecosystem-logo-mark" aria-hidden="true">
                    <img v-for="logo in item.logos" :key="logo" :src="`/landing/brands/${logo}.svg`" alt="" width="34" height="34" loading="lazy" />
                  </span>
                  <span class="ecosystem-logo-text"><strong class="landing-display">{{ item.name }}</strong><small>{{ item.role }}</small></span>
                </li>
              </ul>
            </div>

            <div class="ecosystem-footnotes" aria-label="What ownership means in practice">
              <div><span>01 / OWN</span><strong>Plain files, in your repo.</strong></div>
              <div><span>02 / USE</span><strong>Familiar tools, as they are.</strong></div>
              <div><span>03 / SKIP</span><strong>No hidden framework layer.</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section class="closing-section" aria-labelledby="closing-title">
        <div class="lp-container">
          <div class="closing-panel" data-reveal>
            <div class="closing-copy">
              <p class="closing-eyebrow">Your turn</p>
              <h2 id="closing-title" class="closing-title landing-display">Make it yours.</h2>
              <p class="closing-description">Start with a name. Give it a place in your codebase. Take it wherever you want.</p>
              <div class="closing-links">
                <button type="button" class="closing-action" aria-label="Copy clone command" @click="copyCommand"><span>{{ copied ? 'Command copied' : 'Clone Nara' }}</span><span aria-hidden="true">{{ copied ? '✓' : '→' }}</span></button>
                <a :href="docsUrl" target="_blank" rel="noreferrer" class="closing-link">Getting started <span aria-hidden="true">↗</span></a>
              </div>
              <span class="closing-feedback" role="status">{{ copied ? 'Clone command copied to clipboard.' : '' }}</span>
              <p class="closing-aside">Open source. No black box. Just a starting point.</p>
            </div>

            <div class="closing-workshop" aria-label="From an idea to a Nara feature">
              <div class="closing-workshop-head"><span>FROM IDEA TO SOURCE</span><span>NARA / 001</span></div>

              <div class="closing-concept">
                <div class="closing-workshop-label"><span>01 / IMAGINE</span><span>Just give it a name.</span></div>
                <p class="closing-concept-name landing-display"><Transition name="closing-idea" mode="out-in"><span :key="activeIdea">{{ activeIdea }}</span></Transition><span class="closing-concept-asterisk" aria-hidden="true">✳</span></p>
              </div>

              <div class="closing-execution">
                <div class="closing-workshop-label"><span>02 / MAKE</span><span>One command.</span></div>
                <p class="closing-command"><span class="closing-command-prompt" aria-hidden="true">$</span><span>nara make feature </span><Transition name="closing-idea" mode="out-in"><span :key="activeIdea" class="closing-idea">{{ activeIdea }}</span></Transition></p>
              </div>

              <div class="closing-result">
                <div class="closing-workshop-label"><span>03 / OWN</span><span class="closing-result-status"><span aria-hidden="true"></span>Ready to build</span></div>
                <div class="closing-result-source">
                  <div class="closing-result-folder"><span class="closing-folder-symbol" aria-hidden="true"></span><span>src / features / <Transition name="closing-idea" mode="out-in"><strong :key="activeIdea">{{ activeIdea }}</strong></Transition> /</span></div>
                  <ul class="closing-result-files" aria-label="Files created by nara make feature"><li>index.ts <span>public boundary</span></li><li>contract.ts <span>shared contract</span></li></ul>
                </div>
                <p class="closing-result-note">Not a plugin. Actual files you can open, edit, and own.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="lp-container footer-inner">
        <div class="footer-brand">
          <img src="/nara.png" alt="" width="28" height="28" />
          <span class="landing-display">Nara</span>
          <span class="footer-tagline">Architecture-aware TypeScript application kit.</span>
        </div>
        <nav class="footer-links" aria-label="Resources">
          <a :href="repositoryUrl" target="_blank" rel="noreferrer">GitHub</a>
          <a :href="docsUrl" target="_blank" rel="noreferrer">Docs</a>
          <a :href="architectureUrl" target="_blank" rel="noreferrer">Architecture</a>
          <a :href="cliUrl" target="_blank" rel="noreferrer">CLI</a>
          <span>MIT · © {{ currentYear }}</span>
        </nav>
      </div>
    </footer>
  </div>
</template>
<style scoped>
.landing-page {
  --lp-section-gap: clamp(76px, 7.5vw, 100px);
  font-family: 'Manrope', system-ui, sans-serif;
  background: var(--nara-bg);
  color: var(--nara-fg);
  overflow-x: clip;
}
.landing-page main > section + section { margin-top: var(--lp-section-gap); }


.landing-display { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
.landing-page ::selection { background: color-mix(in srgb, var(--nara-accent) 32%, transparent); }
.landing-page :is(a, button):focus-visible { outline: 2px solid var(--nara-accent-strong); outline-offset: 4px; }
.landing-page button { cursor: pointer; }
.landing-page code { font-family: var(--nara-mono); }
.lp-container { width: 100%; max-width: 1160px; margin-inline: auto; padding-inline: 32px; }
:global(html:has(.landing-page)) { scroll-behavior: smooth; }
.landing-page--motion [data-reveal] { opacity: 0; transform: translate3d(0, 16px, 0); transition: opacity 0.65s cubic-bezier(0.2, 0.7, 0.2, 1), transform 0.65s cubic-bezier(0.2, 0.7, 0.2, 1); transition-delay: var(--reveal-delay, 0ms); will-change: opacity, transform; }
.landing-page--motion [data-reveal].is-visible { opacity: 1; transform: translate3d(0, 0, 0); }
[data-reveal-group] > [data-reveal]:nth-child(2) { --reveal-delay: 55ms; }
[data-reveal-group] > [data-reveal]:nth-child(3) { --reveal-delay: 110ms; }
[data-reveal-group] > [data-reveal]:nth-child(4) { --reveal-delay: 165ms; }
[data-reveal-group] > [data-reveal]:nth-child(5) { --reveal-delay: 220ms; }
[data-reveal-group] > [data-reveal]:nth-child(n + 6) { --reveal-delay: 260ms; }

/* Header */

/* Hero */
.hero { position: relative; isolation: isolate; padding: 176px 0 0; }
.hero::before { content: ''; position: absolute; inset: 0; z-index: -2; background-image: linear-gradient(var(--nara-grid) 1px, transparent 1px), linear-gradient(90deg, var(--nara-grid) 1px, transparent 1px); background-position: 50% -1px; background-size: 64px 64px; -webkit-mask-image: radial-gradient(ellipse 72% 56% at 50% 0%, #000 35%, transparent 78%); mask-image: radial-gradient(ellipse 72% 56% at 50% 0%, #000 35%, transparent 78%); pointer-events: none; }
.hero::after { content: ''; position: absolute; top: 540px; left: 50%; z-index: -1; width: min(1100px, 120%); height: 560px; transform: translateX(-50%); background: radial-gradient(closest-side, color-mix(in srgb, var(--nara-accent) 24%, transparent), transparent); pointer-events: none; }
.hero-copy { max-width: 980px; margin: 0 auto; text-align: center; }
.hero-title { font-size: clamp(2.3rem, 6.6vw, 5.4rem); font-weight: 800; line-height: 1.02; letter-spacing: -0.058em; text-wrap: balance; }
.hero-title-accent { color: var(--nara-accent-strong); }
.hero-description { max-width: 640px; margin: 28px auto 0; color: var(--nara-muted); font-size: 18px; line-height: 1.7; text-wrap: pretty; }
.hero-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; margin-top: 36px; }
.hero-command { display: inline-flex; max-width: 100%; height: 54px; align-items: center; gap: 12px; padding: 0 7px 0 20px; border-radius: 15px; background: var(--nara-ink); color: var(--nara-ink-fg); font-family: var(--nara-mono); font-size: 13.5px; box-shadow: inset 0 0 0 1px var(--nara-ink-line), var(--nara-shadow); transition: transform 0.15s ease, box-shadow 0.15s ease; }
.hero-command:hover { transform: translateY(-1px); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nara-ink-accent) 45%, var(--nara-ink-line)), var(--nara-shadow); }
.hero-command-prompt { color: var(--nara-ink-accent); }
.hero-command-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hero-command-copy { display: inline-flex; height: 40px; flex: none; align-items: center; padding: 0 14px; border-radius: 10px; background: rgba(255, 255, 255, 0.08); color: #fff; font-family: 'Manrope', system-ui, sans-serif; font-size: 12.5px; font-weight: 700; transition: background-color 0.15s ease, color 0.15s ease; }
.hero-command:hover .hero-command-copy { background: var(--nara-ink-accent); color: var(--nara-ink); }
.hero-docs { display: inline-flex; height: 54px; align-items: center; gap: 10px; padding: 0 22px; border: 1px solid var(--nara-line-strong); border-radius: 15px; background: var(--nara-surface); font-size: 14px; font-weight: 700; transition: border-color 0.15s ease, transform 0.15s ease; }
.hero-docs:hover { border-color: var(--nara-fg); transform: translateY(-1px); }
.hero-stack { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 20px; margin-top: 30px; color: var(--nara-faint); font-family: var(--nara-mono); font-size: 12px; letter-spacing: 0.04em; }
.hero-stack li { display: inline-flex; align-items: center; gap: 20px; }
.hero-stack li + li::before { content: ''; width: 4px; height: 4px; border-radius: 50%; background: var(--nara-line-strong); }
.hero-title { animation: hero-enter 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.hero-description { animation: hero-enter 0.72s 70ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.hero-actions { animation: hero-enter 0.72s 140ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.hero-stack { animation: hero-enter 0.68s 200ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }

/* Windows */
.window { overflow: hidden; border-radius: 18px; background: var(--nara-ink); color: var(--nara-ink-fg); box-shadow: 0 0 0 1px var(--nara-ink-line), var(--nara-shadow); text-align: left; }
.window-bar { display: flex; align-items: center; gap: 14px; height: 42px; padding: 0 16px; border-bottom: 1px solid var(--nara-ink-line); background: var(--nara-ink-bar); }
.window-dots { display: flex; flex: none; gap: 7px; }
.window-dots span { width: 10px; height: 10px; border-radius: 50%; background: #26354d; }
.window-title { overflow: hidden; color: var(--nara-ink-muted); font-family: var(--nara-mono); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.window-meta { flex: none; margin-left: auto; padding: 4px 9px; border-radius: 7px; background: rgba(110, 224, 173, 0.1); color: var(--nara-ink-accent); font-family: var(--nara-mono); font-size: 11px; }
.hero-window { max-width: 1100px; margin: 72px auto 0; box-shadow: 0 0 0 1px var(--nara-ink-line), 0 0 0 9px color-mix(in srgb, var(--nara-surface) 60%, transparent), 0 40px 90px -40px rgba(8, 16, 32, 0.6); animation: hero-window-enter 0.85s 220ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.hero-review-top-label { margin-left: auto; color: var(--nara-ink-muted); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.1em; }
.hero-review-main { display: grid; grid-template-columns: minmax(0, 1.46fr) minmax(300px, 0.9fr); min-height: 400px; }
.hero-review-editor { display: flex; min-width: 0; flex-direction: column; border-right: 1px solid var(--nara-ink-line); }
.hero-review-file--issue { color: var(--nara-ink-danger); }
.hero-review-file--clear { color: var(--nara-ink-accent); }
.hero-review-code { min-width: 0; flex: 1; padding: 24px 0 20px; }
.hero-review-code .code-line { min-height: 2em; transition: background-color 0.3s ease; }
.hero-review-code .code-line--add, .hero-review-code .code-line--del { position: relative; }
.hero-review-code .code-line--add::before, .hero-review-code .code-line--del::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 2px; background: var(--nara-ink-accent); }
.hero-review-code .code-line--del::before { background: var(--nara-ink-danger); }
.hero-review-editor-caption { display: flex; justify-content: space-between; gap: 12px; margin-top: auto; padding: 13px 18px; border-top: 1px solid var(--nara-ink-line); color: var(--nara-ink-muted); font-family: var(--nara-mono); font-size: 9px; font-weight: 600; letter-spacing: 0.08em; }
.hero-review-diagnostic { display: flex; min-width: 0; flex-direction: column; padding: 25px 28px 21px; background: #0b1721; }
:global(.dark .hero-review-diagnostic) { background: #343f4c; }
:global(.dark .hero-review-code .code-number) { color: #91a8b7; }
:global(.dark .hero-review-code .tk-cm) { color: #a5b9c3; }
:global(.dark .window-dots span) { background: #577084; }
:global(.dark .hero-command) { background: var(--nara-ink-raised); box-shadow: inset 0 0 0 1px var(--nara-ink-raised-line), var(--nara-shadow); }
:global(.dark .hero-review-code .code-line--add) { background: var(--nara-signal-soft); }
:global(.dark .hero-review-code .code-line--add::before) { background: var(--nara-signal); }
:global(.dark .hero-review-file--clear),
:global(.dark .hero-review-diagnostic--pass .hero-review-evidence > strong) { color: var(--nara-signal); }
:global(.dark .hero-review-diagnostic--fix .hero-review-state),
:global(.dark .hero-review-diagnostic--pass .hero-review-state),
:global(.dark .hero-review-diagnostic--fix .hero-review-symbol),
:global(.dark .hero-review-diagnostic--pass .hero-review-symbol) { color: var(--nara-signal); }
:global(.dark .hero-review-diagnostic--fix .hero-review-diagnostic-dot),
:global(.dark .hero-review-diagnostic--pass .hero-review-diagnostic-dot) { background: var(--nara-signal); }
:global(.dark .hero-review-steps button.is-active span),
:global(.dark .hero-command-prompt),
:global(.dark .hero-review-code .tk-str) { color: #ebded0; }
.hero-review-diagnostic-head { display: flex; justify-content: space-between; gap: 12px; color: var(--nara-ink-muted); font-family: var(--nara-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; }
.hero-review-diagnostic-body { display: flex; min-width: 0; flex: 1; flex-direction: column; align-items: flex-start; padding-top: 29px; }
.hero-review-symbol { display: flex; width: 42px; height: 42px; align-items: center; justify-content: center; border: 1px solid rgba(255, 143, 143, 0.42); border-radius: 50%; color: var(--nara-ink-danger); font-family: var(--nara-mono); font-size: 20px; font-weight: 700; }
.hero-review-diagnostic--fix .hero-review-symbol, .hero-review-diagnostic--pass .hero-review-symbol { border-color: rgba(110, 224, 173, 0.45); color: var(--nara-ink-accent); }
.hero-review-state { margin-top: 24px; color: var(--nara-ink-danger); font-family: var(--nara-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.07em; }
.hero-review-diagnostic--fix .hero-review-state, .hero-review-diagnostic--pass .hero-review-state { color: var(--nara-ink-accent); }
.hero-review-heading { max-width: 280px; margin-top: 10px; color: #fff; font-size: clamp(23px, 2.5vw, 31px); font-weight: 800; line-height: 1.17; letter-spacing: -0.05em; text-wrap: balance; }
.hero-review-explanation { max-width: 290px; margin-top: 13px; color: var(--nara-ink-muted); font-size: 12px; line-height: 1.7; }
.hero-review-evidence { display: flex; flex-direction: column; gap: 7px; max-width: 100%; margin-top: 22px; padding-top: 13px; border-top: 1px solid var(--nara-ink-line); }
.hero-review-evidence > span { color: var(--nara-ink-muted); font-family: var(--nara-mono); font-size: 8px; font-weight: 700; letter-spacing: 0.055em; overflow-wrap: anywhere; }
.hero-review-evidence > strong { color: var(--nara-ink-fg); font-family: var(--nara-mono); font-size: 11px; font-weight: 600; line-height: 1.6; overflow-wrap: anywhere; }
.hero-review-diagnostic--pass .hero-review-evidence > strong { color: var(--nara-ink-accent); }
.hero-review-diagnostic-foot { display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 19px; color: var(--nara-ink-muted); font-family: var(--nara-mono); font-size: 10px; }
.hero-review-diagnostic-dot { width: 6px; height: 6px; flex: none; border-radius: 50%; background: var(--nara-ink-danger); }
.hero-review-diagnostic--fix .hero-review-diagnostic-dot, .hero-review-diagnostic--pass .hero-review-diagnostic-dot { background: var(--nara-ink-accent); }
.hero-diagnostic-enter-active, .hero-diagnostic-leave-active { transition: opacity 0.24s ease, transform 0.24s ease; }
.hero-diagnostic-enter-from { opacity: 0; transform: translateY(7px); }
.hero-diagnostic-leave-to { opacity: 0; transform: translateY(-5px); }
.hero-review-footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 68px; padding: 12px 21px; border-top: 1px solid var(--nara-ink-line); background: var(--nara-ink-bar); }
.hero-review-footer-label, .hero-review-footer-note { color: var(--nara-ink-muted); font-family: var(--nara-mono); font-size: 9px; font-weight: 700; letter-spacing: 0.06em; white-space: nowrap; }
.hero-review-steps { display: flex; align-items: center; gap: 4px; padding: 4px; border: 1px solid var(--nara-ink-line); border-radius: 10px; }
.hero-review-steps button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 83px; min-height: 32px; padding: 5px 12px; border-radius: 7px; color: var(--nara-ink-muted); font-size: 11px; font-weight: 700; transition: color 0.2s ease, background-color 0.2s ease; }
.hero-review-steps button span { color: var(--nara-ink-muted); font-family: var(--nara-mono); font-size: 9px; }
.hero-review-steps button:hover { color: #fff; }
.hero-review-steps button.is-active { background: rgba(255, 255, 255, 0.09); color: #fff; }
.hero-review-steps button.is-active span { color: var(--nara-ink-accent); }
.pane-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 36px; padding: 0 18px; border-bottom: 1px solid var(--nara-ink-line); color: var(--nara-ink-muted); font-family: var(--nara-mono); font-size: 11.5px; }
.pane-head span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pane-head span + span { flex: none; opacity: 0.7; }

.code { padding: 14px 0 18px; overflow-x: auto; font-family: var(--nara-mono); font-size: 12px; line-height: 1.8; }
.code-line { display: grid; grid-template-columns: 38px 16px max-content; width: max-content; min-width: 100%; min-height: 1.8em; padding-right: 16px; }
.code-number { padding-right: 12px; color: #3c4d67; text-align: right; user-select: none; }
.code-mark { user-select: none; }
.code-line code { white-space: pre; }
.code-line--del { background: rgba(255, 143, 143, 0.09); }
.code-line--del .code-mark { color: var(--nara-ink-danger); }
.code-line--del code { opacity: 0.7; text-decoration: line-through; text-decoration-color: rgba(255, 143, 143, 0.6); }
.code-line--add { background: rgba(110, 224, 173, 0.09); }
.code-line--add .code-mark { color: var(--nara-ink-accent); }
.tk-kw { color: #c3a6ff; }
.tk-str { color: #9fe3bd; }
.tk-fn { color: #8ec3ff; }
.tk-ty { color: #f2c870; }
.tk-num { color: #ffb38a; }
.tk-cm { color: #5d708c; font-style: italic; }

@keyframes hero-enter { from { opacity: 0; transform: translateY(14px); } }
@keyframes hero-window-enter { from { opacity: 0; transform: translateY(18px) scale(0.992); } }

/* Proof strip */
.proof-strip { padding: 0; }
.proof-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(20px, 3.6vw, 52px); }
.proof-item { position: relative; min-width: 0; padding-top: 15px; border-top: 1px solid var(--nara-line-strong); }
.proof-item::after { content: ''; position: absolute; top: -1px; left: 0; width: 34px; height: 2px; background: var(--nara-accent-strong); transform: scaleX(0); transform-origin: left; transition: transform 0.28s ease; }
.proof-item:hover::after { transform: scaleX(1); }
.proof-number { color: var(--nara-accent-strong); font-family: var(--nara-mono); font-size: 9px; font-weight: 700; letter-spacing: 0.095em; }
.proof-title { margin-top: 17px; font-size: clamp(17px, 1.7vw, 21px); font-weight: 800; line-height: 1.2; letter-spacing: -0.04em; }
.proof-copy { max-width: 215px; margin-top: 9px; color: var(--nara-muted); font-size: 13px; line-height: 1.7; }

/* Sections */
.section { padding: 0; scroll-margin-top: 88px; }
.section-head { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 400px); align-items: end; gap: 32px 64px; margin-bottom: 56px; }
.eyebrow { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; color: var(--nara-accent-strong); font-family: var(--nara-mono); font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
.eyebrow span { display: inline-flex; align-items: center; gap: 12px; color: var(--nara-faint); }
.eyebrow span::after { content: ''; width: 28px; height: 1px; background: currentColor; opacity: 0.6; }
.section-title { font-size: clamp(2.2rem, 4.6vw, 3.6rem); font-weight: 800; line-height: 1.04; letter-spacing: -0.05em; }
:global(.dark .section-title-accent) { color: var(--nara-accent-strong); }
.section-description { max-width: 420px; color: var(--nara-muted); font-size: 16.5px; line-height: 1.75; }

/* Feature model */
.feature-story { overflow: hidden; border: 1px solid var(--nara-line-strong); border-radius: 10px; background: var(--nara-surface); }
.feature-story-topline { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 46px; padding: 12px 28px; border-bottom: 1px solid var(--nara-line-strong); color: var(--nara-faint); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.085em; }
.feature-story-topline span:first-child { color: var(--nara-accent-strong); }
.feature-story-body { display: grid; grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr); }
.feature-showcase { position: relative; isolation: isolate; display: flex; min-width: 0; flex-direction: column; min-height: 610px; overflow: hidden; padding: 30px 42px 34px; background: var(--nara-ink); color: var(--nara-ink-fg); }
:global(.dark .feature-showcase) { --nara-ink-fg: #f7f7f5; --nara-ink-muted: #c7ced5; --nara-ink-accent: #b7e8cd; --nara-ink-line: rgba(245, 246, 244, 0.24); background: #384452; }
.feature-showcase-top, .feature-anatomy-heading > span { color: var(--nara-ink-muted); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.11em; }
.feature-showcase-top { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.feature-showcase-mark { display: inline-flex; width: 27px; height: 27px; align-items: center; justify-content: center; border: 1px solid var(--nara-ink-line); border-radius: 50%; color: var(--nara-ink-accent); font-size: 16px; }
.feature-receipt { width: min(100%, 350px); margin: auto; padding: 0; border-radius: 3px; background: #f8f8f3; box-shadow: 0 20px 40px -20px rgba(0, 0, 0, 0.4); color: #1c292d; transform: translateY(7px); transition: transform 0.45s cubic-bezier(0.2, 0.75, 0.2, 1), box-shadow 0.45s ease; }
.feature-story:hover .feature-receipt { transform: translateY(1px); }
.feature-story:has(.feature-anatomy-list li:hover) .feature-receipt { box-shadow: 0 25px 54px -23px rgba(0, 0, 0, 0.5); }
.feature-receipt-head { display: flex; align-items: center; gap: 10px; padding: 22px 24px; border-bottom: 1px solid #dfe3dd; }
.feature-receipt-symbol { display: inline-flex; width: 33px; height: 33px; align-items: center; justify-content: center; border-radius: 7px; background: #1e5540; color: #f8f8f3; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 19px; font-weight: 800; letter-spacing: -0.09em; }
.feature-receipt-brand { display: flex; flex-direction: column; font-size: 13px; font-weight: 800; line-height: 1.15; letter-spacing: -0.035em; }
.feature-receipt-brand small { margin-top: 3px; color: #697671; font-size: 9px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.feature-receipt-number { margin-left: auto; color: #75807b; font-family: var(--nara-mono); font-size: 10px; }
.feature-receipt-details { padding: 28px 24px 18px; }
.feature-receipt-label { color: #6b7771; font-size: 11px; font-weight: 600; }
.feature-receipt-details h3 { margin-top: 5px; font-size: 21px; font-weight: 800; line-height: 1.3; letter-spacing: -0.045em; }
.feature-receipt-subtitle { margin-top: 6px; color: #7a837d; font-size: 10.5px; }
.feature-receipt-amount { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 26px 0 18px; padding-bottom: 19px; border-bottom: 1px solid #dfe3dd; }
.feature-receipt-amount > span { color: #66736d; font-size: 12px; }
.feature-receipt-amount strong { font-size: 36px; font-weight: 800; letter-spacing: -0.07em; white-space: nowrap; }
.feature-receipt-amount strong span { font-size: 23px; }
.feature-receipt-item { display: flex; justify-content: space-between; gap: 12px; margin-top: 13px; color: #738079; font-size: 11px; }
.feature-receipt-item strong { color: #374740; font-weight: 700; }
.feature-receipt-paid { display: flex; align-items: center; gap: 9px; margin-top: 6px; padding: 19px 24px; border-top: 1px dashed #cbd6ce; color: #296848; font-size: 11px; }
.feature-receipt-paid-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: #3e9662; }
.feature-receipt-paid strong { font-weight: 800; }
.feature-receipt-paid > span:last-child { margin-left: auto; color: #6e7e72; font-size: 10px; }
.feature-showcase-bottom { margin-top: 24px; color: var(--nara-ink-muted); font-size: 13px; line-height: 1.8; }
.feature-showcase-thread { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 9px; color: var(--nara-ink-accent); font-family: var(--nara-mono); font-size: 9px; font-weight: 700; letter-spacing: 0.08em; }
.feature-showcase-thread > span { display: inline-block; width: 22px; height: 1px; background: currentColor; }
.feature-showcase-bottom strong { color: var(--nara-ink-fg); font-weight: 700; }
.feature-anatomy { display: flex; min-width: 0; flex-direction: column; padding: 44px 46px 32px; }
.feature-anatomy-heading > span { color: var(--nara-accent-strong); }
.feature-anatomy-heading h3 { max-width: 370px; margin-top: 10px; font-size: clamp(1.7rem, 3vw, 2.45rem); font-weight: 800; line-height: 1.2; letter-spacing: -0.048em; }
:global(.dark .feature-heading-accent) { color: var(--nara-accent-strong); }
.feature-anatomy-lead { max-width: 340px; margin-top: 13px; color: var(--nara-muted); font-size: 12.5px; line-height: 1.7; }
.feature-anatomy-list { margin-top: 27px; border-top: 1px solid var(--nara-line-strong); }
.feature-anatomy-list li { position: relative; display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: baseline; gap: 18px; padding: 18px 0; border-bottom: 1px solid var(--nara-line); transition: padding 0.25s ease, background-color 0.25s ease; }
.feature-anatomy-list li::before { content: ''; position: absolute; top: 14px; bottom: 14px; left: 0; width: 2px; background: var(--nara-accent-strong); transform: scaleY(0); transition: transform 0.25s ease; }
.feature-anatomy-list li:hover { padding-left: 10px; background: var(--nara-accent-soft); }
.feature-anatomy-list li:hover::before { transform: scaleY(1); }
.feature-anatomy-index { color: var(--nara-accent-strong); font-family: var(--nara-mono); font-size: 11px; font-weight: 600; }
.feature-anatomy-list h4 { font-size: 19px; font-weight: 800; line-height: 1.3; letter-spacing: -0.035em; }
.feature-anatomy-list h4 span { color: var(--nara-faint); font-family: 'Manrope', system-ui, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0; }
.feature-anatomy-list p { max-width: 285px; margin-top: 5px; color: var(--nara-muted); font-size: 12.5px; line-height: 1.6; }
.feature-anatomy-side { color: var(--nara-faint); font-family: var(--nara-mono); font-size: 10px; text-align: right; }
.feature-anatomy-home { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 27px; }
.feature-anatomy-home > span { color: var(--nara-faint); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.08em; }
.feature-anatomy-home code { color: var(--nara-accent-strong); font-size: 12px; font-weight: 600; }
.feature-story-bottom { display: grid; grid-template-columns: minmax(0, 0.88fr) repeat(2, minmax(0, 0.56fr)); min-height: 124px; border-top: 1px solid var(--nara-line-strong); background: var(--nara-surface-soft); }
:global(.dark .feature-story-bottom) { background: #303c48; }
.feature-story-bottom-lead { display: flex; align-items: center; max-width: 380px; padding: 24px 35px; font-size: 20px; font-weight: 800; line-height: 1.35; letter-spacing: -0.04em; }
.feature-access { display: flex; align-items: flex-start; gap: 13px; padding: 25px 18px 22px; border-left: 1px solid var(--nara-line); }
.feature-access-arrow { color: var(--nara-accent-strong); font-size: 18px; line-height: 1.2; transition: transform 0.2s ease; }
.feature-access div { display: flex; min-width: 0; flex-direction: column; gap: 6px; }
.feature-access:hover .feature-access-arrow { transform: translate(3px, -3px); }
.feature-access strong { font-size: 13px; font-weight: 800; }
.feature-access div span { color: var(--nara-muted); font-size: 11.5px; line-height: 1.5; }
.feature-access code { display: block; margin-top: 5px; color: var(--nara-accent-strong); font-size: 10px; font-weight: 700; }

/* Workflow */
.workflow-experience { display: grid; grid-template-columns: minmax(192px, 0.31fr) minmax(0, 1fr); align-items: start; gap: clamp(40px, 6vw, 92px); border-top: 1px solid var(--nara-line-strong); padding-top: 26px; }
.workflow-navigation { min-width: 0; }
.workflow-navigation-meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 25px; color: var(--nara-faint); font-family: var(--nara-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.09em; }
.workflow-stages { display: flex; flex-direction: column; }
.stage-tab { position: relative; display: flex; align-items: center; width: 100%; gap: 15px; min-width: 0; padding: 23px 8px 22px 0; border-bottom: 1px solid var(--nara-line); color: var(--nara-muted); text-align: left; transition: color 0.2s ease, padding-left 0.22s ease; }
.stage-tab:first-child { border-top: 1px solid var(--nara-line); }
.stage-tab::before { content: ''; position: absolute; top: -1px; left: 0; width: 28px; height: 2px; background: var(--nara-accent-strong); transform: scaleX(0); transform-origin: left; transition: transform 0.23s ease; }
.stage-tab:hover { color: var(--nara-fg); padding-left: 5px; }
.stage-tab--active { color: var(--nara-fg); }
.stage-tab--active::before { transform: scaleX(1); }
.stage-step { align-self: flex-start; margin-top: 4px; color: var(--nara-faint); font-family: var(--nara-mono); font-size: 11px; font-weight: 700; }
.stage-tab--active .stage-step { color: var(--nara-accent-strong); }
.stage-tab-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5px; }
.stage-name { font-size: clamp(17px, 1.9vw, 22px); font-weight: 800; letter-spacing: -0.04em; line-height: 1.2; }
.stage-hint { color: var(--nara-faint); font-size: 11px; font-weight: 500; line-height: 1.5; }
.stage-tab-arrow { align-self: flex-start; color: var(--nara-accent-strong); font-size: 18px; line-height: 1.2; opacity: 0; transform: translate(-3px, 3px); transition: opacity 0.2s ease, transform 0.2s ease; }
.stage-tab--active .stage-tab-arrow, .stage-tab:hover .stage-tab-arrow { opacity: 1; transform: translate(0, 0); }
.workflow-navigation-note { max-width: 205px; margin-top: 25px; color: var(--nara-faint); font-size: 12px; line-height: 1.7; }
.workflow-stage-panel { min-width: 0; animation: workflow-stage-in 0.32s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
@keyframes workflow-stage-in { from { opacity: 0; transform: translateY(7px); } }
.workflow-stage-head { min-height: 196px; padding: 0 0 27px; }
.workflow-stage-kicker { display: flex; align-items: center; gap: 9px; color: var(--nara-accent-strong); font-family: var(--nara-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.workflow-stage-dot, .wf-success-dot { display: inline-block; width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--nara-accent-strong); }
.stage-title { max-width: 600px; margin-top: 16px; font-size: clamp(2rem, 3vw, 2.85rem); font-weight: 800; line-height: 1.14; letter-spacing: -0.053em; text-wrap: balance; }
.stage-copy { max-width: 620px; margin-top: 13px; color: var(--nara-muted); font-size: 14px; line-height: 1.7; text-wrap: pretty; }
.workflow-canvas { --wf-soft: color-mix(in srgb, var(--nara-accent-strong) 8%, var(--nara-bg)); display: flex; min-width: 0; min-height: 385px; flex-direction: column; padding: 20px 26px 17px; border: 1px solid var(--nara-line-strong); border-radius: 15px; background: var(--nara-surface); }
:global(.dark .workflow-canvas) { background: #263440; }
:global(.dark .workflow-stage-dot),
:global(.dark .wf-success-dot) { background: var(--nara-signal); }
:global(.dark .stage-tab--active::before) { background: var(--nara-signal); }
.workflow-canvas-top, .workflow-canvas-bottom { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--nara-faint); font-family: var(--nara-mono); font-size: 9px; font-weight: 600; letter-spacing: 0.09em; }
.workflow-canvas-top { padding-bottom: 14px; border-bottom: 1px solid var(--nara-line); }
.workflow-canvas-top span:first-child { color: var(--nara-fg); }
.workflow-canvas-bottom { margin-top: auto; padding-top: 15px; border-top: 1px solid var(--nara-line); }
.workflow-outcome { display: flex; align-items: baseline; gap: 10px; margin-top: 18px; color: var(--nara-muted); font-size: 12px; line-height: 1.6; }
.workflow-outcome span { color: var(--nara-accent-strong); font-size: 17px; }
.wf-mini-label { color: var(--nara-faint); font-family: var(--nara-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; }

.wf-compose { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 0.93fr); gap: 25px; flex: 1; padding: 20px 0; }
.wf-tree { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.wf-tree .wf-mini-label { margin-bottom: 8px; }
.wf-tree-line { display: flex; align-items: center; min-height: 28px; gap: 10px; padding: 4px 10px; color: var(--nara-muted); font-family: var(--nara-mono); font-size: 11px; font-weight: 600; }
.wf-tree-line--nested { padding-left: 29px; }
.wf-tree-line--dim { opacity: 0.65; }
.wf-tree-line--feature { margin-left: 43px; border-radius: 6px; background: var(--wf-soft); color: var(--nara-fg); }
.wf-tree-line--feature strong { font-weight: 800; }
.wf-tree-line--file { padding-left: 73px; color: var(--nara-fg); font-size: 10px; }
.wf-folder { display: inline-block; width: 14px; height: 10px; flex: none; border: 1.5px solid var(--nara-faint); border-radius: 2px; }
.wf-folder--accent { border-color: var(--nara-accent-strong); }
.wf-file-symbol { width: 10px; height: 13px; flex: none; border: 1px solid var(--nara-faint); border-radius: 1px; }
.wf-new-tag { margin-left: auto; color: var(--nara-accent-strong); font-size: 8px; font-weight: 800; letter-spacing: 0.03em; }
.wf-compose-side { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; min-width: 0; padding: 20px 0 20px 26px; border-left: 1px solid var(--nara-line); }
.wf-status-mark { margin-bottom: 17px; color: var(--nara-accent-strong); font-size: 24px; }
.wf-compose-side > strong { margin-top: 7px; color: var(--nara-fg); font-size: clamp(27px, 3vw, 39px); font-weight: 800; letter-spacing: -0.065em; line-height: 1.1; }
.wf-compose-side > strong span { color: var(--nara-accent-strong); }
.wf-compose-side > p:not(.wf-mini-label) { max-width: 200px; margin-top: 14px; color: var(--nara-muted); font-size: 12px; line-height: 1.7; }
.wf-micro-result { display: flex; align-items: center; gap: 8px; margin-top: 23px; color: var(--nara-accent-strong); font-family: var(--nara-mono); font-size: 10px; font-weight: 700; }

.wf-own { display: flex; flex: 1; flex-direction: column; justify-content: center; padding: 22px 0; }
.wf-own-diagram { display: grid; grid-template-columns: minmax(0, 1fr) 72px minmax(0, 1fr); align-items: center; gap: 8px; margin-top: 24px; }
.wf-own-node { display: flex; min-height: 145px; min-width: 0; flex-direction: column; justify-content: center; padding: 18px; border: 1px solid var(--nara-line-strong); border-radius: 9px; background: var(--nara-bg); }
.wf-own-node--binding { border-color: color-mix(in srgb, var(--nara-accent-strong) 38%, var(--nara-line)); background: var(--wf-soft); }
.wf-own-node > span { color: var(--nara-faint); font-family: var(--nara-mono); font-size: 9px; font-weight: 700; letter-spacing: 0.08em; }
.wf-own-node strong { margin-top: 14px; font-size: clamp(19px, 2.4vw, 29px); font-weight: 800; letter-spacing: -0.05em; line-height: 1.1; }
.wf-own-node small { margin-top: 7px; color: var(--nara-muted); font-size: 10px; line-height: 1.5; }
.wf-own-connector { display: flex; align-items: center; gap: 3px; color: var(--nara-accent-strong); font-size: 23px; }
.wf-own-connector span { flex: 1; height: 1px; background: var(--nara-accent-strong); }
.wf-own-connector b { font-weight: 400; }
.wf-own-footer { display: flex; align-items: flex-start; gap: 11px; max-width: 510px; margin-top: 28px; color: var(--nara-muted); font-size: 11px; line-height: 1.7; }
.wf-own-footer .wf-success-dot { margin-top: 6px; }
.wf-own-footer strong { color: var(--nara-fg); font-weight: 700; }

.wf-understand { display: flex; flex: 1; flex-direction: column; justify-content: center; padding: 20px 0 16px; }
.wf-understand-intro { display: flex; justify-content: space-between; gap: 12px; }
.wf-understand-live { display: flex; align-items: center; gap: 7px; color: var(--nara-muted); font-family: var(--nara-mono); font-size: 9px; }
.wf-relations { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: center; gap: 28px; margin-top: 45px; }
.wf-relations-branches { position: absolute; top: 50%; right: 0; left: 0; height: 1px; background: var(--nara-line-strong); pointer-events: none; }
.wf-relation { position: relative; z-index: 1; display: flex; min-width: 0; min-height: 133px; flex-direction: column; justify-content: center; padding: 18px 15px; border: 1px solid var(--nara-line-strong); border-radius: 8px; background: var(--nara-bg); }
.wf-relation--primary { border-color: var(--nara-accent-strong); background: var(--wf-soft); }
.wf-relation > span:not(.wf-relation-line) { color: var(--nara-faint); font-family: var(--nara-mono); font-size: 8px; font-weight: 700; letter-spacing: 0.07em; }
.wf-relation strong { margin-top: 14px; font-size: clamp(19px, 2.2vw, 27px); font-weight: 800; letter-spacing: -0.05em; }
.wf-relation small { margin-top: 7px; color: var(--nara-muted); font-size: 10px; line-height: 1.5; }
.wf-relation-line { position: absolute; left: -21px; top: calc(50% - 3px); width: 7px; height: 7px; border-top: 1.5px solid var(--nara-accent-strong); border-right: 1.5px solid var(--nara-accent-strong); transform: rotate(45deg); }
.wf-understand-caption { margin-top: 27px; color: var(--nara-muted); font-size: 11px; line-height: 1.6; }

.wf-evolve { display: flex; flex: 1; flex-direction: column; justify-content: center; padding: 20px 0; }
.wf-evolve-labels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; color: var(--nara-faint); font-family: var(--nara-mono); font-size: 9px; font-weight: 700; letter-spacing: 0.08em; }
.wf-evolve-columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 10px; }
.wf-evolve-version { display: flex; min-width: 0; min-height: 106px; flex-direction: column; align-items: flex-start; justify-content: center; gap: 7px; padding: 15px 12px; border: 1px solid var(--nara-line-strong); border-radius: 8px; background: var(--nara-bg); }
.wf-evolve-version--local { border-color: color-mix(in srgb, var(--nara-accent-strong) 38%, var(--nara-line)); background: var(--wf-soft); }
.wf-evolve-version-mark { color: var(--nara-accent-strong); font-size: 16px; line-height: 1; }
.wf-evolve-version strong { font-size: 12px; font-weight: 800; line-height: 1.35; }
.wf-evolve-version small { color: var(--nara-muted); font-size: 10px; line-height: 1.45; }
.wf-evolve-join { display: flex; justify-content: space-around; align-items: center; height: 32px; color: var(--nara-accent-strong); }
.wf-evolve-join span { width: 1px; height: 17px; background: var(--nara-line-strong); }
.wf-evolve-join b { font-size: 20px; font-weight: 400; }
.wf-evolve-output { display: flex; align-items: center; gap: 13px; min-height: 67px; padding: 15px 18px; border: 1px solid color-mix(in srgb, var(--nara-accent-strong) 42%, var(--nara-line)); border-radius: 9px; background: var(--wf-soft); }
.wf-evolve-output div { display: flex; min-width: 0; flex-direction: column; gap: 5px; }
.wf-evolve-output strong { font-size: 12px; font-weight: 800; }
.wf-evolve-output small { color: var(--nara-muted); font-size: 10px; line-height: 1.5; }
.wf-evolve-output-arrow { margin-left: auto; color: var(--nara-accent-strong); font-size: 18px; }

.wf-protect { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); flex: 1; gap: 22px; align-items: center; padding: 20px 0; }
.wf-protect-verdict { display: flex; flex-direction: column; align-items: flex-start; }
.wf-protect-check { display: flex; width: 35px; height: 35px; align-items: center; justify-content: center; border: 1.5px solid var(--nara-accent-strong); border-radius: 50%; color: var(--nara-accent-strong); font-size: 18px; }
.wf-protect-verdict > p { margin-top: 19px; color: var(--nara-faint); font-family: var(--nara-mono); font-size: 9px; letter-spacing: 0.08em; }
.wf-protect-verdict > strong { margin-top: 8px; color: var(--nara-fg); font-size: clamp(28px, 3.3vw, 43px); font-weight: 800; line-height: 1.06; letter-spacing: -0.065em; }
.wf-protect-verdict > span { margin-top: 10px; color: var(--nara-accent-strong); font-size: 11px; font-weight: 700; }
.wf-protect-facts { display: flex; flex-direction: column; gap: 0; }
.wf-protect-facts > div { display: flex; flex-direction: column; gap: 4px; padding: 13px 0; border-bottom: 1px solid var(--nara-line); }
.wf-protect-facts > div:first-child { border-top: 1px solid var(--nara-line); }
.wf-protect-facts span { color: var(--nara-accent-strong); font-family: var(--nara-mono); font-size: 9px; font-weight: 700; }
.wf-protect-facts strong { font-size: 12px; font-weight: 800; }
.wf-protect-facts small { color: var(--nara-muted); font-size: 10px; line-height: 1.5; }

/* Foundation */
.foundation-section { padding-bottom: 0; }
.foundation-story { display: grid; grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr); gap: 72px; align-items: start; }
.foundation-visual { position: sticky; top: 104px; grid-column: 2; grid-row: 1; height: min(680px, calc(100vh - 132px)); min-height: 560px; }
.foundation-scene { position: relative; isolation: isolate; display: flex; height: 100%; flex-direction: column; overflow: hidden; padding: 20px 24px 22px; border: 1px solid var(--nara-line); border-radius: 26px; background: var(--nara-surface); color: var(--nara-fg); box-shadow: var(--nara-shadow); }
:global(.dark .foundation-scene) { background: #293642; }
.foundation-scene::before { content: ''; position: absolute; inset: 0; z-index: -1; background-image: linear-gradient(var(--nara-grid) 1px, transparent 1px), linear-gradient(90deg, var(--nara-grid) 1px, transparent 1px); background-size: 40px 40px; -webkit-mask-image: radial-gradient(ellipse 80% 60% at 100% 100%, #000 10%, transparent 70%); mask-image: radial-gradient(ellipse 80% 60% at 100% 100%, #000 10%, transparent 70%); pointer-events: none; }
.foundation-map-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--nara-line); color: var(--nara-faint); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
.foundation-map-meta span:first-child { display: inline-flex; align-items: center; gap: 10px; }
.foundation-map-live { width: 7px; height: 7px; border-radius: 50%; background: var(--nara-accent); box-shadow: 0 0 0 4px var(--nara-accent-soft); animation: foundation-request-pulse 2.2s ease-in-out infinite; }
.foundation-request { display: flex; align-items: center; gap: 10px; margin-top: 18px; padding: 9px 12px 9px 9px; border: 1px solid var(--nara-line); border-radius: 12px; background: var(--nara-bg); font-family: var(--nara-mono); font-size: 11.5px; }
.foundation-request-method { padding: 3px 7px; border-radius: 6px; background: var(--nara-accent-soft); color: var(--nara-accent-strong); font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; }
.foundation-request code { color: var(--nara-fg); font-weight: 600; }
.foundation-request-status { margin-left: auto; color: var(--nara-muted); white-space: nowrap; }
.foundation-lanes { display: flex; min-height: 0; flex: 1; flex-direction: column; margin-top: 10px; }
.foundation-lane { position: relative; display: grid; flex: 1 1 auto; grid-template-columns: 32px minmax(0, 1fr); gap: 16px; align-items: center; min-height: 0; }
.foundation-lane::before { content: ''; position: absolute; top: 0; bottom: 0; left: 15.5px; width: 1px; background: var(--nara-line-strong); transition: background 0.4s ease; }
.foundation-lane:first-child::before { top: 50%; }
.foundation-lane:last-child::before { bottom: 50%; }
.foundation-lane--passed::before, .foundation-lane--active:last-child::before { background: var(--nara-accent-strong); }
.foundation-lane--active::before { background: linear-gradient(var(--nara-accent-strong) 50%, var(--nara-line-strong) 50%); }
.foundation-lane--active:first-child::before { background: var(--nara-line-strong); }
.foundation-lane-index { position: relative; z-index: 1; display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center; border: 1px solid var(--nara-line-strong); border-radius: 50%; background: var(--nara-surface); color: var(--nara-faint); font-family: var(--nara-mono); font-size: 10.5px; font-weight: 600; transition: background-color 0.35s ease, border-color 0.35s ease, color 0.35s ease, box-shadow 0.35s ease; }
.foundation-lane--passed .foundation-lane-index { border-color: var(--nara-accent); color: var(--nara-accent-strong); }
.foundation-lane--active .foundation-lane-index { border-color: transparent; background: var(--nara-accent-strong); color: var(--nara-surface); box-shadow: 0 0 0 6px var(--nara-accent-soft); }
.foundation-lane-body { min-width: 0; padding: 12px 16px; border: 1px solid transparent; border-radius: 16px; opacity: 0.42; transition: opacity 0.4s ease, background-color 0.4s ease, border-color 0.4s ease, transform 0.5s cubic-bezier(0.2, 0.72, 0.2, 1); }
.foundation-lane--passed .foundation-lane-body { opacity: 0.7; }
.foundation-lane--active .foundation-lane-body { border-color: color-mix(in srgb, var(--nara-accent-strong) 26%, var(--nara-line)); background: var(--nara-accent-soft); opacity: 1; transform: translateX(4px); }
.foundation-lane-body small { display: block; color: var(--nara-faint); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
.foundation-lane--active .foundation-lane-body small { color: var(--nara-accent-strong); }
.foundation-lane-body strong { display: block; margin-top: 5px; overflow: hidden; font-size: clamp(1.1rem, 1.8vw, 1.5rem); font-weight: 800; line-height: 1.1; letter-spacing: -0.04em; text-overflow: ellipsis; white-space: nowrap; }
.foundation-lane-more { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.45s cubic-bezier(0.2, 0.72, 0.2, 1); }
.foundation-lane--active .foundation-lane-more { grid-template-rows: 1fr; }
.foundation-lane-chips { display: flex; min-height: 0; flex-wrap: wrap; gap: 6px; overflow: hidden; transition: padding-top 0.45s cubic-bezier(0.2, 0.72, 0.2, 1); }
.foundation-lane--active .foundation-lane-chips { padding-top: 12px; }
.foundation-lane-chips li { padding: 4px 8px; border: 1px solid var(--nara-line-strong); border-radius: 7px; background: var(--nara-surface); color: var(--nara-muted); font-family: var(--nara-mono); font-size: 10.5px; white-space: nowrap; }
.foundation-lane-chips .foundation-lane-chip--next { border-style: dashed; border-color: var(--nara-accent-strong); background: transparent; color: var(--nara-accent-strong); font-weight: 600; }
.foundation-map-caption { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--nara-line); color: var(--nara-muted); font-size: 13px; line-height: 1.5; }
.foundation-swap-enter-active, .foundation-swap-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.foundation-swap-enter-from { opacity: 0; transform: translateY(4px); }
.foundation-swap-leave-to { opacity: 0; transform: translateY(-4px); }

@keyframes foundation-request-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.72); opacity: 0.55; } }
.foundation-narrative { grid-column: 1; grid-row: 1; }
.foundation-step { display: flex; min-height: 72vh; flex-direction: column; justify-content: center; padding: 40px 0; opacity: 1; transform: none; transition: opacity 0.4s ease, transform 0.4s ease; }
.landing-page--motion .foundation-step { opacity: 0.32; transform: translateY(14px); }
.foundation-step:first-child { padding-top: 0; }
.landing-page--motion .foundation-step--active { opacity: 1; transform: translateY(0); }
.foundation-step-index { color: var(--nara-accent-strong); font-family: var(--nara-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; }
.foundation-step-title { max-width: 460px; margin-top: 18px; font-size: clamp(2rem, 3.5vw, 3.15rem); font-weight: 800; line-height: 1.03; letter-spacing: -0.05em; }
.foundation-step-copy { max-width: 450px; margin-top: 20px; color: var(--nara-muted); font-size: 15px; line-height: 1.75; }
.foundation-step-copy code { color: var(--nara-fg); font-size: 0.9em; }
.foundation-step-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; max-width: 460px; margin-top: 28px; border-top: 1px solid var(--nara-line); }
.foundation-step-facts li { display: flex; flex-direction: column; gap: 4px; padding: 12px 0; border-bottom: 1px solid var(--nara-line); }
.foundation-step-facts code { color: var(--nara-fg); font-size: 11px; font-weight: 600; }
.foundation-step-facts span { color: var(--nara-muted); font-size: 11.5px; }
.foundation-permissions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 24px; }
.foundation-permission { padding: 6px 9px; border: 1px solid var(--nara-line); border-radius: 7px; color: var(--nara-muted); font-family: var(--nara-mono); font-size: 10px; }
.foundation-permission--admin { border-color: transparent; background: var(--nara-fg); color: var(--nara-bg); }
.foundation-migrations { max-width: 460px; margin-top: 28px; font-family: var(--nara-mono); font-size: 10px; }
.foundation-migrations li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 10px 0; border-top: 1px solid var(--nara-line); }
.foundation-migrations code { overflow: hidden; color: var(--nara-fg); text-overflow: ellipsis; white-space: nowrap; }
.foundation-migrations span { color: var(--nara-faint); }
.foundation-product-list { display: flex; flex-wrap: wrap; gap: 8px; max-width: 460px; margin-top: 28px; }
.foundation-product-list span { padding: 8px 11px; border: 1px solid var(--nara-line); border-radius: 9px; background: var(--nara-surface); font-size: 12px; font-weight: 600; }
.foundation-install-list { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 18px; color: var(--nara-fg); font-family: var(--nara-mono); font-size: 10px; }
.foundation-install-list span { color: var(--nara-accent-strong); }

/* Principles */
.principles-section { --principle-strike: #c76a5a; }
:global(.dark .principles-section) { --principle-strike: #ff8f8f; }
.principles-manifesto { display: grid; grid-template-columns: minmax(0, 0.87fr) minmax(0, 1.13fr); align-items: start; gap: clamp(52px, 8vw, 112px); }
.principles-intro { position: sticky; top: 125px; align-self: start; padding-top: 13px; }
.principles-manifesto-title { margin-top: 30px; font-size: clamp(2.8rem, 4.75vw, 4.6rem); font-weight: 800; line-height: 1.08; letter-spacing: -0.062em; text-wrap: balance; }
.principles-manifesto-title em { color: var(--nara-accent-strong); font-style: normal; }
.principles-manifesto-copy { max-width: 380px; margin-top: 26px; color: var(--nara-muted); font-size: 16px; line-height: 1.8; text-wrap: pretty; }
.principles-intro-foot { display: flex; align-items: flex-start; gap: 16px; max-width: 375px; margin-top: 76px; padding-top: 18px; border-top: 1px solid var(--nara-line-strong); }
.principles-intro-rule { width: 8px; height: 8px; flex: none; margin-top: 5px; border-radius: 50%; background: var(--nara-accent-strong); }
.principles-intro-foot p { color: var(--nara-faint); font-family: var(--nara-mono); font-size: 11px; line-height: 1.8; }
.principles-reading-head { display: flex; justify-content: space-between; gap: 18px; padding: 13px 0 17px; border-top: 1px solid var(--nara-fg); color: var(--nara-faint); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
.principles-reading-head span:first-child { color: var(--nara-fg); }
.principle-row { position: relative; padding: 36px 0 42px; border-top: 1px solid var(--nara-line); }
.principle-row:last-child { border-bottom: 1px solid var(--nara-line-strong); }
.principle-row::before { content: ''; position: absolute; top: -1px; left: 0; width: 38px; height: 2px; background: var(--nara-accent-strong); transform: scaleX(0); transform-origin: left center; transition: transform 0.3s ease; }
.principle-row:hover::before { transform: scaleX(1); }
.principle-row-head { display: flex; align-items: center; gap: 16px; }
.principle-index { color: var(--nara-accent-strong); font-family: var(--nara-mono); font-size: 12px; font-weight: 700; letter-spacing: 0.06em; }
.principle-type { color: var(--nara-faint); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
.principle-arrow { margin-left: auto; color: var(--nara-faint); font-size: 18px; transition: color 0.25s ease, transform 0.25s ease; }
.principle-row:hover .principle-arrow { color: var(--nara-accent-strong); transform: translate(3px, -3px); }
.principle-title { max-width: 500px; margin-top: 25px; font-size: clamp(2rem, 3.1vw, 2.85rem); font-weight: 800; line-height: 1.14; letter-spacing: -0.055em; text-wrap: balance; }
.principle-copy { max-width: 470px; margin-top: 15px; color: var(--nara-muted); font-size: 14px; line-height: 1.75; text-wrap: pretty; }
.principle-details { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-top: 32px; padding-top: 18px; border-top: 1px solid var(--nara-line); }
.principle-detail { min-width: 0; }
.principle-detail-label { display: block; margin-bottom: 12px; color: var(--nara-faint); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.075em; text-transform: uppercase; }
.principle-uses, .principle-rejects { display: flex; flex-wrap: wrap; gap: 7px 10px; align-items: baseline; }
.principle-uses li, .principle-rejects li { min-width: 0; color: var(--nara-fg); font-size: 12px; font-weight: 600; line-height: 1.65; }
.principle-uses li + li::before, .principle-rejects li + li::before { content: '·'; margin-right: 10px; color: var(--nara-faint); }
.principle-uses code { color: var(--nara-accent-strong); font-size: 11px; font-weight: 600; overflow-wrap: anywhere; }
.principle-rejects s { color: var(--nara-muted); text-decoration-color: var(--principle-strike); text-decoration-thickness: 1px; }
.principles-ecosystem { display: grid; grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr); gap: 0 clamp(40px, 8vw, 112px); margin-top: 84px; padding-top: 35px; border-top: 1px solid var(--nara-line-strong); }
.ecosystem-intro { padding: 9px 0 0; }
.ecosystem-kicker { display: flex; align-items: center; justify-content: space-between; max-width: 300px; color: var(--nara-accent-strong); font-family: var(--nara-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.11em; text-transform: uppercase; }
.ecosystem-kicker span { color: var(--nara-muted); font-size: 17px; }
.ecosystem-title { margin-top: 27px; font-size: clamp(2.15rem, 3.75vw, 3.35rem); font-weight: 800; line-height: 1.13; letter-spacing: -0.06em; text-wrap: balance; }
.ecosystem-title span { color: var(--nara-accent-strong); }
.ecosystem-description { max-width: 350px; margin-top: 23px; color: var(--nara-muted); font-size: 15px; line-height: 1.8; text-wrap: pretty; }
.ecosystem-signoff { display: flex; gap: 11px; align-items: baseline; margin-top: 46px; color: var(--nara-faint); font-size: 12px; line-height: 1.6; }
.ecosystem-signoff span { color: var(--nara-accent-strong); font-size: 18px; }
.ecosystem-directory { min-width: 0; }
.ecosystem-directory-head { display: flex; justify-content: space-between; gap: 18px; padding: 9px 0 19px; color: var(--nara-faint); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.105em; }
.ecosystem-directory-head span:first-child { color: var(--nara-fg); }
.ecosystem-logos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 34px; }
.ecosystem-logo-entry { display: flex; min-width: 0; align-items: center; gap: 15px; min-height: 92px; padding: 14px 0; border-top: 1px solid var(--nara-line); transition: padding-left 0.25s cubic-bezier(0.2, 0.7, 0.2, 1); }
.ecosystem-logo-entry:nth-last-child(-n + 2) { border-bottom: 1px solid var(--nara-line); }
.ecosystem-logo-entry:hover { padding-left: 6px; }
.ecosystem-logo-mark { display: flex; flex: 0 0 43px; align-items: center; justify-content: flex-start; gap: 3px; }
.ecosystem-logo-mark img { display: block; width: 36px; height: 36px; flex: none; object-fit: contain; transition: transform 0.25s ease; }
.ecosystem-logo-entry--zod .ecosystem-logo-mark { flex-basis: 47px; }
.ecosystem-logo-entry--zod .ecosystem-logo-mark img { width: 47px; height: 47px; }
.ecosystem-logo-mark img:not(:only-child) { width: 23px; height: 23px; }
.ecosystem-logo-entry:hover img { transform: translateY(-2px); }
.ecosystem-logo-text { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.ecosystem-logo-text strong { color: var(--nara-fg); font-size: 15px; font-weight: 800; line-height: 1.22; letter-spacing: -0.035em; }
.ecosystem-logo-text small { color: var(--nara-muted); font-family: var(--nara-mono); font-size: 10px; line-height: 1.5; }
.ecosystem-footnotes { display: grid; grid-column: 1 / -1; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; margin-top: 63px; padding: 20px 0 0; border-top: 1px solid var(--nara-line-strong); }
.ecosystem-footnotes > div { display: flex; align-items: baseline; gap: 15px; }
.ecosystem-footnotes span { flex: none; color: var(--nara-accent-strong); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.04em; }
.ecosystem-footnotes strong { color: var(--nara-muted); font-size: 12px; font-weight: 600; line-height: 1.5; }

/* Closing */
.closing-section { padding: 0; }
.closing-panel { --closing-bg: var(--nara-ink); --closing-muted: var(--nara-ink-muted); --closing-line: var(--nara-ink-line); --closing-bar: var(--nara-ink-bar); --closing-grid: rgba(255, 255, 255, 0.035); --closing-glow: rgba(110, 224, 173, 0.14); --closing-shadow: 0 0 0 1px var(--closing-line), 0 40px 90px -48px rgba(8, 16, 32, 0.7); position: relative; isolation: isolate; display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr); align-items: center; gap: 64px; overflow: hidden; padding: 72px 64px; border-radius: 28px; background: var(--closing-bg); color: var(--nara-ink-fg); box-shadow: var(--closing-shadow); }
:global(.dark .closing-panel) { --closing-bg: #f1f2f0; --closing-muted: #59636b; --closing-line: rgba(43, 54, 64, 0.19); --closing-bar: #e5e8e8; --closing-grid: rgba(40, 48, 56, 0.04); --closing-glow: transparent; --closing-shadow: 0 0 0 1px rgba(235, 239, 241, 0.26), 0 35px 85px -52px rgba(0, 0, 0, 0.65); --nara-ink-accent: #37434d; background: #f1f2f0; color: #252d35; }
.closing-panel::before { content: ''; position: absolute; inset: 0; z-index: -1; background-image: linear-gradient(var(--closing-grid) 1px, transparent 1px), linear-gradient(90deg, var(--closing-grid) 1px, transparent 1px); background-size: 48px 48px; -webkit-mask-image: radial-gradient(ellipse 70% 80% at 100% 0%, #000 20%, transparent 75%); mask-image: radial-gradient(ellipse 70% 80% at 100% 0%, #000 20%, transparent 75%); pointer-events: none; }
.closing-panel::after { content: ''; position: absolute; right: -12%; bottom: -40%; z-index: -1; width: 620px; height: 620px; background: radial-gradient(closest-side, var(--closing-glow), transparent); pointer-events: none; }
.closing-copy { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; }
.closing-eyebrow { color: var(--nara-ink-accent); font-family: var(--nara-mono); font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
.closing-title { margin-top: 18px; color: #fff; font-size: clamp(2.6rem, 5.4vw, 4.4rem); font-weight: 800; line-height: 1; letter-spacing: -0.055em; }
.closing-description { max-width: 420px; margin-top: 20px; color: var(--closing-muted); font-size: 17px; line-height: 1.7; }
.closing-links { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 24px; margin-top: 36px; }
.closing-action { display: inline-flex; min-height: 52px; align-items: center; gap: 14px; padding: 0 22px; border-radius: 15px; background: var(--nara-ink-accent); color: var(--nara-ink); font-size: 14px; font-weight: 800; transition: background-color 0.15s ease, transform 0.15s ease; }
.closing-action:hover { background: #fff; transform: translateY(-1px); }
.closing-link { display: inline-flex; min-height: 44px; align-items: center; gap: 8px; color: var(--closing-muted); font-size: 14px; font-weight: 700; transition: color 0.15s ease; }
.closing-link:hover { color: #fff; }
.closing-feedback { display: block; min-height: 18px; margin-top: 12px; color: var(--closing-muted); font-size: 12.5px; }
.closing-aside { margin-top: 44px; padding-top: 17px; border-top: 1px solid var(--closing-line); color: var(--closing-muted); font-family: var(--nara-mono); font-size: 10px; line-height: 1.8; letter-spacing: 0.02em; }
.closing-workshop { min-width: 0; padding-left: clamp(30px, 4vw, 56px); border-left: 1px solid var(--closing-line); }
.closing-workshop-head, .closing-workshop-label { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-family: var(--nara-mono); font-size: 10px; font-weight: 600; line-height: 1.5; }
.closing-workshop-head { padding-bottom: 19px; color: var(--nara-ink-fg); letter-spacing: 0.1em; }
.closing-workshop-head span:last-child { color: var(--closing-muted); }
.closing-workshop-label { color: var(--nara-ink-accent); letter-spacing: 0.055em; }
.closing-workshop-label > span:last-child { color: var(--closing-muted); font-weight: 500; letter-spacing: 0; text-align: right; }
.closing-concept { padding: 23px 0 25px; border-top: 1px solid var(--closing-line); }
.closing-concept-name { display: flex; min-height: 100px; align-items: baseline; justify-content: space-between; gap: 14px; margin-top: 14px; color: #fff; font-size: clamp(2.8rem, 5.2vw, 4.9rem); font-weight: 800; line-height: 1.05; letter-spacing: -0.065em; }
.closing-concept-name > span:first-child { display: inline-block; min-width: 0; }
.closing-concept-asterisk { align-self: flex-start; margin-top: 8px; color: var(--nara-ink-accent); font-size: clamp(24px, 3vw, 36px); font-weight: 400; line-height: 1; opacity: 0.9; }
.closing-execution { padding: 21px 0 26px; border-top: 1px solid var(--closing-line); }
.closing-command { display: flex; flex-wrap: wrap; gap: 0; align-items: baseline; margin-top: 16px; color: var(--nara-ink-fg); font-family: var(--nara-mono); font-size: clamp(11px, 1.14vw, 13px); line-height: 1.9; }
.closing-command-prompt { margin-right: 13px; color: var(--nara-ink-accent); font-weight: 700; }
.closing-command > span:nth-child(2) { margin-right: 0.55ch; white-space: nowrap; }
.closing-idea { display: inline-block; color: var(--nara-ink-accent); }
.closing-command .closing-idea { border-bottom: 1px solid rgba(110, 224, 173, 0.6); }
.closing-result { padding: 21px 0 0; border-top: 1px solid var(--closing-line); }
.closing-result-status { display: inline-flex; align-items: center; gap: 8px; }
.closing-result-status > span { width: 6px; height: 6px; flex: none; border-radius: 50%; background: var(--nara-ink-accent); }
.closing-result-source { margin-top: 20px; padding: 20px 22px; border: 1px solid var(--closing-line); border-radius: 13px; background: rgba(0, 0, 0, 0.12); }
.closing-result-folder { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; color: #fff; font-family: var(--nara-mono); font-size: 12px; font-weight: 600; line-height: 1.6; overflow-wrap: anywhere; }
.closing-result-folder strong { color: var(--nara-ink-accent); font-weight: 700; }
.closing-folder-symbol { position: relative; display: inline-block; width: 18px; height: 13px; flex: none; margin-top: 4px; border: 1.5px solid var(--nara-ink-accent); border-radius: 2px; }
.closing-folder-symbol::before { content: ''; position: absolute; top: -5px; left: -1.5px; width: 9px; height: 4px; border: 1.5px solid var(--nara-ink-accent); border-bottom: none; border-radius: 2px 3px 0 0; }
.closing-result-files { display: grid; gap: 9px; margin: 18px 0 0 8px; padding-left: 21px; border-left: 1px solid var(--closing-line); }
.closing-result-files li { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 16px; color: var(--nara-ink-fg); font-family: var(--nara-mono); font-size: 11px; font-weight: 600; }
.closing-result-files li span { color: var(--closing-muted); font-family: 'Manrope', system-ui, sans-serif; font-size: 11px; font-weight: 500; }
.closing-result-note { margin-top: 14px; color: var(--closing-muted); font-size: 12px; line-height: 1.55; }
/* The panel stays paper-white; only small branded details carry green. */
:global(.dark .closing-panel :is(.closing-title, .closing-concept-name, .closing-result-folder)) { color: #222c35; }
:global(.dark .closing-panel :is(.closing-workshop-head, .closing-command, .closing-result-files li)) { color: #34414a; }
:global(.dark .closing-panel .closing-workshop-label) { color: #3a4752; }
:global(.dark .closing-panel :is(.closing-eyebrow, .closing-command-prompt, .closing-idea, .closing-concept-asterisk, .closing-result-folder strong)) { color: var(--nara-signal-on-light); }
:global(.dark .closing-panel .closing-link:hover) { color: #222c35; }
:global(.dark .closing-panel .closing-action) { background: #222c35; color: #fafaf8; }
:global(.dark .closing-panel .closing-action:hover) { background: #465460; color: #fff; }
:global(.dark .closing-panel .closing-result-source) { background: #fff; }
:global(.dark .closing-panel .closing-result-status > span) { background: var(--nara-signal-on-light); }
:global(.dark .closing-panel .closing-folder-symbol),
:global(.dark .closing-panel .closing-folder-symbol::before) { border-color: var(--nara-signal-on-light); }
:global(.dark .closing-panel .closing-command .closing-idea) { border-bottom-color: rgba(23, 109, 76, 0.45); }
/* Dark-mode micro accents come after base rules to win the scoped CSS cascade. */
:global(.dark .feature-showcase-thread),
:global(.dark .feature-anatomy-index),
:global(.dark .ecosystem-kicker) { color: var(--nara-signal); }
:global(.dark .foundation-map-live),
:global(.dark .principles-intro-rule) { background: var(--nara-signal); }
:global(.dark .foundation-map-live) { box-shadow: 0 0 0 4px var(--nara-signal-soft); }
:global(.dark .foundation-lane--passed .foundation-lane-index) { border-color: var(--nara-signal); color: var(--nara-signal); }
:global(.dark .principle-row:hover::before) { background: var(--nara-signal); }
.closing-idea-enter-active, .closing-idea-leave-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.closing-idea-enter-from { opacity: 0; transform: translateY(4px); }
.closing-idea-leave-to { opacity: 0; transform: translateY(-4px); }

@media (hover: hover) {
  .hero-docs:hover span, .closing-link:hover span { transform: translate(2px, -1px); }
  .hero-docs span, .closing-link span { transition: transform 0.15s ease; }
}


/* Footer */
.site-footer { margin-top: var(--lp-section-gap); border-top: 1px solid var(--nara-line); }
.footer-inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; padding-block: 28px; }
.footer-brand { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.footer-brand img { width: 28px; height: 28px; border-radius: 8px; }
.footer-brand .landing-display { font-size: 15px; font-weight: 800; letter-spacing: -0.03em; }
.footer-tagline { color: var(--nara-muted); font-size: 13px; }
.footer-links { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 22px; color: var(--nara-muted); font-size: 13px; font-weight: 600; }
.footer-links a { transition: color 0.15s ease; }
.footer-links a:hover { color: var(--nara-fg); }

/* Responsive */
@media (max-width: 1080px) {
  .hero-review-main { grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.9fr); }
  .hero-review-diagnostic { padding-inline: 20px; }
  .hero-review-code { font-size: 11px; }
  .workflow-experience { grid-template-columns: minmax(170px, 0.29fr) minmax(0, 1fr); gap: 28px; }
  .workflow-canvas { padding-inline: 18px; }
  .wf-relations { gap: 16px; }
  .wf-relation { padding-inline: 10px; }
  .wf-relation-line { left: -14px; }
  .foundation-story { grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 42px; }
  .foundation-visual { height: min(620px, calc(100vh - 124px)); min-height: 520px; }
  .foundation-step-title { font-size: clamp(1.8rem, 3.7vw, 2.7rem); }
  .closing-panel { grid-template-columns: 1fr; gap: 48px; padding: 56px 48px; }
  .closing-workshop { padding: 26px 0 0; border-top: 1px solid var(--closing-line); border-left: 0; }
  .closing-concept-name { min-height: 0; }
  .principles-manifesto { grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr); gap: 44px; }
  .principles-manifesto-title { font-size: clamp(2.6rem, 5vw, 3.6rem); }
  .principles-ecosystem { grid-template-columns: 1fr; gap: 42px; }
  .ecosystem-intro { padding-top: 0; }
  .ecosystem-description { max-width: 530px; }
  .ecosystem-signoff { margin-top: 22px; }
}
@media (max-width: 900px) {
  .hero-review-main { grid-template-columns: minmax(0, 1fr); }
  .hero-review-editor { border-right: 0; border-bottom: 1px solid var(--nara-ink-line); }
  .hero-review-code { min-height: 255px; }
  .hero-review-diagnostic { min-height: 295px; padding: 22px 28px; }
  .hero-review-diagnostic-body { padding-top: 18px; }
  .hero-review-state { margin-top: 16px; }
  .hero-review-evidence { margin-top: 16px; }
  .hero-review-diagnostic-foot { padding-top: 15px; }
  .hero { padding-top: 168px; }
  .proof-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .section { scroll-margin-top: 136px; }
  .section-head { grid-template-columns: 1fr; margin-bottom: 40px; }
  .feature-story-body { grid-template-columns: 1fr; }
  .feature-showcase { min-height: 560px; }
  .feature-anatomy { padding: 44px 42px; }
  .feature-anatomy-list li { padding-block: 20px; }
  .feature-anatomy-home { margin-top: 6px; }
  .feature-story-bottom { grid-template-columns: 1fr 1fr; }
  .feature-story-bottom-lead { grid-column: 1 / -1; max-width: none; padding: 22px 30px; border-bottom: 1px solid var(--nara-line); }
  .feature-access:first-of-type { border-left: 0; }
  .principles-manifesto { grid-template-columns: 1fr; gap: 48px; }
  .principles-intro { position: static; padding-top: 0; }
  .principles-manifesto-title { max-width: 610px; font-size: clamp(2.9rem, 6vw, 4.4rem); }
  .principles-intro-foot { margin-top: 28px; }
  .principle-title { max-width: 620px; }
  .principle-copy { max-width: 620px; }
}
@media (max-width: 760px) {
  .workflow-experience { grid-template-columns: minmax(0, 1fr); gap: 27px; }
  .workflow-navigation-meta { margin-bottom: 12px; }
  .workflow-stages { flex-direction: row; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity; }
  .workflow-stages::-webkit-scrollbar { display: none; }
  .stage-tab { width: auto; min-width: 144px; flex: 1 0 auto; gap: 9px; padding: 15px 15px 16px 0; scroll-snap-align: start; }
  .stage-name { font-size: 16px; }
  .stage-hint { font-size: 9.5px; }
  .stage-tab-arrow { display: none; }
  .workflow-navigation-note { display: none; }
  .workflow-stage-head { min-height: 0; padding-bottom: 25px; }
  .stage-title { font-size: clamp(2rem, 5vw, 2.6rem); }
  .workflow-canvas { min-height: 380px; }
  .foundation-story { display: block; }
  .foundation-visual { position: sticky; top: 96px; z-index: 5; height: 48vh; min-height: 370px; max-height: 460px; margin-bottom: 22px; }
  .foundation-narrative { position: relative; z-index: 1; }
  .foundation-step { min-height: 64vh; padding: 72px 0 56px; }
  .foundation-scene { padding: 14px 14px 16px; border-radius: 20px; }
  .foundation-map-meta { padding-bottom: 12px; font-size: 9px; }
  .foundation-request { margin-top: 12px; padding: 7px 10px 7px 7px; font-size: 10.5px; }
  .foundation-request-method { font-size: 9.5px; }
  .foundation-lanes { margin-top: 6px; }
  .foundation-lane { grid-template-columns: 26px minmax(0, 1fr); gap: 10px; }
  .foundation-lane::before { left: 12.5px; }
  .foundation-lane-index { width: 26px; height: 26px; font-size: 9.5px; }
  .foundation-lane--active .foundation-lane-index { box-shadow: 0 0 0 4px var(--nara-accent-soft); }
  .foundation-lane-body { padding: 7px 12px; border-radius: 12px; }
  .foundation-lane-body small { font-size: 9px; }
  .foundation-lane-body strong { margin-top: 3px; font-size: 1rem; }
  .foundation-lane--active .foundation-lane-chips { padding-top: 8px; }
  .foundation-lane-chips { gap: 5px; }
  .foundation-lane-chips li { padding: 3px 6px; font-size: 9.5px; }
  .foundation-map-caption { margin-top: 10px; padding-top: 10px; font-size: 11.5px; }
}
@media (max-width: 640px) {
  .landing-page { --lp-section-gap: clamp(58px, 11vw, 72px); }
  .workflow-experience { padding-top: 17px; }
  .stage-tab { min-width: 133px; padding-top: 14px; padding-bottom: 15px; }
  .workflow-stage-head { padding-bottom: 23px; }
  .stage-title { margin-top: 12px; font-size: clamp(1.85rem, 7.2vw, 2.3rem); }
  .stage-copy { font-size: 13px; }
  .workflow-canvas { min-height: 330px; padding: 16px 15px 14px; }
  .workflow-canvas-top, .workflow-canvas-bottom { font-size: 8px; }
  .wf-compose { grid-template-columns: 1fr; gap: 13px; padding: 18px 0; }
  .wf-tree-line { min-height: 23px; padding-block: 2px; }
  .wf-tree-line--feature { margin-left: 34px; }
  .wf-tree-line--file { padding-left: 64px; }
  .wf-compose-side { display: none; }
  .wf-own { padding-block: 18px; }
  .wf-own-diagram { grid-template-columns: minmax(0, 1fr) 35px minmax(0, 1fr); gap: 4px; margin-top: 20px; }
  .wf-own-node { min-height: 140px; padding: 12px 10px; }
  .wf-own-node > span { font-size: 8px; }
  .wf-own-node strong { font-size: 19px; }
  .wf-own-node small { font-size: 9px; }
  .wf-own-connector { font-size: 15px; }
  .wf-own-footer { margin-top: 19px; }
  .wf-understand { padding-block: 18px; }
  .wf-relations { grid-template-columns: 1fr; gap: 14px; margin-top: 18px; }
  .wf-relations-branches { display: none; }
  .wf-relation { min-height: 65px; padding: 10px 14px; }
  .wf-relation strong { margin-top: 4px; font-size: 19px; }
  .wf-relation small { margin-top: 2px; }
  .wf-relation-line { display: none; }
  .wf-understand-caption { margin-top: 16px; }
  .wf-evolve-columns { gap: 6px; }
  .wf-evolve-labels { gap: 6px; }
  .wf-evolve-version { padding: 11px 8px; }
  .wf-evolve-version strong { font-size: 10.5px; }
  .wf-evolve-version small { font-size: 9px; }
  .wf-protect { grid-template-columns: 1fr 1fr; gap: 15px; }
  .wf-protect-verdict > strong { font-size: clamp(27px, 6.5vw, 36px); }
  .wf-protect-facts > div { padding: 10px 0; }
  .lp-container { padding-inline: 20px; }
  .hero { padding: 156px 0 0; }
  .hero-description { font-size: 16px; }
  .hero-actions { flex-direction: column; align-items: stretch; }
  .hero-command { width: 100%; padding-left: 16px; font-size: 12px; }
  .hero-docs { justify-content: center; }
  .hero-window { margin-top: 48px; border-radius: 14px; }
  .hero-review-top-label { font-size: 8px; }
  .hero-review-main { min-height: 0; }
  .hero-review-code { min-height: 0; padding: 14px 0 16px; font-size: 10.5px; }
  .hero-review-code .code-line { display: grid; grid-template-columns: 26px 12px minmax(0, 1fr); width: 100%; min-width: 0; min-height: 2.1em; padding-right: 12px; }
  .hero-review-code .code-line code { white-space: pre-wrap; overflow-wrap: anywhere; }
  .hero-review-code .code-line:nth-child(n + 8) { display: none; }
  .hero-review-editor-caption { padding: 11px 12px; font-size: 8px; }
  .hero-review-diagnostic { min-height: 260px; padding: 18px; }
  .hero-review-diagnostic-body { padding-top: 12px; }
  .hero-review-symbol { width: 30px; height: 30px; font-size: 15px; }
  .hero-review-state { margin-top: 12px; }
  .hero-review-heading { font-size: 23px; }
  .hero-review-explanation { margin-top: 9px; font-size: 11px; }
  .hero-review-evidence { margin-top: 13px; padding-top: 10px; }
  .hero-review-footer { flex-wrap: wrap; justify-content: center; gap: 8px; padding: 11px 12px; }
  .hero-review-footer-label, .hero-review-footer-note { display: none; }
  .hero-review-steps { width: 100%; }
  .hero-review-steps button { min-width: 0; flex: 1; padding-inline: 6px; }
  .proof-grid { grid-template-columns: 1fr; gap: 20px; }
  .closing-panel { gap: 32px; padding: 40px 22px; border-radius: 22px; }
  .closing-description { font-size: 15px; }
  .closing-aside { margin-top: 22px; }
  .closing-workshop { padding-top: 22px; }
  .closing-concept { padding: 20px 0 22px; }
  .closing-concept-name { margin-top: 18px; font-size: clamp(2.65rem, 10vw, 4.5rem); }
  .closing-execution { padding: 20px 0 22px; }
  .closing-command { font-size: 11px; }
  .closing-result-source { padding: 16px 14px; }
  .closing-result-files li span { font-size: 10px; }
  .feature-story-topline { padding: 12px 18px; font-size: 9px; }
  .feature-story-topline span:last-child { max-width: 170px; text-align: right; }
  .feature-showcase { min-height: 550px; padding: 24px 22px 30px; }
  .feature-receipt { width: min(100%, 345px); }
  .feature-receipt-head { padding: 18px 20px; }
  .feature-receipt-details { padding: 25px 20px 16px; }
  .feature-receipt-paid { padding-inline: 20px; }
  .feature-anatomy { padding: 33px 24px; }
  .feature-anatomy-heading h3 { font-size: 1.8rem; }
  .feature-anatomy-list { margin-top: 24px; }
  .feature-anatomy-list li { grid-template-columns: 24px minmax(0, 1fr); gap: 12px; }
  .feature-anatomy-side { display: none; }
  .feature-story-bottom { grid-template-columns: 1fr; }
  .feature-story-bottom-lead { padding: 22px 24px; font-size: 19px; }
  .feature-access { padding: 19px 24px; border-left: 0; border-bottom: 1px solid var(--nara-line); }
  .feature-access:last-child { border-bottom: 0; }
  .feature-access div { flex: 1; }
  .feature-access code { font-size: 10px; }
  .foundation-section { padding-bottom: 0; }
  .foundation-step-title { font-size: 2rem; }
  .foundation-step-copy { font-size: 14px; }
  .foundation-step-facts { grid-template-columns: 1fr 1fr; }
  .principles-manifesto { gap: 38px; }
  .principles-manifesto-title { margin-top: 22px; font-size: clamp(2.55rem, 10vw, 3.45rem); }
  .principles-manifesto-copy { margin-top: 17px; font-size: 14px; }
  .principles-intro-foot { margin-top: 28px; }
  .principle-row { padding: 28px 0 32px; }
  .principle-title { margin-top: 17px; font-size: clamp(1.9rem, 8vw, 2.4rem); }
  .principle-copy { font-size: 13.5px; }
  .principle-details { grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
  .principle-detail-label { margin-bottom: 6px; }
  .principles-ecosystem { margin-top: 56px; padding-top: 28px; gap: 34px; }
  .ecosystem-title { margin-top: 19px; font-size: clamp(2.05rem, 8vw, 2.75rem); }
  .ecosystem-description { margin-top: 17px; font-size: 14px; }
  .ecosystem-signoff { margin-top: 22px; }
  .ecosystem-logos { column-gap: 18px; }
  .ecosystem-logo-entry { min-height: 112px; flex-direction: column; align-items: flex-start; justify-content: center; gap: 9px; }
  .ecosystem-logo-mark { flex: none; min-height: 30px; }
  .ecosystem-logo-mark img { width: 31px; height: 31px; }
  .ecosystem-logo-entry--zod .ecosystem-logo-mark img { width: 43px; height: 43px; }
  .ecosystem-logo-mark img:not(:only-child) { width: 22px; height: 22px; }
  .ecosystem-logo-text strong { font-size: 13px; }
  .ecosystem-logo-text small { font-size: 9.5px; }
  .ecosystem-footnotes { grid-template-columns: 1fr; gap: 14px; margin-top: 0; padding-top: 22px; }
  .ecosystem-footnotes > div { gap: 18px; }
}
@media (max-width: 380px) {
  .closing-concept-asterisk { font-size: 21px; }
  .closing-concept-name { font-size: 2.45rem; }
  .closing-result-folder { font-size: 10.5px; }
}

@media (prefers-reduced-motion: reduce) {
  :global(html:has(.landing-page)) { scroll-behavior: auto; }
  .landing-page *, .landing-page *::before, .landing-page *::after { animation: none !important; transition-duration: 0.01ms !important; }
}
</style>
