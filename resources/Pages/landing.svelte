<script lang="ts">
  import { inertia, page } from '@inertiajs/svelte'
  import { fly, fade } from 'svelte/transition'
  import DarkModeToggle from '../Components/DarkModeToggle.svelte'
  import Button from '../Components/Button.svelte'
  import { ArrowUpRight, ArrowRight, Code } from '@lucide/svelte'

  interface User {
    id: string;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
  }

  let user = page.props.user as User | undefined
  let scrollY = $state(0)
  let copied = $state(false)
  let scrolled = $derived(scrollY > 40)

  const CLONE_CMD = 'git clone https://github.com/MasRama/nara.git'

  function copyCommand() {
    navigator.clipboard.writeText(CLONE_CMD)
    copied = true
    setTimeout(() => (copied = false), 2000)
  }
</script>

<svelte:window bind:scrollY />

<div class="min-h-[100dvh] bg-background text-foreground font-body antialiased selection:bg-primary/20 selection:text-primary overflow-x-hidden">

  <!-- ───────────────────────── NAV ───────────────────────── -->
  <nav
    class="fixed top-0 inset-x-0 z-50 flex items-center justify-between h-16 px-6 sm:px-10 lg:px-16 transition-all duration-500 {scrolled
      ? 'bg-background/85 backdrop-blur-md border-b border-border'
      : 'bg-transparent border-b border-transparent'}"
  >
    <a href="/" use:inertia class="flex items-center gap-2 group">
      <span class="inline-block w-2.5 h-2.5 rounded-full bg-primary transition-transform duration-300 group-hover:scale-125"></span>
      <span class="font-heading font-semibold tracking-tight text-lg">Nara</span>
    </a>

    <div class="flex items-center gap-5 text-sm">
      <a href="https://github.com/MasRama/nara" target="_blank" rel="noreferrer" class="hidden sm:inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
        <Code class="w-4 h-4" /> Source
      </a>
      {#if user}
        <a href="/dashboard" use:inertia class="text-muted-foreground hover:text-foreground transition-colors">Dashboard</a>
      {:else}
        <a href="/login" use:inertia class="text-muted-foreground hover:text-foreground transition-colors">Sign in</a>
      {/if}
      <span class="w-px h-4 bg-border"></span>
      <DarkModeToggle />
    </div>
  </nav>

  <!-- ───────────────────────── HERO (asymmetric split) ───────────────────────── -->
  <header class="relative min-h-[100dvh] flex items-end pt-24 pb-12 px-6 sm:px-10 lg:px-16 overflow-hidden">
    <!-- faint paper grain -->
    <div class="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-foreground"></div>

    <div class="relative z-10 w-full max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-end">
      <!-- left: editorial type -->
      <div class="lg:col-span-7 flex flex-col gap-8">
        <p in:fade={{ duration: 700 }} class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
          A foundation for building with AI
        </p>

        <h1
          in:fly={{ y: 24, duration: 900, delay: 120 }}
          class="font-heading font-semibold tracking-[-0.03em] leading-[0.98] text-[clamp(2.75rem,8vw,6.5rem)] text-foreground"
        >
          The craft of<br />
          building with<br />
          <span class="italic font-medium text-primary leading-[1.05] pb-1">machines.</span>
        </h1>

        <p in:fly={{ y: 20, duration: 900, delay: 260 }} class="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-[52ch]">
          A quiet foundation for people who build software by talking to machines. No boilerplate. No noise. Just the work.
        </p>

        <div in:fly={{ y: 18, duration: 900, delay: 400 }} class="flex flex-wrap items-center gap-5 pt-2">
          {#if user}
            <a href="/dashboard" use:inertia>
              <Button size="lg" class="rounded-full px-7 h-12 text-sm normal-case tracking-normal font-heading font-medium">
                Go to dashboard
                <ArrowRight class="w-4 h-4" />
              </Button>
            </a>
          {:else}
            <a href="/register" use:inertia>
              <Button size="lg" class="rounded-full px-7 h-12 text-sm normal-case tracking-normal font-heading font-medium">
                Begin
                <ArrowRight class="w-4 h-4" />
              </Button>
            </a>
          {/if}

          <a href="https://github.com/MasRama/nara" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
            View source
            <ArrowUpRight class="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>

      <!-- right: editorial image -->
      <div class="lg:col-span-5 relative">
        <div in:fly={{ y: 30, duration: 1100, delay: 300 }} class="relative aspect-[4/5] w-full max-w-md ml-auto overflow-hidden rounded-sm bg-muted">
          <img
            src="/landing/hero.svg"
            alt="A quiet workspace, morning light"
            loading="eager"
            class="w-full h-full object-cover grayscale contrast-105 brightness-95 transition-transform duration-[1.2s] hover:scale-[1.03]"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
          <p class="absolute bottom-4 left-4 right-4 font-heading text-[11px] uppercase tracking-[0.2em] text-white/80">
            No. 01 &nbsp;/&nbsp; The morning ritual
          </p>
        </div>
      </div>
    </div>
  </header>

  <!-- ───────────────────────── MANIFESTO (full-width statement) ───────────────────────── -->
  <section class="py-32 sm:py-40 px-6 sm:px-10 lg:px-16 border-t border-border">
    <div class="max-w-[1100px] mx-auto">
      <p class="font-heading font-medium tracking-[-0.02em] leading-[1.15] text-[clamp(1.75rem,4.5vw,3.25rem)] text-foreground">
        Most starter kits fight the machine. Layers of abstraction it cannot read. Classes it has to guess. Magic it cannot trace.
        <span class="text-muted-foreground"> Nara is the opposite. Flat. Plain. Readable. The machine understands it on the first look, and so do you.</span>
      </p>
    </div>
  </section>

  <!-- ───────────────────────── THE IDEA (image + text, single zigzag) ───────────────────────── -->
  <section class="py-24 sm:py-32 px-6 sm:px-10 lg:px-16">
    <div class="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
      <div class="relative aspect-[5/6] overflow-hidden rounded-sm bg-muted order-1 lg:order-1">
        <img
          src="/landing/idea.svg"
          alt="A plan sketched on paper"
          loading="lazy"
          class="w-full h-full object-cover grayscale contrast-105 brightness-95"
        />
      </div>

      <div class="order-2 lg:order-2 flex flex-col gap-6 max-w-[44ch]">
        <h2 class="font-heading font-semibold tracking-[-0.02em] leading-[1.05] text-[clamp(2rem,4vw,3rem)] text-foreground">
          One prompt,<br />a whole feature.
        </h2>
        <p class="text-lg text-muted-foreground leading-relaxed">
          Describe what you want. The machine writes the types, the queries, the handlers, the routes, the interface. You read it, you ship it. The pattern is the generator.
        </p>
        <button
          onclick={copyCommand}
          class="group inline-flex w-fit items-center gap-3 rounded-full border border-border bg-card/50 px-5 py-3 hover:border-primary/40 hover:bg-muted/50 transition-all duration-300 cursor-pointer"
          aria-label="Copy clone command"
        >
          <span class="font-mono-accent text-xs text-muted-foreground group-hover:text-foreground transition-colors">{copied ? 'copied' : CLONE_CMD}</span>
          <span class="font-mono-accent text-[10px] uppercase tracking-widest text-primary">clone</span>
        </button>
      </div>
    </div>
  </section>

  <!-- ───────────────────────── PRINCIPLES (asymmetric bento, real visual variation) ───────────────────────── -->
  <section class="py-24 sm:py-32 px-6 sm:px-10 lg:px-16 border-t border-border">
    <div class="max-w-[1400px] mx-auto">
      <div class="mb-14 max-w-[60ch]">
        <h2 class="font-heading font-semibold tracking-[-0.02em] leading-[1.05] text-[clamp(2rem,4vw,3rem)] text-foreground">
          Five quiet principles.
        </h2>
        <p class="mt-4 text-muted-foreground leading-relaxed">Each one removes a reason for the machine to guess.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[minmax(220px,auto)]">
        <!-- 01 large, image -->
        <article class="md:col-span-3 md:row-span-2 relative overflow-hidden rounded-sm bg-muted group">
          <img
            src="/landing/principle.svg"
            alt="Flat, open layout"
            loading="lazy"
            class="absolute inset-0 w-full h-full object-cover grayscale contrast-105 brightness-90 transition-transform duration-700 group-hover:scale-105"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
          <div class="relative z-10 h-full flex flex-col justify-end p-7">
            <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-white/60 mb-3">01</span>
            <h3 class="font-heading font-semibold text-2xl text-white tracking-tight leading-tight">Flat, by design.</h3>
            <p class="mt-2 text-sm text-white/70 leading-relaxed max-w-[34ch]">Files at arm's reach. No deep nesting to navigate. The machine finds things by name, and so do you.</p>
          </div>
        </article>

        <!-- 02 text -->
        <article class="md:col-span-3 flex flex-col justify-center p-7 rounded-sm border border-border bg-card">
          <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-primary mb-3">02</span>
          <h3 class="font-heading font-semibold text-xl tracking-tight text-foreground">Functions, not classes.</h3>
          <p class="mt-2 text-sm text-muted-foreground leading-relaxed">Standalone functions the machine writes accurately. No inheritance to hallucinate, no hidden state to chase.</p>
        </article>

        <!-- 03 text -->
        <article class="md:col-span-3 flex flex-col justify-center p-7 rounded-sm border border-border bg-card">
          <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-primary mb-3">03</span>
          <h3 class="font-heading font-semibold text-xl tracking-tight text-foreground">Raw SQL, not magic.</h3>
          <p class="mt-2 text-sm text-muted-foreground leading-relaxed">Every query explicit, readable, predictable. The machine writes SQL fluently. No query builder syntax to invent.</p>
        </article>

        <!-- 04 accent tile -->
        <article class="md:col-span-2 flex flex-col justify-center p-7 rounded-sm bg-primary text-primary-foreground">
          <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-primary-foreground/60 mb-3">04</span>
          <h3 class="font-heading font-semibold text-xl tracking-tight">No hidden behavior.</h3>
          <p class="mt-2 text-sm text-primary-foreground/80 leading-relaxed">Traceable end to end. No decorators, no implicit middleware.</p>
        </article>

        <!-- 05 text -->
        <article class="md:col-span-2 flex flex-col justify-center p-7 rounded-sm border border-border bg-card">
          <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-primary mb-3">05</span>
          <h3 class="font-heading font-semibold text-xl tracking-tight text-foreground">Few dependencies.</h3>
          <p class="mt-2 text-sm text-muted-foreground leading-relaxed">Fewer APIs to learn. Fewer mistakes to make. Each one earns its place.</p>
        </article>

        <!-- 06 wide quote tile -->
        <article class="md:col-span-2 flex flex-col justify-center p-7 rounded-sm bg-foreground text-background">
          <p class="font-heading font-medium text-lg leading-snug tracking-tight">"The pattern is the generator."</p>
          <p class="mt-3 text-xs text-background/60 uppercase tracking-widest">The result</p>
        </article>
      </div>
    </div>
  </section>

  <!-- ───────────────────────── IMAGE BAND (full-width) ───────────────────────── -->
  <section class="relative h-[60vh] min-h-[420px] overflow-hidden">
    <img
      src="/landing/band.svg"
      alt="Hands at work, soft light"
      loading="lazy"
      class="absolute inset-0 w-full h-full object-cover grayscale contrast-110 brightness-90"
    />
    <div class="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent"></div>
    <div class="relative z-10 h-full flex flex-col justify-center px-6 sm:px-10 lg:px-16 max-w-[1400px] mx-auto">
      <p class="font-heading font-medium tracking-[-0.02em] leading-[1.1] text-[clamp(1.5rem,3.5vw,2.5rem)] text-white max-w-[20ch]">
        Built to be read by a machine and a human, equally.
      </p>
    </div>
  </section>

  <!-- ───────────────────────── QUIET CTA ───────────────────────── -->
  <section class="py-32 sm:py-44 px-6 sm:px-10 lg:px-16">
    <div class="max-w-[800px] mx-auto flex flex-col items-center text-center gap-7">
      <h2 class="font-heading font-semibold tracking-[-0.03em] leading-[1] text-[clamp(2.5rem,7vw,5rem)] text-foreground">
        Begin <span class="italic font-medium text-primary">quietly.</span>
      </h2>
      <p class="text-lg text-muted-foreground leading-relaxed max-w-[48ch]">
        Clone the repository. Open one file. Ask the machine for a feature. Watch it appear.
      </p>
      <div class="flex flex-wrap items-center justify-center gap-5 pt-2">
        {#if user}
          <a href="/dashboard" use:inertia>
            <Button size="lg" class="rounded-full px-7 h-12 text-sm normal-case tracking-normal font-heading font-medium">
              Go to dashboard
              <ArrowRight class="w-4 h-4" />
            </Button>
          </a>
        {:else}
          <a href="/register" use:inertia>
            <Button size="lg" class="rounded-full px-7 h-12 text-sm normal-case tracking-normal font-heading font-medium">
              Begin
              <ArrowRight class="w-4 h-4" />
            </Button>
          </a>
        {/if}
        <a href="https://github.com/MasRama/nara" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
          View source
          <ArrowUpRight class="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </div>
    </div>
  </section>

  <!-- ───────────────────────── FOOTER ───────────────────────── -->
  <footer class="border-t border-border">
    <div class="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
      <div class="flex items-center gap-2">
        <span class="inline-block w-2 h-2 rounded-full bg-primary"></span>
        <span class="font-heading font-semibold tracking-tight">Nara</span>
        <span class="text-xs text-muted-foreground ml-3">A foundation for building with AI</span>
      </div>
      <div class="flex items-center gap-6 text-sm text-muted-foreground">
        <a href="https://github.com/MasRama/nara" target="_blank" rel="noreferrer" class="hover:text-foreground transition-colors">GitHub</a>
        <a href="https://github.com/MasRama/nara#readme" target="_blank" rel="noreferrer" class="hover:text-foreground transition-colors">Docs</a>
        <span class="text-xs">&copy; {new Date().getFullYear()}</span>
      </div>
    </div>
  </footer>
</div>

<style>
  :global(html) {
    scroll-behavior: smooth;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(html) {
      scroll-behavior: auto;
    }
  }
</style>
