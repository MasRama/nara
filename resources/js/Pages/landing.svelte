<!-- landing.svelte -->
<script lang="ts">
  import { inertia, page } from '@inertiajs/svelte'
  import { fly } from 'svelte/transition'
  import DarkModeToggle from '../Components/DarkModeToggle.svelte'

  interface Highlight {
    title: string;
    description: string;
  }

  interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    is_admin: boolean;
    is_verified: boolean;
  }

  let highlights: Highlight[] = [
    {
      title: 'Blazing fast by default',
      description: 'HyperExpress + SQLite tuned for real-world throughput, not benchmarks di README saja.'
    },
    {
      title: 'Svelte-first DX',
      description: 'Inertia + Svelte 5 untuk flow single-page tanpa ribet routing di frontend.'
    },
    {
      title: 'AI-native workflow',
      description: 'Struktur project dirancang supaya enak di-drive pakai AI coding assistant.'
    }
  ]

  let user = $page.props.user as User | undefined
</script>

<header class="fixed inset-x-0 top-0 z-40 border-b border-gray-200 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
  <div class="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
    <a href="/" use:inertia class="flex items-center gap-2">
	  <img src="/public/nara.png" alt="Nara logo" class="h-7 w-7 rounded-lg object-cover" />
      <div class="flex flex-col leading-tight">
        <span class="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">Nara</span>
        <span class="text-[10px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500">TypeScript framework</span>
      </div>
    </a>

    <div class="flex items-center gap-3 text-xs font-medium">
      <DarkModeToggle />
      <a
        href="https://github.com/MasRama/nara#readme"
        target="_blank"
        class="hidden sm:inline-flex items-center rounded-full px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-gray-100 dark:hover:bg-slate-900/70 transition-colors"
      >
        Docs
      </a>
      <a
        href="https://github.com/MasRama/nara"
        target="_blank"
        class="hidden sm:inline-flex items-center rounded-full px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-gray-100 dark:hover:bg-slate-900/70 transition-colors"
      >
        GitHub
      </a>
      {#if user && user.id}
        <a
          href="/dashboard"
          use:inertia
          class="inline-flex items-center rounded-full px-3.5 py-1.5 text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors"
        >
          Dashboard
        </a>
      {:else}
        <a
          href="/login"
          use:inertia
          class="inline-flex items-center rounded-full px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-gray-100 dark:hover:bg-slate-900/70 transition-colors"
        >
          Masuk
        </a>
        <a
          href="/register"
          use:inertia
          class="inline-flex items-center rounded-full px-3.5 py-1.5 text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors"
        >
          Mulai gratis
        </a>
      {/if}
    </div>
  </div>
</header>

<!-- Hero Section: NARA IMPROVED -->
<section class="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-50">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
    <div class="grid gap-12 lg:grid-cols-[3fr,2fr] items-center">
      <!-- Copy -->
      <div in:fly={{ x: -20, duration: 600 }}>
        <p class="text-xs tracking-[0.35em] uppercase text-slate-500 dark:text-slate-400 mb-4">
          NARA · IMPROVED
        </p>
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.25] mb-6">
          Ship real products
          <span
            class="block relative -top-[1px] text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 pb-[2px]"
            style="text-shadow: 0 1px 0 rgba(45,212,191,0.9)"
          >
            at the speed of thought.
          </span>
        </h1>
        <p class="text-base sm:text-lg text-slate-600 dark:text-slate-300/90 max-w-xl mb-8">
          Nara adalah kerangka kerja TypeScript opiniated untuk kamu yang ingin fokus ke fitur,
          bukan konfigurasi. Satu stack rapi: HyperExpress, Svelte, Inertia, dan SQLite yang sudah
          disetel kencang.
        </p>

        <div class="flex flex-wrap items-center gap-4 mb-6">
          <a
            href="/register"
            use:inertia
            class="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors"
          >
            Start with Nara
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-900/70 text-[10px] text-emerald-600 dark:text-emerald-300">
              ●
            </span>
          </a>
        </div>

        <div class="flex flex-wrap gap-6 text-xs text-slate-500 dark:text-slate-400">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-1.5 w-8 rounded-full bg-emerald-400/80"></span>
            <span>~258k req/s benchmarked</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-flex h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500"></span>
            <span>Type-safe from controller to Svelte</span>
          </div>
        </div>
      </div>

      <!-- Visual Card -->
      <div class="relative" in:fly={{ x: 20, duration: 600, delay: 80 }}>
        <div class="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/10 to-transparent blur-2xl"></div>
        <div class="relative rounded-3xl border border-gray-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/70 backdrop-blur-xl p-6 sm:p-7 shadow-xl dark:shadow-[0_24px_80px_rgba(15,23,42,0.8)]">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-medium tracking-[0.18em] uppercase text-slate-500 dark:text-slate-500">NARA SNAPSHOT</span>
            <span class="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 px-3 py-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-200">
              ● Ready to ship
            </span>
          </div>

          <div class="space-y-4 text-xs text-slate-700 dark:text-slate-200/90">
            <div class="flex items-center justify-between rounded-2xl bg-gray-50 dark:bg-slate-900/80 px-4 py-3 border border-gray-200 dark:border-slate-800">
              <div>
                <p class="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Stack</p>
                <p class="text-sm font-medium">HyperExpress · Svelte · Inertia · SQLite</p>
              </div>
              <span class="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] text-emerald-600 dark:text-emerald-300">typed</span>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div class="rounded-2xl bg-gray-50 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-800 px-3 py-3">
                <p class="text-[11px] text-slate-500 mb-1">Requests</p>
                <p class="text-sm font-semibold text-slate-900 dark:text-slate-50">258k/s</p>
              </div>
              <div class="rounded-2xl bg-gray-50 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-800 px-3 py-3">
                <p class="text-[11px] text-slate-500 mb-1">Latency</p>
                <p class="text-sm font-semibold text-slate-900 dark:text-slate-50">1.52 ms</p>
              </div>
              <div class="rounded-2xl bg-gray-50 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-800 px-3 py-3">
                <p class="text-[11px] text-slate-500 mb-1">Boot</p>
                <p class="text-sm font-semibold text-slate-900 dark:text-slate-50">1 cmd</p>
              </div>
            </div>

            <div class="rounded-2xl bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 border border-gray-200 dark:border-slate-800 px-4 py-3">
              <p class="mb-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">Quickstart</p>
              <pre class="text-[11px] leading-relaxed text-slate-700 dark:text-slate-200 overflow-x-auto"><code>git clone https://github.com/MasRama/nara.git
cd nara
npm install
npm run dev</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Subtle Highlights Section -->
<section class="border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="grid gap-6 md:grid-cols-3">
      {#each highlights as item}
        <div class="space-y-2">
          <p class="text-[11px] tracking-[0.22em] uppercase text-slate-500">{item.title}</p>
          <p class="text-sm text-slate-600 dark:text-slate-300/90 leading-relaxed">{item.description}</p>
        </div>
      {/each}
    </div>
  </div>
</section>
