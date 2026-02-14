<script lang="ts">
  import { inertia, page } from '@inertiajs/svelte'
  import { fade, fly } from 'svelte/transition'
  import { onMount } from 'svelte'
  import DarkModeToggle from '../Components/DarkModeToggle.svelte'

  interface User {
    id: string;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
    is_verified: boolean;
  }

  let user = $page.props.user as User | undefined
  let scrollY = 0;
  let innerHeight = 0;

  // Simple intersection observer alternative using scroll position for parallax/reveal effects
  $: scrolled = scrollY > 50;
</script>

<svelte:window bind:scrollY bind:innerHeight />

<div class="min-h-screen bg-surface-light dark:bg-surface-dark text-slate-900 dark:text-slate-100 transition-colors duration-500 overflow-x-hidden selection:bg-primary-400 selection:text-black">
  
  <!-- Floating Navigation -->
  <nav 
    class="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-start transition-all duration-500 {scrolled ? 'bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 py-4' : 'mix-blend-difference text-white'}"
  >
    <div class="flex flex-col relative z-10">
      <a href="/" class="text-xl font-bold tracking-tighter hover:opacity-70 transition-opacity">NARA.</a>
    </div>

    <div class="flex items-center gap-6 text-sm font-medium relative z-10">
      <a href="https://github.com/MasRama/nara" target="_blank" class="hidden sm:block hover:underline decoration-1 underline-offset-4">GitHub</a>
      <a href="https://github.com/MasRama/nara#readme" target="_blank" class="hidden sm:block hover:underline decoration-1 underline-offset-4">Docs</a>
      
      <div class="h-4 w-px bg-current opacity-30 hidden sm:block"></div>

      {#if user}
        <a href="/dashboard" use:inertia class="hover:underline decoration-1 underline-offset-4">Dashboard</a>
      {:else}
        <a href="/login" use:inertia class="hover:underline decoration-1 underline-offset-4">Login</a>
      {/if}
      
      <div class="pl-2">
        <DarkModeToggle />
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <header class="relative min-h-screen flex flex-col justify-center px-6 sm:px-12 lg:px-24 pt-20">
    <div class="max-w-[90rem] mx-auto w-full">
      <div in:fly={{ y: 50, duration: 1000, delay: 200 }} class="flex flex-col gap-2">
        <h1 class="text-[13vw] leading-[0.8] font-bold tracking-tighter -ml-[0.05em]">
          PURE
          <span class="block text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-300 dark:from-primary-400 dark:to-info-300">
            SPEED
          </span>
        </h1>
      </div>

      <div class="mt-12 sm:mt-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
        <div class="lg:col-span-5 text-lg sm:text-xl leading-relaxed font-serif italic text-slate-600 dark:text-slate-400">
          <p in:fly={{ y: 20, duration: 1000, delay: 600 }}>
            "Complexity is the enemy of execution. Nara strips away the layers to reveal the raw power of the metal."
          </p>
        </div>
        <div class="lg:col-span-7 flex flex-col items-start lg:items-end gap-6">
          <div class="flex items-center gap-4" in:fly={{ y: 20, duration: 1000, delay: 800 }}>
            <span class="text-xs uppercase tracking-widest opacity-50">Benchmarks</span>
            <div class="h-px w-12 bg-current opacity-20"></div>
            <span class="font-mono text-primary-600 dark:text-primary-400">258k req/s</span>
          </div>
          
          <div in:fly={{ y: 20, duration: 1000, delay: 1000 }}>
            {#if !user}
              <a 
                href="/register" 
                use:inertia
                class="group relative inline-flex items-center justify-center px-8 py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-black rounded-full overflow-hidden transition-transform hover:scale-105 active:scale-95"
              >
                <span class="relative z-10 font-bold tracking-wide">START BUILDING</span>
                <div class="absolute inset-0 bg-primary-500 transform translate-y-full transition-transform duration-300 group-hover:translate-y-0"></div>
              </a>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Scroll Indicator -->
    <div class="absolute bottom-12 left-6 sm:left-12 animate-bounce opacity-50">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M7 13l5 5 5-5M7 6l5 5 5-5"/>
      </svg>
    </div>
  </header>

  <!-- Narrative Section -->
  <section class="py-32 px-6 sm:px-12 lg:px-24 bg-white dark:bg-surface-card-dark">
    <div class="max-w-6xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-20">
        <div>
          <span class="block text-xs font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-400 mb-8">The Manifesto</span>
          <h2 class="text-5xl sm:text-6xl font-bold tracking-tighter leading-none mb-12">
            Return to <br/>
            <span class="font-serif italic font-normal text-slate-400">Craftsmanship.</span>
          </h2>
        </div>
        <div class="space-y-8 text-lg sm:text-xl leading-relaxed text-slate-600 dark:text-slate-300">
          <p>
            We built Nara because we were tired. Tired of configuration files that are longer than the business logic. Tired of "optimizing" things that shouldn't be slow in the first place.
          </p>
          <p>
            Nara is <strong class="text-slate-900 dark:text-white">opinionated</strong>. It chooses the best tools—HyperExpress for the server, SQLite for the data, Svelte for the interface—and tunes them to sing in perfect harmony.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Feature Showcase (Stack) -->
  <section class="py-24 sm:py-32 border-y border-slate-200 dark:border-white/5 relative overflow-hidden">
    <div class="px-6 sm:px-12 lg:px-24 mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
       <div>
         <span class="block text-xs font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-400 mb-4">The Powerhouse</span>
         <h3 class="text-5xl sm:text-7xl font-bold tracking-tighter text-slate-900 dark:text-white">
          ARSENAL
        </h3>
       </div>
       <p class="text-slate-600 dark:text-slate-400 max-w-md text-sm sm:text-base leading-relaxed">
         Precision tools for digital artisans. <br class="hidden sm:block" />
         Forged for speed, honed for control.
       </p>
    </div>
    
    <div class="px-6 sm:px-12 lg:px-24">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        <!-- Card 1: HyperExpress -->
        <div class="group relative h-64 bg-surface-card-light dark:bg-surface-card-dark border border-slate-200 dark:border-white/5 hover:border-primary-500/50 dark:hover:border-primary-500/30 p-6 flex flex-col justify-between transition-all duration-500 overflow-hidden rounded-2xl">
           <div class="absolute top-0 right-0 p-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-colors duration-500"></div>
           
           <div class="relative z-10 flex justify-between items-start">
             <div class="p-2 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 group-hover:scale-110 transition-transform duration-300">
               <!-- Icon: Lightning -->
               <svg class="w-6 h-6 text-primary-600 dark:text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
             </div>
             <span class="text-[10px] font-mono opacity-40">BACKEND</span>
           </div>

           <div class="relative z-10">
             <div class="flex items-baseline gap-2 mb-2">
                <h4 class="text-xl font-bold">HyperExpress</h4>
                <span class="text-[10px] bg-slate-200 dark:bg-white/10 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">v6.x</span>
             </div>
             <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
               The engine. Raw metal performance, zero compromise.
             </p>
             <div class="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
               <div class="h-full bg-primary-500 w-[98%]"></div>
             </div>
             <div class="flex justify-between text-[9px] font-mono mt-2 opacity-60">
                <span>BENCHMARK</span>
                <span>250K REQ/S</span>
             </div>
           </div>
        </div>

        <!-- Card 2: Inertia -->
        <div class="group relative h-64 bg-surface-card-light dark:bg-surface-card-dark border border-slate-200 dark:border-white/5 hover:border-accent-500/50 dark:hover:border-accent-500/30 p-6 flex flex-col justify-between transition-all duration-500 overflow-hidden rounded-2xl">
           <div class="absolute top-0 right-0 p-32 bg-accent-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-accent-500/10 transition-colors duration-500"></div>

           <div class="relative z-10 flex justify-between items-start">
             <div class="p-2 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 group-hover:scale-110 transition-transform duration-300">
               <!-- Icon: Layers -->
               <svg class="w-6 h-6 text-accent-600 dark:text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
             </div>
             <span class="text-[10px] font-mono opacity-40">PROTOCOL</span>
           </div>

           <div class="relative z-10">
             <h4 class="text-xl font-bold mb-2">Inertia.js</h4>
             <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
               The bridge. Monolith simplicity, SPA fluidity.
             </p>
             <div class="mt-4 flex gap-2">
                <span class="text-[10px] border border-accent-500/20 text-accent-600 dark:text-accent-400 px-2 py-1 rounded">No API</span>
                <span class="text-[10px] border border-accent-500/20 text-accent-600 dark:text-accent-400 px-2 py-1 rounded">Shared Data</span>
             </div>
           </div>
        </div>

        <!-- Card 3: Svelte -->
        <div class="group relative h-64 bg-surface-card-light dark:bg-surface-card-dark border border-slate-200 dark:border-white/5 hover:border-warning-500/50 dark:hover:border-warning-500/30 p-6 flex flex-col justify-between transition-all duration-500 overflow-hidden rounded-2xl">
           <div class="absolute top-0 right-0 p-32 bg-warning-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-warning-500/10 transition-colors duration-500"></div>

           <div class="relative z-10 flex justify-between items-start">
             <div class="p-2 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 group-hover:scale-110 transition-transform duration-300">
               <!-- Icon: Code -->
               <svg class="w-6 h-6 text-warning-600 dark:text-warning-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M16 18L22 12L16 6" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M8 6L2 12L8 18" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
             </div>
             <span class="text-[10px] font-mono opacity-40">FRONTEND</span>
           </div>

           <div class="relative z-10">
             <h4 class="text-xl font-bold mb-2">Svelte</h4>
             <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
               The canvas. Pure reactivity, no virtual DOM overhead.
             </p>
             <div class="mt-4 grid grid-cols-2 gap-2 text-[10px] font-mono opacity-60">
                <div class="flex items-center gap-1">
                    <div class="w-1.5 h-1.5 rounded-full bg-warning-500"></div>
                    <span>Reactive</span>
                </div>
                <div class="flex items-center gap-1">
                    <div class="w-1.5 h-1.5 rounded-full bg-warning-500"></div>
                    <span>Tiny Bundle</span>
                </div>
             </div>
           </div>
        </div>

        <!-- Card 4: Knex -->
        <div class="group relative h-64 bg-surface-card-light dark:bg-surface-card-dark border border-slate-200 dark:border-white/5 hover:border-danger-500/50 dark:hover:border-danger-500/30 p-6 flex flex-col justify-between transition-all duration-500 overflow-hidden rounded-2xl">
           <div class="absolute top-0 right-0 p-32 bg-danger-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-danger-500/10 transition-colors duration-500"></div>

           <div class="relative z-10 flex justify-between items-start">
             <div class="p-2 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 group-hover:scale-110 transition-transform duration-300">
               <!-- Icon: Database Cog -->
               <svg class="w-6 h-6 text-danger-600 dark:text-danger-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 12V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19H12" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M21 5H3" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M7 19V5" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="18" cy="18" r="3" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M20.2 20.2L22 22" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
             </div>
             <span class="text-[10px] font-mono opacity-40">ORM</span>
           </div>

           <div class="relative z-10">
             <h4 class="text-xl font-bold mb-2">Knex.js</h4>
             <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
               The architect. SQL control with TypeScript precision.
             </p>
             <div class="mt-auto pt-4 space-y-1">
                <div class="h-1 w-3/4 bg-slate-200 dark:bg-white/10 rounded-full"></div>
                <div class="h-1 w-1/2 bg-slate-200 dark:bg-white/10 rounded-full"></div>
             </div>
           </div>
        </div>

        <!-- Card 5: SQLite -->
        <div class="group relative h-64 bg-surface-card-light dark:bg-surface-card-dark border border-slate-200 dark:border-white/5 hover:border-info-500/50 dark:hover:border-info-500/30 p-6 flex flex-col justify-between transition-all duration-500 overflow-hidden rounded-2xl">
           <div class="absolute top-0 right-0 p-32 bg-info-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-info-500/10 transition-colors duration-500"></div>

           <div class="relative z-10 flex justify-between items-start">
             <div class="p-2 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 group-hover:scale-110 transition-transform duration-300">
               <!-- Icon: Storage -->
               <svg class="w-6 h-6 text-info-600 dark:text-info-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H5C4.46957 17 3.96086 16.7893 3.58579 16.4142C3.21071 16.0391 3 15.5304 3 15M21 15V9C21 8.46957 20.7893 7.96086 20.4142 7.58579C20.0391 7.21071 19.5304 7 19 7H5C4.46957 7 3.96086 7.21071 3.58579 7.58579C3.21071 7.96086 3 8.46957 3 9V15M21 15C21 14.4696 20.7893 13.9609 20.4142 13.5858C20.0391 13.2107 19.5304 13 19 13H5C4.46957 13 3.96086 13.2107 3.58579 13.5858C3.21071 13.9609 3 14.4696 3 15" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
             </div>
             <span class="text-[10px] font-mono opacity-40">DATA</span>
           </div>

           <div class="relative z-10">
             <h4 class="text-xl font-bold mb-2">SQLite</h4>
             <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
               The vault. Zero latency, WAL mode enabled by default.
             </p>
             <div class="mt-4 flex items-center gap-2">
                 <span class="text-[10px] font-mono bg-info-500/10 text-info-600 dark:text-info-400 px-2 py-1 rounded">WAL MODE</span>
                 <span class="text-[10px] font-mono opacity-50">Local file</span>
             </div>
           </div>
        </div>

        <!-- Card 6: Nara CLI -->
        <div class="group relative h-64 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-6 flex flex-col justify-between transition-all duration-500 overflow-hidden rounded-2xl">
           <!-- Distinct styling for the CLI card -->
           <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
           
           <div class="relative z-10 flex justify-between items-start">
             <div class="p-2 bg-white/10 dark:bg-black/5 rounded-lg border border-white/10 dark:border-black/5 group-hover:scale-110 transition-transform duration-300">
               <!-- Icon: Terminal -->
               <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4 17L10 11L4 5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M12 19H20" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
             </div>
             <span class="text-[10px] font-mono opacity-60">TOOLING</span>
           </div>

           <div class="relative z-10">
             <h4 class="text-xl font-bold mb-2">Nara CLI</h4>
             <p class="text-xs opacity-80 leading-relaxed">
               The command. Orchestrate your entire stack instantly.
             </p>
             <div class="mt-4 font-mono text-[10px] bg-black/20 dark:bg-white/20 p-2 rounded">
                <span class="opacity-50">$</span> nara new my-app
             </div>
           </div>
        </div>
     </div>
     </div>
  </section>



  <!-- Section: The Complete Toolkit (Battery Pack) -->
  <section class="py-32 px-6 sm:px-12 lg:px-24 bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-white/5">
     <div class="mb-20">
        <h3 class="text-4xl sm:text-6xl font-bold tracking-tighter mb-6">
          BATTERIES INCLUDED.<br/>
          <span class="text-slate-400">WEAPONIZED.</span>
        </h3>
        <p class="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
          Not a skeleton. A nervous system. Wired for speed. Ready for war.
        </p>
     </div>

     <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-16 max-w-5xl mx-auto">
        <!-- Feature 1: Auth -->
        <div class="group p-8 border border-slate-200 dark:border-white/5 rounded-3xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-300">
           <div class="h-12 w-12 bg-slate-900 dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center mb-6">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <path d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke-linecap="round" stroke-linejoin="round"/>
                 <path d="M12 14C8.13401 14 5 17.134 5 21H19C19 17.134 15.866 14 12 14Z" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
           </div>
           <h4 class="text-2xl font-bold mb-3">Authentication</h4>
           <p class="text-base text-slate-500 dark:text-slate-400 leading-relaxed">
             Session-based auth tailored for Inertia. No JWT headaches. Secure, HTTP-only cookies out of the box.
           </p>
        </div>

        <!-- Feature 2: Real-time -->
        <div class="group p-8 border border-slate-200 dark:border-white/5 rounded-3xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-300">
           <div class="h-12 w-12 bg-slate-900 dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center mb-6">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
           </div>
           <h4 class="text-2xl font-bold mb-3">Real-time</h4>
           <p class="text-base text-slate-500 dark:text-slate-400 leading-relaxed">
             Built on uWebSockets.js. Broadcast events to thousands of clients with microsecond latency.
           </p>
        </div>

        <!-- Feature 3: Security -->
        <div class="group p-8 border border-slate-200 dark:border-white/5 rounded-3xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-300">
           <div class="h-12 w-12 bg-slate-900 dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center mb-6">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
           </div>
           <h4 class="text-2xl font-bold mb-3">Ironclad Security</h4>
           <p class="text-base text-slate-500 dark:text-slate-400 leading-relaxed">
             CSRF protection, rate limiting, and parameter pollution sanitization enabled by default.
           </p>
        </div>

        <!-- Feature 4: Queues -->
        <div class="group p-8 border border-slate-200 dark:border-white/5 rounded-3xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-300">
           <div class="h-12 w-12 bg-slate-900 dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center mb-6">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <path d="M19 11H5M19 11C20.1046 11 21 11.8954 21 13V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V13C3 11.8954 3.89543 11 5 11M19 11V9C19 7.89543 18.1046 7 17 7M5 11V9C5 7.89543 5.89543 7 7 7M7 7V5C7 3.89543 7.89543 3 9 3H15C16.1046 3 17 3.89543 17 5V7M7 7H17" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
           </div>
           <h4 class="text-2xl font-bold mb-3">Job Queues</h4>
           <p class="text-base text-slate-500 dark:text-slate-400 leading-relaxed">
             Asynchronous job processing backed by Redis or simple in-memory drivers.
           </p>
        </div>
     </div>
  </section>

  <!-- Giant Kinetic CTA & Footer -->
  <section class="relative bg-white dark:bg-black text-slate-900 dark:text-white overflow-hidden flex flex-col transition-colors duration-500">
     <!-- Background Effects -->
     <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(var(--color-primary-rgb,16,185,129),0.15),_transparent_70%)]"></div>
     
     <!-- Light Mode Grid -->
     <div class="absolute inset-0 opacity-20 dark:opacity-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
     
     <!-- Dark Mode Grid -->
     <div class="absolute inset-0 opacity-0 dark:opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>

     <!-- CTA Content -->
     <div class="relative z-10 pt-32 pb-20 px-6 sm:px-12 lg:px-24 flex flex-col items-center text-center">
        <h2 class="text-[12vw] sm:text-[14vw] leading-[0.8] font-bold tracking-tighter select-none animate-pulse text-slate-900 dark:text-white">
          UNLEASH
        </h2>
        
        <div class="mt-16 flex flex-col items-center gap-10">
           <p class="text-xl sm:text-2xl font-serif italic text-slate-500 dark:text-slate-400 max-w-lg">
             The metal is cold. The code is hot. <br/>
             Your turn to strike.
           </p>

           <div class="flex flex-col sm:flex-row items-center gap-6">
              <a href="/docs" class="group relative px-10 py-5 bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-lg tracking-tight overflow-hidden rounded-full hover:scale-105 transition-transform duration-300">
                 <span class="relative z-10 group-hover:text-white transition-colors duration-300">START BUILDING</span>
                 <div class="absolute inset-0 bg-primary-600 transform scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-bottom"></div>
              </a>
              
              <button type="button" class="flex items-center gap-3 px-6 py-4 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 backdrop-blur-sm hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-copy group/cmd" on:click={() => navigator.clipboard.writeText('npm create nara-app@latest')}>
                 <span class="font-mono text-sm text-primary-600 dark:text-primary-400">$ npm create nara-app@latest</span>
                 <svg class="w-4 h-4 text-slate-400 dark:text-white/50 group-hover/cmd:text-slate-600 dark:group-hover/cmd:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 17.9291C8 17.9291 9.77123 18.061 11.0264 16.5985C12.2815 15.1361 11.2314 13.9142 11.2314 13.9142C11.2314 13.9142 10.1558 13.4544 11.2314 11.7275C12.3071 10.0007 14.1534 10.0007 14.1534 10.0007M8 17.9291C8 17.9291 6.57703 16.9234 6.57703 14.9234C6.57703 13.3308 7.37873 12.3925 8 11.9649M8 17.9291C8 18.8465 7.15197 19.3465 6.57703 19.3465C5.71453 19.3465 5 18.632 5 17.7695V6.23047C5 5.36797 5.71453 4.65345 6.57703 4.65345C7.15197 4.65345 8 5.15345 8 6.07085M8 6.07085V11.9649M8 6.07085C8 6.07085 9.77123 5.93895 11.0264 7.4014C12.2815 8.86386 11.2314 10.0858 11.2314 10.0858M14.1534 10.0007L16.2305 13.9142M14.1534 10.0007H19V6.23047C19 5.36797 18.2855 4.65345 17.423 4.65345H14.1534" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
           </div>
        </div>
     </div>

     <!-- Footer Navigation -->
     <div class="relative z-10 border-t border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/50 backdrop-blur-md">
        
        
        <div class="px-6 sm:px-12 lg:px-24 py-6 border-t border-slate-100 dark:border-white/5 flex justify-between items-center text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
           <span>&copy; 2025 MasRama</span>
           <span>v1.0.0</span>
        </div>
     </div>
  </section>
</div>

<style>
  /* Custom scrollbar hiding for cleaner look if needed, though mostly standard tailwind used */
  :global(html) {
    scroll-behavior: smooth;
  }
</style>
