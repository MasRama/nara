<script lang="ts">
  import { inertia, page } from '@inertiajs/svelte'
  import { fade, fly } from 'svelte/transition'
  import DarkModeToggle from '../Components/DarkModeToggle.svelte'
  import { Card, CardContent } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'

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

<div class="min-h-screen bg-background text-foreground transition-colors duration-500 overflow-x-hidden">
  
  <nav class="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-start transition-all duration-500 {scrolled ? 'bg-background/80 backdrop-blur-md border-b border-border py-4' : 'text-foreground'}">
    <div class="flex flex-col relative z-10">
      <a href="/" class="text-xl font-bold tracking-tighter hover:opacity-70 transition-opacity">NARA.</a>
    </div>

    <div class="flex items-center gap-6 text-sm font-medium relative z-10">
      <a href="https://github.com/MasRama/nara" target="_blank" class="hidden sm:block hover:underline decoration-1 underline-offset-4">GitHub</a>
      <a href="https://github.com/MasRama/nara#readme" target="_blank" class="hidden sm:block hover:underline decoration-1 underline-offset-4">Docs</a>
      
      <div class="h-4 w-px bg-border hidden sm:block"></div>

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

  <header class="relative min-h-screen flex flex-col justify-center px-6 sm:px-12 lg:px-24 pt-20">
    <div class="max-w-[90rem] mx-auto w-full">
      <div in:fly={{ y: 50, duration: 1000, delay: 200 }} class="flex flex-col gap-2">
        <h1 class="text-[13vw] leading-[0.8] font-bold tracking-tighter -ml-[0.05em]">
          PURE
          <span class="block text-primary">
            SPEED
          </span>
        </h1>
      </div>

      <div class="mt-12 sm:mt-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
        <div class="lg:col-span-5 text-lg sm:text-xl leading-relaxed font-serif italic text-muted-foreground">
          <p in:fly={{ y: 20, duration: 1000, delay: 600 }}>
            "Complexity is the enemy of execution. Nara strips away the layers to reveal the raw power of the metal."
          </p>
        </div>
        <div class="lg:col-span-7 flex flex-col items-start lg:items-end gap-6">
          <div class="flex items-center gap-4" in:fly={{ y: 20, duration: 1000, delay: 800 }}>
            <span class="text-xs uppercase tracking-widest opacity-50">Benchmarks</span>
            <div class="h-px w-12 bg-border"></div>
            <span class="font-mono text-primary">258k req/s</span>
          </div>
          
          <div in:fly={{ y: 20, duration: 1000, delay: 1000 }}>
            {#if !user}
              <a href="/register" use:inertia>
                <Button size="lg" class="rounded-full px-8 py-6 font-bold tracking-wide hover:scale-105 active:scale-95 transition-transform text-lg">START BUILDING</Button>
              </a>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="absolute bottom-12 left-6 sm:left-12 animate-bounce opacity-50">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M7 13l5 5 5-5M7 6l5 5 5-5"/>
      </svg>
    </div>
  </header>

  <section class="py-32 px-6 sm:px-12 lg:px-24 bg-card text-card-foreground">
    <div class="max-w-6xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-20">
        <div>
          <span class="block text-xs font-bold uppercase tracking-[0.2em] text-primary mb-8">The Manifesto</span>
          <h2 class="text-5xl sm:text-6xl font-bold tracking-tighter leading-none mb-12">
            Return to <br/>
            <span class="font-serif italic font-normal text-muted-foreground">Craftsmanship.</span>
          </h2>
        </div>
        <div class="space-y-8 text-lg sm:text-xl leading-relaxed text-muted-foreground">
          <p>
            We built Nara because we were tired. Tired of configuration files that are longer than the business logic. Tired of "optimizing" things that shouldn't be slow in the first place.
          </p>
          <p>
            Nara is <strong class="text-foreground">opinionated</strong>. It chooses the best tools—HyperExpress for the server, SQLite for the data, Svelte for the interface—and tunes them to sing in perfect harmony.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="py-24 sm:py-32 border-y border-border relative overflow-hidden bg-background">
    <div class="px-6 sm:px-12 lg:px-24 mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
       <div>
         <span class="block text-xs font-bold uppercase tracking-[0.2em] text-primary mb-4">The Powerhouse</span>
         <h3 class="text-5xl sm:text-7xl font-bold tracking-tighter text-foreground">
          ARSENAL
        </h3>
       </div>
       <p class="text-muted-foreground max-w-md text-sm sm:text-base leading-relaxed">
         Precision tools for digital artisans. <br class="hidden sm:block" />
         Forged for speed, honed for control.
       </p>
    </div>
    
    <div class="px-6 sm:px-12 lg:px-24">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <Card class="relative overflow-hidden group hover:border-primary/50 transition-colors duration-500 h-64 flex flex-col">
          <div class="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500"></div>
          <CardContent class="p-6 flex flex-col h-full relative z-10">
            <div class="flex justify-between items-start mb-auto">
              <div class="p-2 bg-secondary rounded-lg border border-border group-hover:scale-110 transition-transform duration-300">
                <svg class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                   <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="text-[10px] font-mono opacity-40">BACKEND</span>
            </div>

            <div>
              <div class="flex items-baseline gap-2 mb-2">
                 <h4 class="text-xl font-bold">HyperExpress</h4>
                 <Badge variant="secondary" class="text-[10px] px-1.5 py-0.5">v6.x</Badge>
              </div>
              <p class="text-xs text-muted-foreground leading-relaxed mb-4">
                The engine. Raw metal performance, zero compromise.
              </p>
              <div class="w-full h-1 bg-secondary rounded-full overflow-hidden">
                <div class="h-full bg-primary w-[98%]"></div>
              </div>
              <div class="flex justify-between text-[9px] font-mono mt-2 opacity-60">
                 <span>BENCHMARK</span>
                 <span>250K REQ/S</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="relative overflow-hidden group hover:border-primary/50 transition-colors duration-500 h-64 flex flex-col">
          <div class="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500"></div>
          <CardContent class="p-6 flex flex-col h-full relative z-10">
            <div class="flex justify-between items-start mb-auto">
              <div class="p-2 bg-secondary rounded-lg border border-border group-hover:scale-110 transition-transform duration-300">
                <svg class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                   <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke-linecap="round" stroke-linejoin="round"/>
                   <path d="M2 17L12 22L22 17" stroke-linecap="round" stroke-linejoin="round"/>
                   <path d="M2 12L12 17L22 12" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="text-[10px] font-mono opacity-40">PROTOCOL</span>
            </div>

            <div>
              <h4 class="text-xl font-bold mb-2">Inertia.js</h4>
              <p class="text-xs text-muted-foreground leading-relaxed">
                The bridge. Monolith simplicity, SPA fluidity.
              </p>
              <div class="mt-4 flex gap-2">
                 <Badge variant="outline" class="text-[10px]">No API</Badge>
                 <Badge variant="outline" class="text-[10px]">Shared Data</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="relative overflow-hidden group hover:border-primary/50 transition-colors duration-500 h-64 flex flex-col">
          <div class="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500"></div>
          <CardContent class="p-6 flex flex-col h-full relative z-10">
            <div class="flex justify-between items-start mb-auto">
              <div class="p-2 bg-secondary rounded-lg border border-border group-hover:scale-110 transition-transform duration-300">
                <svg class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                   <path d="M16 18L22 12L16 6" stroke-linecap="round" stroke-linejoin="round"/>
                   <path d="M8 6L2 12L8 18" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="text-[10px] font-mono opacity-40">FRONTEND</span>
            </div>

            <div>
              <h4 class="text-xl font-bold mb-2">Svelte</h4>
              <p class="text-xs text-muted-foreground leading-relaxed">
                The canvas. Pure reactivity, no virtual DOM overhead.
              </p>
              <div class="mt-4 grid grid-cols-2 gap-2 text-[10px] font-mono opacity-60">
                 <div class="flex items-center gap-1">
                     <div class="w-1.5 h-1.5 rounded-full bg-primary"></div>
                     <span>Reactive</span>
                 </div>
                 <div class="flex items-center gap-1">
                     <div class="w-1.5 h-1.5 rounded-full bg-primary"></div>
                     <span>Tiny Bundle</span>
                 </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="relative overflow-hidden group hover:border-primary/50 transition-colors duration-500 h-64 flex flex-col">
          <div class="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500"></div>
          <CardContent class="p-6 flex flex-col h-full relative z-10">
            <div class="flex justify-between items-start mb-auto">
              <div class="p-2 bg-secondary rounded-lg border border-border group-hover:scale-110 transition-transform duration-300">
                <svg class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                   <path d="M21 12V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19H12" stroke-linecap="round" stroke-linejoin="round"/>
                   <path d="M21 5H3" stroke-linecap="round" stroke-linejoin="round"/>
                   <path d="M7 19V5" stroke-linecap="round" stroke-linejoin="round"/>
                   <circle cx="18" cy="18" r="3" stroke-linecap="round" stroke-linejoin="round"/>
                   <path d="M20.2 20.2L22 22" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="text-[10px] font-mono opacity-40">ORM</span>
            </div>

            <div>
              <h4 class="text-xl font-bold mb-2">Knex.js</h4>
              <p class="text-xs text-muted-foreground leading-relaxed">
                The architect. SQL control with TypeScript precision.
              </p>
              <div class="mt-auto pt-4 space-y-1">
                 <div class="h-1 w-3/4 bg-secondary rounded-full"></div>
                 <div class="h-1 w-1/2 bg-secondary rounded-full"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="relative overflow-hidden group hover:border-primary/50 transition-colors duration-500 h-64 flex flex-col">
          <div class="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500"></div>
          <CardContent class="p-6 flex flex-col h-full relative z-10">
            <div class="flex justify-between items-start mb-auto">
              <div class="p-2 bg-secondary rounded-lg border border-border group-hover:scale-110 transition-transform duration-300">
                <svg class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                   <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H5C4.46957 17 3.96086 16.7893 3.58579 16.4142C3.21071 16.0391 3 15.5304 3 15M21 15V9C21 8.46957 20.7893 7.96086 20.4142 7.58579C20.0391 7.21071 19.5304 7 19 7H5C4.46957 7 3.96086 7.21071 3.58579 7.58579C3.21071 7.96086 3 8.46957 3 9V15M21 15C21 14.4696 20.7893 13.9609 20.4142 13.5858C20.0391 13.2107 19.5304 13 19 13H5C4.46957 13 3.96086 13.2107 3.58579 13.5858C3.21071 13.9609 3 14.4696 3 15" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="text-[10px] font-mono opacity-40">DATA</span>
            </div>

            <div>
              <h4 class="text-xl font-bold mb-2">SQLite</h4>
              <p class="text-xs text-muted-foreground leading-relaxed">
                The vault. Zero latency, WAL mode enabled by default.
              </p>
              <div class="mt-4 flex items-center gap-2">
                  <Badge variant="secondary" class="text-[10px] font-mono">WAL MODE</Badge>
                  <span class="text-[10px] font-mono opacity-50">Local file</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card class="relative overflow-hidden group hover:border-primary/50 transition-colors duration-500 h-64 flex flex-col bg-primary text-primary-foreground border-none">
          <CardContent class="p-6 flex flex-col h-full relative z-10">
            <div class="flex justify-between items-start mb-auto">
              <div class="p-2 bg-primary-foreground/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                   <path d="M4 17L10 11L4 5" stroke-linecap="round" stroke-linejoin="round"/>
                   <path d="M12 19H20" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="text-[10px] font-mono opacity-60">TOOLING</span>
            </div>

            <div>
              <h4 class="text-xl font-bold mb-2">Nara CLI</h4>
              <p class="text-xs opacity-80 leading-relaxed">
                The command. Orchestrate your entire stack instantly.
              </p>
              <div class="mt-4 font-mono text-[10px] bg-background/20 p-2 rounded">
                 <span class="opacity-50">$</span> nara new my-app
              </div>
            </div>
          </CardContent>
        </Card>
     </div>
    </div>
  </section>

  <section class="py-32 px-6 sm:px-12 lg:px-24 bg-card border-t border-border text-card-foreground">
     <div class="mb-20">
        <h3 class="text-4xl sm:text-6xl font-bold tracking-tighter mb-6">
          BATTERIES INCLUDED.<br/>
          <span class="text-muted-foreground">WEAPONIZED.</span>
        </h3>
        <p class="text-lg text-muted-foreground max-w-2xl">
          Not a skeleton. A nervous system. Wired for speed. Ready for war.
        </p>
     </div>

     <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-16 max-w-5xl mx-auto">
        <Card class="group hover:bg-muted/50 transition-all duration-300 border-border rounded-3xl">
          <CardContent class="p-8">
            <div class="h-12 w-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mb-6">
               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M12 14C8.13401 14 5 17.134 5 21H19C19 17.134 15.866 14 12 14Z" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
            </div>
            <h4 class="text-2xl font-bold mb-3">Authentication</h4>
            <p class="text-base text-muted-foreground leading-relaxed">
              Session-based auth tailored for Inertia. No JWT headaches. Secure, HTTP-only cookies out of the box.
            </p>
          </CardContent>
        </Card>

        <Card class="group hover:bg-muted/50 transition-all duration-300 border-border rounded-3xl">
          <CardContent class="p-8">
            <div class="h-12 w-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mb-6">
               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
            </div>
            <h4 class="text-2xl font-bold mb-3">Real-time</h4>
            <p class="text-base text-muted-foreground leading-relaxed">
              Built on uWebSockets.js. Broadcast events to thousands of clients with microsecond latency.
            </p>
          </CardContent>
        </Card>

        <Card class="group hover:bg-muted/50 transition-all duration-300 border-border rounded-3xl">
          <CardContent class="p-8">
            <div class="h-12 w-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mb-6">
               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
            </div>
            <h4 class="text-2xl font-bold mb-3">Ironclad Security</h4>
            <p class="text-base text-muted-foreground leading-relaxed">
              CSRF protection, rate limiting, and parameter pollution sanitization enabled by default.
            </p>
          </CardContent>
        </Card>

        <Card class="group hover:bg-muted/50 transition-all duration-300 border-border rounded-3xl">
          <CardContent class="p-8">
            <div class="h-12 w-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mb-6">
               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 11H5M19 11C20.1046 11 21 11.8954 21 13V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V13C3 11.8954 3.89543 11 5 11M19 11V9C19 7.89543 18.1046 7 17 7M5 11V9C5 7.89543 5.89543 7 7 7M7 7V5C7 3.89543 7.89543 3 9 3H15C16.1046 3 17 3.89543 17 5V7M7 7H17" stroke-linecap="round" stroke-linejoin="round"/>
               </svg>
            </div>
            <h4 class="text-2xl font-bold mb-3">Job Queues</h4>
            <p class="text-base text-muted-foreground leading-relaxed">
              Asynchronous job processing backed by Redis or simple in-memory drivers.
            </p>
          </CardContent>
        </Card>
     </div>
  </section>

  <section class="relative bg-background text-foreground overflow-hidden flex flex-col transition-colors duration-500">
     <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(var(--color-primary-rgb,16,185,129),0.15),_transparent_70%)]"></div>
     
     <div class="absolute inset-0 opacity-20 dark:opacity-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
     
     <div class="absolute inset-0 opacity-0 dark:opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>

     <div class="relative z-10 pt-32 pb-20 px-6 sm:px-12 lg:px-24 flex flex-col items-center text-center">
        <h2 class="text-[12vw] sm:text-[14vw] leading-[0.8] font-bold tracking-tighter select-none animate-pulse text-foreground">
          UNLEASH
        </h2>
        
        <div class="mt-16 flex flex-col items-center gap-10">
           <p class="text-xl sm:text-2xl font-serif italic text-muted-foreground max-w-lg">
             The metal is cold. The code is hot. <br/>
             Your turn to strike.
           </p>

           <div class="flex flex-col sm:flex-row items-center gap-6">
              <a href="/docs">
                <Button size="lg" class="rounded-full px-10 py-8 font-bold tracking-tight text-lg hover:scale-105 transition-transform duration-300">START BUILDING</Button>
              </a>
              
              <Button variant="outline" size="lg" class="rounded-full px-6 py-8 flex items-center gap-3 bg-secondary/50 backdrop-blur-sm" on:click={() => navigator.clipboard.writeText('npm create nara-app@latest')}>
                 <span class="font-mono text-sm text-primary">$ npm create nara-app@latest</span>
                 <svg class="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 17.9291C8 17.9291 9.77123 18.061 11.0264 16.5985C12.2815 15.1361 11.2314 13.9142 11.2314 13.9142C11.2314 13.9142 10.1558 13.4544 11.2314 11.7275C12.3071 10.0007 14.1534 10.0007 14.1534 10.0007M8 17.9291C8 17.9291 6.57703 16.9234 6.57703 14.9234C6.57703 13.3308 7.37873 12.3925 8 11.9649M8 17.9291C8 18.8465 7.15197 19.3465 6.57703 19.3465C5.71453 19.3465 5 18.632 5 17.7695V6.23047C5 5.36797 5.71453 4.65345 6.57703 4.65345C7.15197 4.65345 8 5.15345 8 6.07085M8 6.07085V11.9649M8 6.07085C8 6.07085 9.77123 5.93895 11.0264 7.4014C12.2815 8.86386 11.2314 10.0858 11.2314 10.0858M14.1534 10.0007L16.2305 13.9142M14.1534 10.0007H19V6.23047C19 5.36797 18.2855 4.65345 17.423 4.65345H14.1534" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </Button>
           </div>
        </div>
     </div>

     <div class="relative z-10 border-t border-border bg-background/50 backdrop-blur-md">
        <div class="px-6 sm:px-12 lg:px-24 py-6 flex justify-between items-center text-[10px] uppercase tracking-widest text-muted-foreground">
           <span>&copy; 2025 MasRama</span>
           <span>v1.0.0</span>
        </div>
     </div>
  </section>
</div>

<style>
  :global(html) {
    scroll-behavior: smooth;
  }
</style>