<script lang="ts">
  import { inertia, page } from '@inertiajs/svelte'
  import { fade, fly } from 'svelte/transition'
  import DarkModeToggle from '../Components/DarkModeToggle.svelte'
  import Button from '../Components/Button.svelte'
  import Badge from '../Components/Badge.svelte'

  interface User {
    id: string;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
    is_verified: boolean;
  }

  let user = page.props.user as User | undefined
  let scrollY = $state(0);
  let innerHeight = $state(0);
  let copied = $state(false);

  let scrolled = $derived(scrollY > 50);

  function copyCommand() {
    navigator.clipboard.writeText('git clone https://github.com/MasRama/nara.git my-app');
    copied = true;
    setTimeout(() => copied = false, 2000);
  }
</script>

<svelte:window bind:scrollY bind:innerHeight />

<div class="min-h-screen bg-background text-foreground font-body transition-colors duration-500 overflow-x-hidden selection:bg-primary/20 selection:text-primary">
  
  <!-- NAV -->
  <nav class="fixed top-0 left-0 right-0 z-50 px-6 sm:px-12 lg:px-24 flex justify-between items-center transition-all duration-500 {scrolled ? 'bg-background/80 backdrop-blur-md border-b border-border py-4' : 'bg-transparent py-6'}">
    <div class="flex flex-col relative z-10">
      <a href="/" class="text-xl font-heading font-bold tracking-tighter hover:opacity-70 transition-opacity" style="font-feature-settings: 'ss01'">NARA.</a>
    </div>

    <div class="flex items-center gap-6 text-sm font-medium relative z-10">
      <a href="https://github.com/MasRama/nara" target="_blank" class="hidden sm:block hover:text-primary transition-colors duration-200">GitHub</a>
      <a href="https://github.com/MasRama/nara#readme" target="_blank" class="hidden sm:block hover:text-primary transition-colors duration-200">Docs</a>
      
      <div class="h-4 w-px bg-border hidden sm:block"></div>

      {#if user}
        <a href="/dashboard" use:inertia class="hover:text-primary transition-colors duration-200">Dashboard</a>
      {:else}
        <a href="/login" use:inertia class="hover:text-primary transition-colors duration-200">Login</a>
      {/if}
      
      <div class="pl-2 border-l border-border ml-2 sm:ml-0">
        <DarkModeToggle />
      </div>
    </div>
  </nav>

  <!-- HERO -->
  <header class="relative min-h-screen flex flex-col justify-center px-6 sm:px-12 lg:px-24 pt-20">
    <div class="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]"></div>
    
    <div class="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
    <div class="absolute bottom-1/3 left-1/6 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[100px] pointer-events-none"></div>

    <div class="max-w-[90rem] mx-auto w-full relative z-10 flex flex-col items-center text-center gap-8">
      
      <div in:fly={{ y: 20, duration: 1000, delay: 200 }}>
        <Badge variant="outline" class="font-mono-accent text-xs px-3 py-1 text-primary border-primary/20 bg-primary/5 rounded-full mb-6">
          AI-First TypeScript Starter Kit
        </Badge>
      </div>

      <h1 in:fly={{ y: 20, duration: 1000, delay: 300 }} class="text-5xl sm:text-6xl lg:text-8xl font-heading font-bold tracking-tighter leading-[1.05] text-foreground" style="font-feature-settings: 'ss01'">
        Clone it. Prompt it.<br />
        <span class="text-primary">Ship it.</span>
      </h1>

      <p in:fly={{ y: 20, duration: 1000, delay: 500 }} class="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl font-body">
        Most starter kits fight your AI — complex abstractions, deep class hierarchies, magic ORMs. Nara is the opposite: flat patterns, raw SQL, plain functions. AI picks up the conventions and generates working code on the first try.
      </p>

      <div in:fly={{ y: 20, duration: 1000, delay: 700 }} class="flex flex-col sm:flex-row items-center gap-4 mt-4">
        {#if !user}
          <a href="/register" use:inertia>
            <Button size="lg" class="rounded-full px-8 py-6 font-heading font-semibold tracking-wide hover:scale-105 active:scale-95 transition-transform text-base shadow-sm">
              Get Started
            </Button>
          </a>
        {:else}
          <a href="/dashboard" use:inertia>
            <Button size="lg" class="rounded-full px-8 py-6 font-heading font-semibold tracking-wide hover:scale-105 active:scale-95 transition-transform text-base shadow-sm">
              Dashboard
            </Button>
          </a>
        {/if}
        
        <button onclick={copyCommand} class="group flex items-center gap-3 rounded-full border border-border bg-card/50 backdrop-blur-sm px-4 sm:px-6 py-4 hover:bg-muted/50 hover:border-primary/30 transition-all duration-300 cursor-pointer max-w-full overflow-hidden">
          <span class="font-mono-accent text-sm text-muted-foreground group-hover:text-foreground transition-colors shrink-0">$</span>
          <span class="font-mono-accent text-xs sm:text-sm text-foreground truncate">git clone MasRama/nara.git</span>
          <svg class="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            {#if copied}
              <path d="M20 6L9 17L4 12" stroke-linecap="round" stroke-linejoin="round"/>
            {:else}
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            {/if}
          </svg>
        </button>
      </div>
    </div>
  </header>

  <!-- PROBLEM SECTION -->
  <section class="py-32 px-6 sm:px-12 lg:px-24 bg-card/30 border-y border-border">
    <div class="max-w-6xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
        <div>
          <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-6">The Problem</span>
          <h2 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter leading-tight" style="font-feature-settings: 'ss01'">
            Your starter kit <br/>
            <span class="text-muted-foreground">shouldn't fight</span> your AI.
          </h2>
        </div>
        <div class="space-y-8 text-lg text-muted-foreground font-body leading-relaxed">
          <p>
            AI assistants hallucinate on complex abstractions. Deep class hierarchies confuse them. Magic ORMs with hidden behaviors produce incorrect code that you end up debugging manually.
          </p>
          <p>
            Nara is built from the ground up so AI understands every file, every pattern, every convention. Flat structure. Raw SQL. Plain functions. No magic. Your AI assistant picks up the patterns instantly and generates working code on the first try.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- DESIGN DECISIONS -->
  <section class="py-32 px-6 sm:px-12 lg:px-24 relative overflow-hidden bg-background">
    <div class="max-w-[90rem] mx-auto">
      <div class="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
         <div>
           <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-4">Design Decisions</span>
           <h3 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter text-foreground" style="font-feature-settings: 'ss01'">
            Built for AI.
          </h3>
         </div>
         <p class="text-muted-foreground max-w-md text-base leading-relaxed font-body">
           Every architectural choice is intentional — optimized for AI-assisted development, not just human readability.
         </p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <div class="group bg-background border border-border rounded-2xl p-8 flex flex-col gap-4 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
          <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
            <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <h4 class="text-lg font-heading font-semibold mb-2 tracking-tight text-foreground">Functions, Not Classes</h4>
            <p class="text-sm text-muted-foreground font-body leading-relaxed">AI generates standalone functions far more accurately than class hierarchies with inheritance chains and hidden state.</p>
          </div>
        </div>

        <div class="group bg-background border border-border rounded-2xl p-8 flex flex-col gap-4 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
          <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
            <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M3 5v14c0 1.657 4.029 3 9 3s9-1.343 9-3V5"/>
              <path d="M3 12c0 1.657 4.029 3 9 3s9-1.343 9-3"/>
            </svg>
          </div>
          <div>
            <h4 class="text-lg font-heading font-semibold mb-2 tracking-tight text-foreground">Raw SQL, Not ORM</h4>
            <p class="text-sm text-muted-foreground font-body leading-relaxed">AI writes SQL fluently — no query builder syntax to hallucinate. Every query is explicit, readable, and predictable.</p>
          </div>
        </div>

        <div class="group bg-background border border-border rounded-2xl p-8 flex flex-col gap-4 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
          <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
            <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <h4 class="text-lg font-heading font-semibold mb-2 tracking-tight text-foreground">Flat File Structure</h4>
            <p class="text-sm text-muted-foreground font-body leading-relaxed">AI finds files by name, not by navigating deep nesting. Types, queries, handlers — all at arm's reach, all obvious.</p>
          </div>
        </div>

        <div class="group bg-background border border-border rounded-2xl p-8 flex flex-col gap-4 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
          <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
            <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <h4 class="text-lg font-heading font-semibold mb-2 tracking-tight text-foreground">No Magic</h4>
            <p class="text-sm text-muted-foreground font-body leading-relaxed">Every behavior is traceable — no decorators, no implicit middleware, no hidden state. AI can read and reason about the entire flow.</p>
          </div>
        </div>

        <div class="group bg-background border border-border rounded-2xl p-8 flex flex-col gap-4 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
          <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
            <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <h4 class="text-lg font-heading font-semibold mb-2 tracking-tight text-foreground">Minimal Dependencies</h4>
            <p class="text-sm text-muted-foreground font-body leading-relaxed">Fewer APIs to learn = fewer mistakes from AI and humans alike. Each dependency is purposeful and well-documented.</p>
          </div>
        </div>

        <div class="group bg-primary text-primary-foreground rounded-2xl p-8 flex flex-col gap-4 hover:opacity-95 transition-opacity duration-300">
          <div class="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.378 3.378 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <h4 class="text-lg font-heading font-semibold mb-2 tracking-tight">The Result?</h4>
            <p class="text-sm opacity-80 font-body leading-relaxed">AI understands Nara's patterns instantly. No boilerplate generators needed — the pattern <em>is</em> the generator.</p>
          </div>
        </div>

      </div>
    </div>
  </section>

  <!-- CODE DEMO: ONE PROMPT -->
  <section class="py-32 px-6 sm:px-12 lg:px-24 bg-card/30 border-t border-border relative overflow-hidden">
    <div class="absolute top-1/2 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
    
    <div class="max-w-[90rem] mx-auto relative z-10">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        
        <div>
          <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-4">One Prompt</span>
          <h3 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter text-foreground mb-8" style="font-feature-settings: 'ss01'">
            Ship a full feature<br/>in a single prompt.
          </h3>
          
          <p class="text-lg text-muted-foreground font-body leading-relaxed mb-8">
            Tell your AI assistant: <span class="text-foreground font-medium">"Add a products CRUD."</span> That's it. AI picks up Nara's conventions and generates the complete stack — types, queries, handlers, routes, and UI.
          </p>

          <div class="space-y-4">
            <div class="flex items-center gap-3 text-sm">
              <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <svg class="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17L4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <span class="text-muted-foreground">No boilerplate generators needed</span>
            </div>
            <div class="flex items-center gap-3 text-sm">
              <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <svg class="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17L4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <span class="text-muted-foreground">No code generation step or build tooling</span>
            </div>
            <div class="flex items-center gap-3 text-sm">
              <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <svg class="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17L4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <span class="text-muted-foreground">AI reads existing patterns and replicates them perfectly</span>
            </div>
            <div class="flex items-center gap-3 text-sm">
              <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <svg class="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17L4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <span class="text-muted-foreground">Working code on the first try — not the third</span>
            </div>
          </div>
        </div>

        <!-- Code preview -->
        <div class="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
          <div class="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
            <div class="flex gap-1.5">
              <div class="w-3 h-3 rounded-full bg-red-400/60"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-400/60"></div>
              <div class="w-3 h-3 rounded-full bg-green-400/60"></div>
            </div>
            <span class="text-xs font-mono-accent text-muted-foreground ml-2">AI Generated Output</span>
          </div>
          <div class="p-5 font-mono-accent text-[13px] leading-relaxed overflow-x-auto">
            <div class="text-muted-foreground mb-3">
              <span class="text-primary">&gt;</span> "Add a products CRUD"
            </div>
            
            <div class="space-y-1.5">
              <div class="flex items-start gap-3">
                <span class="text-primary shrink-0">+</span>
                <span class="text-muted-foreground">types/</span><span class="text-foreground">models.ts</span>
              </div>
              <div class="pl-6 text-muted-foreground text-xs">
                <span class="text-accent">interface</span> <span class="text-foreground">Product</span> {'{ id: string; name: string; price: number; }'}
              </div>

              <div class="flex items-start gap-3 mt-3">
                <span class="text-primary shrink-0">+</span>
                <span class="text-muted-foreground">queries/</span><span class="text-foreground">products.ts</span>
              </div>
              <div class="pl-6 text-muted-foreground text-xs">
                <span class="text-accent">export const</span> findProductById, createProduct, updateProduct...
              </div>

              <div class="flex items-start gap-3 mt-3">
                <span class="text-primary shrink-0">+</span>
                <span class="text-muted-foreground">handlers/</span><span class="text-foreground">products.ts</span>
              </div>
              <div class="pl-6 text-muted-foreground text-xs">
                index(), show(), store(), update(), destroy()
              </div>

              <div class="flex items-start gap-3 mt-3">
                <span class="text-primary shrink-0">+</span>
                <span class="text-muted-foreground">routes/</span><span class="text-foreground">web.ts</span>
              </div>
              <div class="pl-6 text-muted-foreground text-xs">
                Route.get('/products', [Auth], products.index)
              </div>

              <div class="flex items-start gap-3 mt-3">
                <span class="text-primary shrink-0">+</span>
                <span class="text-muted-foreground">Pages/</span><span class="text-foreground">products.svelte</span>
              </div>
              <div class="pl-6 text-muted-foreground text-xs">
                Full UI with table, forms, toast notifications
              </div>

              <div class="flex items-start gap-3 mt-3">
                <span class="text-primary shrink-0">+</span>
                <span class="text-muted-foreground">validators/</span><span class="text-foreground">schemas.ts</span>
              </div>
              <div class="pl-6 text-muted-foreground text-xs">
                productSchema = z.object({'{ name: z.string(), price: z.number() }'})
              </div>
            </div>

            <div class="mt-4 pt-4 border-t border-border flex items-center gap-2 text-xs text-primary">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17L4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>7 files generated — full stack, zero errors</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ARCHITECTURE / PATTERN -->
  <section class="py-32 px-6 sm:px-12 lg:px-24 bg-background relative overflow-hidden">
    <div class="max-w-[90rem] mx-auto">
      <div class="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
         <div>
           <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-4">The Pattern</span>
           <h3 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter text-foreground" style="font-feature-settings: 'ss01'">
            Types → Queries →<br/>Handlers → Routes
          </h3>
         </div>
         <p class="text-muted-foreground max-w-md text-base leading-relaxed font-body">
           A simple, predictable flow that AI replicates perfectly. Every feature follows the same pattern — no surprises.
         </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div class="group relative bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-all duration-300">
          <div class="absolute top-4 right-4 font-mono-accent text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">01</div>
          <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <svg class="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z"/>
              <path d="M9 12h6M9 8h6M9 16h3"/>
            </svg>
          </div>
          <h4 class="text-lg font-heading font-semibold tracking-tight text-foreground mb-2">Types</h4>
          <p class="text-sm text-muted-foreground leading-relaxed">Define your data shape. Pure TypeScript interfaces — no decorators, no metadata.</p>
          <div class="mt-4 font-mono-accent text-[11px] bg-muted/50 p-2.5 rounded text-muted-foreground">
            <span class="text-accent">interface</span> Product {'{ ... }'}
          </div>
        </div>

        <div class="group relative bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-all duration-300">
          <div class="absolute top-4 right-4 font-mono-accent text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">02</div>
          <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <svg class="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M3 5v14c0 1.657 4.029 3 9 3s9-1.343 9-3V5"/>
              <path d="M3 12c0 1.657 4.029 3 9 3s9-1.343 9-3"/>
            </svg>
          </div>
          <h4 class="text-lg font-heading font-semibold tracking-tight text-foreground mb-2">Queries</h4>
          <p class="text-sm text-muted-foreground leading-relaxed">Raw SQL functions. AI writes SQL fluently — no ORM syntax to hallucinate.</p>
          <div class="mt-4 font-mono-accent text-[11px] bg-muted/50 p-2.5 rounded text-muted-foreground">
            <span class="text-accent">export const</span> findById = (id) <span class="text-accent">=&gt;</span> ...
          </div>
        </div>

        <div class="group relative bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-all duration-300">
          <div class="absolute top-4 right-4 font-mono-accent text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">03</div>
          <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <svg class="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h4 class="text-lg font-heading font-semibold tracking-tight text-foreground mb-2">Handlers</h4>
          <p class="text-sm text-muted-foreground leading-relaxed">Plain functions for each action. No class context needed — just req in, res out.</p>
          <div class="mt-4 font-mono-accent text-[11px] bg-muted/50 p-2.5 rounded text-muted-foreground">
            <span class="text-accent">export const</span> index = (req, res) <span class="text-accent">=&gt;</span> ...
          </div>
        </div>

        <div class="group relative bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-all duration-300">
          <div class="absolute top-4 right-4 font-mono-accent text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">04</div>
          <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <svg class="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h4 class="text-lg font-heading font-semibold tracking-tight text-foreground mb-2">Routes</h4>
          <p class="text-sm text-muted-foreground leading-relaxed">One-liner registration. Connect URL to handler with optional middleware.</p>
          <div class="mt-4 font-mono-accent text-[11px] bg-muted/50 p-2.5 rounded text-muted-foreground">
            Route.get('/products', [Auth], products.index)
          </div>
        </div>

      </div>

      <!-- Flow arrows between cards (visible on lg+) -->
      <div class="hidden lg:flex justify-center items-center gap-0 mt-6 text-muted-foreground">
        <span class="font-mono-accent text-xs text-muted-foreground/60 px-4">types/models.ts</span>
        <svg class="w-4 h-4 text-primary/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="font-mono-accent text-xs text-muted-foreground/60 px-4">queries/products.ts</span>
        <svg class="w-4 h-4 text-primary/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="font-mono-accent text-xs text-muted-foreground/60 px-4">handlers/products.ts</span>
        <svg class="w-4 h-4 text-primary/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="font-mono-accent text-xs text-muted-foreground/60 px-4">routes/web.ts</span>
      </div>
    </div>
  </section>

  <!-- THE STACK -->
  <section class="py-32 px-6 sm:px-12 lg:px-24 bg-card/30 border-y border-border">
    <div class="max-w-[90rem] mx-auto">
      <div class="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
         <div>
           <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-4">Stack</span>
           <h3 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter text-foreground" style="font-feature-settings: 'ss01'">
            Precision Tools.
          </h3>
         </div>
         <p class="text-muted-foreground max-w-md text-base leading-relaxed font-body">
           Each tool chosen for performance, simplicity, and AI-compatibility. Nothing bloated, nothing redundant.
         </p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        <div class="group border-none bg-transparent shadow-none">
          <div class="p-0 flex flex-col h-full border-l-2 border-border group-hover:border-primary pl-6 py-2 transition-colors duration-300">
            <div class="flex justify-between items-start mb-6">
              <span class="text-xs font-mono-accent tracking-wider text-muted-foreground">HTTP Engine</span>
            </div>
            <div>
              <div class="flex items-center gap-3 mb-3">
                 <h4 class="text-xl font-heading font-semibold tracking-tight text-foreground">ultimate-express</h4>
                 <Badge variant="outline" class="text-[10px] font-mono-accent px-1.5 py-0">uWS</Badge>
              </div>
              <p class="text-sm text-muted-foreground leading-relaxed">
                250k+ req/s on uWebSockets.js. Express-compatible API that AI already knows — no custom syntax to learn.
              </p>
            </div>
          </div>
        </div>

        <div class="group border-none bg-transparent shadow-none">
          <div class="p-0 flex flex-col h-full border-l-2 border-border group-hover:border-primary pl-6 py-2 transition-colors duration-300">
            <div class="flex justify-between items-start mb-6">
              <span class="text-xs font-mono-accent tracking-wider text-muted-foreground">Frontend</span>
            </div>
            <div>
              <h4 class="text-xl font-heading font-semibold tracking-tight text-foreground mb-3">Svelte 5 + Inertia</h4>
              <p class="text-sm text-muted-foreground leading-relaxed">
                Svelte 5 runes for elegant reactivity. Inertia bridges backend to frontend — no API layer needed, no serialization headaches.
              </p>
            </div>
          </div>
        </div>

        <div class="group border-none bg-transparent shadow-none">
          <div class="p-0 flex flex-col h-full border-l-2 border-border group-hover:border-primary pl-6 py-2 transition-colors duration-300">
            <div class="flex justify-between items-start mb-6">
              <span class="text-xs font-mono-accent tracking-wider text-muted-foreground">Database</span>
            </div>
            <div>
              <h4 class="text-xl font-heading font-semibold tracking-tight text-foreground mb-3">SQLite + Knex</h4>
              <p class="text-sm text-muted-foreground leading-relaxed">
                Zero-config embedded database with WAL mode. Knex migrations for schema control. AI writes raw SQL, Knex handles migrations.
              </p>
            </div>
          </div>
        </div>

        <div class="group border-none bg-transparent shadow-none">
          <div class="p-0 flex flex-col h-full border-l-2 border-border group-hover:border-primary pl-6 py-2 transition-colors duration-300">
            <div class="flex justify-between items-start mb-6">
              <span class="text-xs font-mono-accent tracking-wider text-muted-foreground">Validation</span>
            </div>
            <div>
              <h4 class="text-xl font-heading font-semibold tracking-tight text-foreground mb-3">Zod</h4>
              <p class="text-sm text-muted-foreground leading-relaxed">
                Type-safe schema validation with inference. AI generates Zod schemas naturally — they read like documentation.
              </p>
            </div>
          </div>
        </div>

        <div class="group border-none bg-transparent shadow-none">
          <div class="p-0 flex flex-col h-full border-l-2 border-border group-hover:border-primary pl-6 py-2 transition-colors duration-300">
            <div class="flex justify-between items-start mb-6">
              <span class="text-xs font-mono-accent tracking-wider text-muted-foreground">Auth</span>
            </div>
            <div>
              <h4 class="text-xl font-heading font-semibold tracking-tight text-foreground mb-3">Session + OAuth + RBAC</h4>
              <p class="text-sm text-muted-foreground leading-relaxed">
                Session-based auth with Google OAuth and role-based access control. Pre-wired, pre-secured, ready to extend.
              </p>
            </div>
          </div>
        </div>

        <div class="group border-none bg-transparent shadow-none">
          <div class="p-0 flex flex-col h-full border-l-2 border-primary pl-6 py-2 transition-colors duration-300">
            <div class="flex justify-between items-start mb-6">
              <span class="text-xs font-mono-accent tracking-wider text-primary">AI Knowledge</span>
            </div>
            <div>
              <h4 class="text-xl font-heading font-semibold tracking-tight text-foreground mb-3">AGENTS.md</h4>
              <p class="text-sm text-muted-foreground leading-relaxed mb-4">
                Full knowledge base embedded in the repo. AI reads patterns, conventions, and anti-patterns — zero context setup needed.
              </p>
              <div class="font-mono-accent text-[11px] bg-muted/50 p-2 rounded text-muted-foreground inline-block">
                 <span class="opacity-50">$</span> cat AGENTS.md
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>

  <!-- BUILT-IN FEATURES -->
  <section class="py-32 px-6 sm:px-12 lg:px-24 bg-background">
     <div class="max-w-[90rem] mx-auto">
       <div class="mb-16 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
         <div>
           <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-4">Batteries Included</span>
           <h3 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter text-foreground" style="font-feature-settings: 'ss01'">
             Everything, out of the box.
           </h3>
         </div>
         <p class="text-muted-foreground max-w-sm text-base leading-relaxed font-body lg:text-right">
           Ship fast without sacrificing quality. Security, auth, logging — all configured and working.
         </p>
       </div>

       <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

         <div class="group bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke-linecap="round" stroke-linejoin="round"/>
               <path d="M12 14C8.13401 14 5 17.134 5 21H19C19 17.134 15.866 14 12 14Z" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Authentication & RBAC</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">Session auth, Google OAuth, HTTP-only cookies, role-based access control — wired in from day one.</p>
           </div>
         </div>

         <div class="group bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Security First</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">CSRF (Double Submit), rate limiting, XSS sanitization, security headers — all enabled by default.</p>
           </div>
         </div>

         <div class="group bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M9 3H5C3.89543 3 3 3.89543 3 5V9M9 3H15M9 3V9M15 3H19C20.1046 3 21 3.89543 21 5V9M15 3V9M21 9V15M21 15V19C21 20.1046 20.1046 21 19 21H15M21 15H15M15 21H9M15 21V15M9 21H5C3.89543 21 3 20.1046 3 19V15M9 21V15M3 15V9M3 9H9M9 9H15M9 9V15M15 9H21M15 9V15M9 15H15" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Event System</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">Decoupled event dispatcher. Fire and listen from anywhere — clean architecture without the ceremony.</p>
           </div>
         </div>

         <div class="group bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M4 17L10 11L4 5M12 19H20" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">CLI Scaffolding</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">22+ commands for models, controllers, migrations, seeders. Scaffold in seconds, ship in minutes.</p>
           </div>
         </div>

         <div class="group bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Real-time Ready</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">Built on uWebSockets.js — broadcast events to thousands of clients with microsecond latency.</p>
           </div>
         </div>

         <div class="group bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H5C4.46957 17 3.96086 16.7893 3.58579 16.4142C3.21071 16.0391 3 15.5304 3 15M21 15V9C21 8.46957 20.7893 7.96086 20.4142 7.58579C20.0391 7.21071 19.5304 7 19 7H5C4.46957 7 3.96086 7.21071 3.58579 7.58579C3.21071 7.96086 3 8.46957 3 9V15M21 15C21 14.4696 20.7893 13.9609 20.4142 13.5858C20.0391 13.2107 19.5304 13 19 13H5C4.46957 13 3.96086 13.2107 3.58579 13.5858C3.21071 13.9609 3 14.4696 3 15" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Job Queues</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">Async job processing backed by Redis or in-memory drivers. No extra service needed to start.</p>
           </div>
         </div>

         <div class="group bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M8 9H16M8 13H14M8 17H11M6 3H18C19.1046 3 20 3.89543 20 5V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V5C4 3.89543 4.89543 3 6 3Z" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Structured Logging</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">Pino-powered structured logging. Request logging, query logging, and error tracking — all built in.</p>
           </div>
         </div>

         <div class="group bg-card border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke-linecap="round" stroke-linejoin="round"/>
               <path d="M9 12L11 14L15 10" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Zod Validation</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">Type-safe request validation with Zod schemas. AI generates them naturally, TypeScript infers the types.</p>
           </div>
         </div>

       </div>
     </div>
  </section>

  <!-- CTA -->
  <section class="relative bg-background text-foreground overflow-hidden py-40 flex flex-col items-center justify-center transition-colors duration-500">
     <div class="absolute inset-0 opacity-20 dark:opacity-[0.03] bg-[linear-gradient(rgba(0,0,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.1)_1px,transparent_1px)] bg-[size:3rem_3rem] dark:bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
     
     <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(var(--color-primary-rgb,16,185,129),0.05),_transparent_60%)] pointer-events-none"></div>

     <div class="relative z-10 px-6 max-w-3xl text-center flex flex-col items-center">
        <Badge variant="outline" class="font-mono-accent text-xs px-3 py-1 text-primary border-primary/20 bg-primary/5 rounded-full mb-8">
          Ready to ship?
        </Badge>
        
        <h2 class="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold tracking-tighter mb-8" style="font-feature-settings: 'ss01'">
          Clone. Prompt. Ship.
        </h2>
        
        <p class="text-lg sm:text-xl text-muted-foreground font-body mb-12">
          Stop fighting your starter kit. Start prompting your AI and shipping features in minutes — not hours.
        </p>

        <div class="flex flex-col sm:flex-row items-center gap-4">
          <a href="https://github.com/MasRama/nara" target="_blank">
            <Button size="lg" class="rounded-full px-8 py-6 font-heading font-medium text-base hover:scale-105 transition-transform duration-300">
              View on GitHub
            </Button>
          </a>
          
          <button onclick={copyCommand} class="group flex items-center gap-3 rounded-full border border-border bg-card/50 backdrop-blur-sm px-6 py-4 hover:bg-muted/50 hover:border-primary/30 transition-all duration-300 cursor-pointer">
            <span class="font-mono-accent text-sm text-muted-foreground">$</span>
            <span class="font-mono-accent text-sm text-foreground">git clone MasRama/nara.git</span>
            <svg class="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              {#if copied}
                <path d="M20 6L9 17L4 12" stroke-linecap="round" stroke-linejoin="round"/>
              {:else}
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              {/if}
            </svg>
          </button>
        </div>
     </div>
  </section>

  <!-- FOOTER -->
  <footer class="border-t border-border bg-background py-8">
    <div class="max-w-[90rem] mx-auto px-6 sm:px-12 lg:px-24 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono-accent text-muted-foreground uppercase tracking-widest">
       <div class="flex items-center gap-2">
         <span>&copy; {new Date().getFullYear()} NARA FRAMEWORK</span>
       </div>
       <div class="flex gap-6">
         <a href="https://github.com/MasRama/nara" class="hover:text-primary transition-colors">GITHUB</a>
         <span>v1.0.0</span>
       </div>
    </div>
  </footer>
</div>

<style>
  :global(html) {
    scroll-behavior: smooth;
  }
</style>
