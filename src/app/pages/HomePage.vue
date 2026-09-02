<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

const cloneCommand = 'git clone https://github.com/MasRama/nara.git';
const currentYear = new Date().getFullYear();
const isDark = ref(false);
const copied = ref(false);
const scrolled = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | undefined;

const themeLabel = computed(() => (isDark.value ? 'Light mode' : 'Dark mode'));

function applyTheme(dark: boolean): void {
  isDark.value = dark;
  document.documentElement.classList.toggle('dark', dark);
  window.localStorage.setItem('nara-theme', dark ? 'dark' : 'light');
}

function toggleTheme(): void {
  applyTheme(!isDark.value);
}

function updateScrollState(): void {
  scrolled.value = window.scrollY > 40;
}

async function copyCommand(): Promise<void> {
  await navigator.clipboard.writeText(cloneCommand);
  copied.value = true;
  if (copyTimer) {
    clearTimeout(copyTimer);
  }
  copyTimer = setTimeout(() => {
    copied.value = false;
  }, 2000);
}

onMounted(() => {
  const savedTheme = window.localStorage.getItem('nara-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme ? savedTheme === 'dark' : prefersDark);
  updateScrollState();
  window.addEventListener('scroll', updateScrollState, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateScrollState);
  if (copyTimer) {
    clearTimeout(copyTimer);
  }
});
</script>

<template>
  <div class="min-h-[100dvh] overflow-x-hidden bg-background font-body text-foreground antialiased selection:bg-primary/20 selection:text-primary">
    <nav
      class="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between px-6 transition-all duration-500 sm:px-10 lg:px-16"
      :class="scrolled ? 'border-b border-border bg-background/85 backdrop-blur-md' : 'border-b border-transparent bg-transparent'"
    >
      <RouterLink to="/" class="group flex items-center gap-2">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-primary transition-transform duration-300 group-hover:scale-125"></span>
        <span class="font-heading text-lg font-semibold tracking-tight">Nara</span>
      </RouterLink>

      <div class="flex items-center gap-5 text-sm">
        <a
          href="https://github.com/MasRama/nara"
          target="_blank"
          rel="noreferrer"
          class="hidden items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
        >
          <span aria-hidden="true" class="font-mono-accent text-xs">&lt;/&gt;</span>
          Source
        </a>
        <RouterLink to="/login" class="text-muted-foreground transition-colors hover:text-foreground">Sign in</RouterLink>
        <span class="h-4 w-px bg-border"></span>
        <button
          type="button"
          class="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          :aria-label="themeLabel"
          @click="toggleTheme"
        >
          {{ themeLabel }}
        </button>
      </div>
    </nav>

    <header class="relative flex min-h-[100dvh] items-end overflow-hidden px-6 pb-12 pt-24 sm:px-10 lg:px-16">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1px)] text-foreground opacity-[0.04] [background-size:22px_22px] dark:opacity-[0.06]"></div>

      <div class="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-end gap-10 lg:grid-cols-12 lg:gap-8">
        <div class="flex flex-col gap-8 lg:col-span-7">
          <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">A foundation for building with AI</p>

          <h1 class="font-heading text-[clamp(2.75rem,8vw,6.5rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-foreground">
            The craft of<br />
            building with<br />
            <span class="pb-1 font-medium italic leading-[1.05] text-primary">machines.</span>
          </h1>

          <p class="max-w-[52ch] text-lg leading-relaxed text-muted-foreground sm:text-xl">
            A quiet foundation for people who build software by talking to machines. No boilerplate. No noise. Just the work.
          </p>

          <div class="flex flex-wrap items-center gap-5 pt-2">
            <a href="/register" class="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 font-heading text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              Begin
              <span aria-hidden="true">→</span>
            </a>
            <a
              href="https://github.com/MasRama/nara"
              target="_blank"
              rel="noreferrer"
              class="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              View source
              <span aria-hidden="true" class="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
            </a>
          </div>
        </div>

        <div class="relative lg:col-span-5">
          <div class="relative ml-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-sm bg-muted">
            <img
              src="/landing/hero.webp"
              alt="A quiet workspace, morning light"
              loading="eager"
              class="h-full w-full object-cover grayscale contrast-105 brightness-95 transition-transform duration-[1.2s] hover:scale-[1.03]"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
            <p class="absolute bottom-4 left-4 right-4 font-heading text-[11px] uppercase tracking-[0.2em] text-white/80">No. 01 &nbsp;/&nbsp; The morning ritual</p>
          </div>
        </div>
      </div>
    </header>

    <section class="border-t border-border px-6 py-32 sm:px-10 sm:py-40 lg:px-16">
      <div class="mx-auto max-w-[1100px]">
        <p class="font-heading text-[clamp(1.75rem,4.5vw,3.25rem)] font-medium leading-[1.15] tracking-[-0.02em] text-foreground">
          Most starter kits fight the machine. Layers of abstraction it cannot read. Classes it has to guess. Magic it cannot trace.
          <span class="text-muted-foreground"> Nara is the opposite. Flat. Plain. Readable. The machine understands it on the first look, and so do you.</span>
        </p>
      </div>
    </section>

    <section class="px-6 py-24 sm:px-10 sm:py-32 lg:px-16">
      <div class="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div class="relative order-1 aspect-[5/6] overflow-hidden rounded-sm bg-muted">
          <img src="/landing/idea.webp" alt="A plan sketched on paper" loading="lazy" class="h-full w-full object-cover grayscale contrast-105 brightness-95" />
        </div>

        <div class="order-2 flex max-w-[44ch] flex-col gap-6">
          <h2 class="font-heading text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-foreground">One prompt,<br />a whole feature.</h2>
          <p class="text-lg leading-relaxed text-muted-foreground">Describe what you want. The machine reads the conventions, loads the right skill, writes every file, verifies its own work. You review the diff. You ship.</p>

          <div class="mt-2 overflow-hidden rounded-lg border border-border bg-card/40 font-mono-accent text-xs leading-relaxed">
            <div class="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
              <span class="h-2 w-2 rounded-full bg-red-400/50"></span>
              <span class="h-2 w-2 rounded-full bg-yellow-400/50"></span>
              <span class="h-2 w-2 rounded-full bg-green-400/50"></span>
              <span class="ml-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/60">agent session</span>
            </div>
            <div class="space-y-2.5 p-4">
              <p class="text-foreground"><span class="text-primary">$</span> add a products feature. fields: name, price, description.</p>
              <p class="text-[11px] text-muted-foreground/60">reads AGENTS.md · loads skill: crud-pattern.md · writes 7 files</p>
              <div class="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground"><span>types</span><span>migration</span><span>queries</span><span>validator</span><span>handlers</span><span>routes</span><span>page</span></div>
              <p class="border-t border-border/50 pt-1 text-[11px] text-muted-foreground/60"><span class="text-green-500/70">✓</span> lint · 17 layer rules · tests — all passed</p>
            </div>
          </div>

          <button
            type="button"
            class="group inline-flex w-fit cursor-pointer items-center gap-3 rounded-full border border-border bg-card/50 px-5 py-3 transition-all duration-300 hover:border-primary/40 hover:bg-muted/50"
            aria-label="Copy clone command"
            @click="copyCommand"
          >
            <span class="font-mono-accent text-xs text-muted-foreground transition-colors group-hover:text-foreground">{{ copied ? 'copied' : cloneCommand }}</span>
            <span class="font-mono-accent text-[10px] uppercase tracking-widest text-primary">clone</span>
          </button>
        </div>
      </div>
    </section>

    <section class="border-t border-border px-6 py-24 sm:px-10 sm:py-32 lg:px-16">
      <div class="mx-auto max-w-[1400px]">
        <div class="mb-14 max-w-[60ch]">
          <h2 class="font-heading text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-foreground">Five quiet principles.</h2>
          <p class="mt-4 leading-relaxed text-muted-foreground">Each one removes a reason for the machine to guess.</p>
        </div>

        <div class="grid auto-rows-[minmax(220px,auto)] grid-cols-1 gap-4 md:grid-cols-6">
          <article class="group relative overflow-hidden rounded-sm bg-muted md:col-span-3 md:row-span-2">
            <img src="/landing/principle.webp" alt="Flat, open layout" loading="lazy" class="absolute inset-0 h-full w-full object-cover grayscale contrast-105 brightness-90 transition-transform duration-700 group-hover:scale-105" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
            <div class="relative z-10 flex h-full flex-col justify-end p-7">
              <span class="mb-3 font-heading text-[11px] uppercase tracking-[0.25em] text-white/60">01</span>
              <h3 class="font-heading text-2xl font-semibold leading-tight tracking-tight text-white">Flat, by design.</h3>
              <p class="mt-2 max-w-[34ch] text-sm leading-relaxed text-white/70">Files at arm's reach. No deep nesting to navigate. The machine finds things by name, and so do you.</p>
            </div>
          </article>

          <article class="flex flex-col justify-center rounded-sm border border-border bg-card p-7 md:col-span-3">
            <span class="mb-3 font-heading text-[11px] uppercase tracking-[0.25em] text-primary">02</span>
            <h3 class="font-heading text-xl font-semibold tracking-tight text-foreground">Functions, not classes.</h3>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">Standalone functions the machine writes accurately. No inheritance to hallucinate, no hidden state to chase.</p>
          </article>

          <article class="flex flex-col justify-center rounded-sm border border-border bg-card p-7 md:col-span-3">
            <span class="mb-3 font-heading text-[11px] uppercase tracking-[0.25em] text-primary">03</span>
            <h3 class="font-heading text-xl font-semibold tracking-tight text-foreground">Raw SQL, not magic.</h3>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">Every query explicit, readable, predictable. The machine writes SQL fluently. No query builder syntax to invent.</p>
          </article>

          <article class="flex flex-col justify-center rounded-sm bg-primary p-7 md:col-span-2">
            <span class="mb-3 font-heading text-[11px] uppercase tracking-[0.25em] text-primary-foreground/60">04</span>
            <h3 class="font-heading text-xl font-semibold tracking-tight text-primary-foreground">No hidden behavior.</h3>
            <p class="mt-2 text-sm leading-relaxed text-primary-foreground/80">Traceable end to end. No decorators, no implicit middleware.</p>
          </article>

          <article class="flex flex-col justify-center rounded-sm border border-border bg-card p-7 md:col-span-2">
            <span class="mb-3 font-heading text-[11px] uppercase tracking-[0.25em] text-primary">05</span>
            <h3 class="font-heading text-xl font-semibold tracking-tight text-foreground">Few dependencies.</h3>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">Fewer APIs to learn. Fewer mistakes to make. Each one earns its place.</p>
          </article>

          <article class="flex flex-col justify-center rounded-sm bg-foreground p-7 text-background md:col-span-2">
            <p class="font-heading text-lg font-medium leading-snug tracking-tight">&quot;The pattern is the generator.&quot;</p>
            <p class="mt-3 text-xs uppercase tracking-widest text-background/60">The result</p>
          </article>
        </div>
      </div>
    </section>

    <section class="relative h-[60vh] min-h-[420px] overflow-hidden">
      <img src="/landing/band.webp" alt="Hands at work, soft light" loading="lazy" class="absolute inset-0 h-full w-full object-cover grayscale contrast-110 brightness-90" />
      <div class="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent"></div>
      <div class="relative z-10 mx-auto flex h-full max-w-[1400px] flex-col justify-center px-6 sm:px-10 lg:px-16">
        <p class="max-w-[20ch] font-heading text-[clamp(1.5rem,3.5vw,2.5rem)] font-medium leading-[1.1] tracking-[-0.02em] text-white">Built to be read by a machine and a human, equally.</p>
      </div>
    </section>

    <section class="px-6 py-32 sm:px-10 sm:py-44 lg:px-16">
      <div class="mx-auto flex max-w-[800px] flex-col items-center gap-7 text-center">
        <h2 class="font-heading text-[clamp(2.5rem,7vw,5rem)] font-semibold leading-none tracking-[-0.03em] text-foreground">Begin <span class="font-medium italic text-primary">quietly.</span></h2>
        <p class="max-w-[48ch] text-lg leading-relaxed text-muted-foreground">Clone the repository. Open one file. Ask the machine for a feature. Watch it appear.</p>
        <div class="flex flex-wrap items-center justify-center gap-5 pt-2">
          <a href="/register" class="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 font-heading text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
            Begin
            <span aria-hidden="true">→</span>
          </a>
          <a href="https://github.com/MasRama/nara" target="_blank" rel="noreferrer" class="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            View source
            <span aria-hidden="true" class="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
          </a>
        </div>
      </div>
    </section>

    <footer class="border-t border-border">
      <div class="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center sm:px-10 lg:px-16">
        <div class="flex items-center gap-2">
          <span class="inline-block h-2 w-2 rounded-full bg-primary"></span>
          <span class="font-heading font-semibold tracking-tight">Nara</span>
          <span class="ml-3 text-xs text-muted-foreground">A foundation for building with AI</span>
        </div>
        <div class="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="https://github.com/MasRama/nara" target="_blank" rel="noreferrer" class="transition-colors hover:text-foreground">GitHub</a>
          <a href="https://github.com/MasRama/nara#readme" target="_blank" rel="noreferrer" class="transition-colors hover:text-foreground">Docs</a>
          <span class="text-xs">&copy; {{ currentYear }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
</style>
