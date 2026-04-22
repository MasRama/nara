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

  $: scrolled = scrollY > 50;
</script>

<svelte:window bind:scrollY bind:innerHeight />

<div class="min-h-screen bg-background text-foreground font-body transition-colors duration-500 overflow-x-hidden selection:bg-primary/20 selection:text-primary">
  
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

  <header class="relative min-h-screen flex flex-col justify-center px-6 sm:px-12 lg:px-24 pt-20">
    <div class="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]"></div>
    
    <div class="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>

    <div class="max-w-[90rem] mx-auto w-full relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      <div class="lg:col-span-7 flex flex-col items-start gap-8">
        
        <div in:fly={{ y: 20, duration: 1000, delay: 200 }}>
          <Badge variant="outline" class="font-mono-accent text-xs px-3 py-1 text-primary border-primary/20 bg-primary/5 rounded-full mb-6">
            v1.0.0 is now available
          </Badge>
          
          <h1 class="text-5xl sm:text-6xl lg:text-7xl font-heading font-bold tracking-tighter leading-[1.1] text-foreground" style="font-feature-settings: 'ss01'">
            The Right <br />
            <span class="text-primary">Foundation.</span>
          </h1>
        </div>

        <p in:fly={{ y: 20, duration: 1000, delay: 400 }} class="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl font-body">
          A TypeScript full-stack framework combining HyperExpress, Svelte 5, and Inertia.js. Designed for developers who value clarity, performance, and craftsmanship.
        </p>

        <div in:fly={{ y: 20, duration: 1000, delay: 600 }} class="flex flex-col sm:flex-row items-start sm:items-center gap-6 mt-4">
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
          
          <div class="flex items-center gap-4 text-sm">
            <span class="w-12 h-px bg-border"></span>
            <span class="text-muted-foreground font-mono-accent tracking-tight">258k req/s HTTP engine</span>
          </div>
        </div>
      </div>
      
      <div class="lg:col-span-5 hidden lg:grid grid-cols-2 grid-rows-4 gap-3 h-[520px]" in:fly={{ x: 30, duration: 1000, delay: 800 }}>

        <div class="row-span-2 bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 transition-colors duration-300 group">
          <span class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">HTTP Throughput</span>
          <div>
            <div class="text-4xl font-heading font-bold tracking-tighter text-foreground group-hover:text-primary transition-colors duration-300">258k</div>
            <div class="text-xs font-mono-accent text-muted-foreground mt-1">req / second</div>
          </div>
          <div class="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <div class="h-full bg-primary rounded-full w-[96%] bento-bar"></div>
          </div>
        </div>

        <div class="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 transition-colors duration-300">
          <span class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">Language</span>
          <div class="flex items-end justify-between">
            <span class="text-2xl font-heading font-bold tracking-tight text-foreground">TypeScript</span>
            <svg class="w-6 h-6 text-[#3178c6] shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>
          </div>
        </div>

        <div class="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 transition-colors duration-300">
          <span class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">Pattern</span>
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="font-mono-accent text-[10px] px-2 py-0.5 bg-secondary rounded text-muted-foreground">M</span>
              <span class="text-xs text-muted-foreground">Model</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-mono-accent text-[10px] px-2 py-0.5 bg-secondary rounded text-muted-foreground">V</span>
              <span class="text-xs text-muted-foreground">View</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-mono-accent text-[10px] px-2 py-0.5 bg-primary/20 rounded text-primary">C</span>
              <span class="text-xs text-foreground font-medium">Controller</span>
            </div>
          </div>
        </div>

        <div class="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 transition-colors duration-300 group">
          <span class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">CLI Commands</span>
          <div>
            <div class="text-4xl font-heading font-bold tracking-tighter text-foreground group-hover:text-primary transition-colors duration-300">22</div>
            <div class="text-xs font-mono-accent text-muted-foreground mt-1">native commands</div>
          </div>
        </div>

        <div class="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 transition-colors duration-300 group">
          <span class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">API Layer</span>
          <div>
            <div class="text-2xl font-heading font-bold tracking-tight text-foreground group-hover:text-primary transition-colors duration-300">Zero<span class="text-primary">.</span></div>
            <div class="text-xs font-mono-accent text-muted-foreground mt-1 leading-relaxed">No REST API needed — server to UI in one move.</div>
          </div>
        </div>

        <div class="col-span-2 bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-center justify-between hover:bg-primary/10 transition-colors duration-300 group">
          <div class="flex flex-col gap-1">
            <span class="font-mono-accent text-[10px] uppercase tracking-widest text-primary">Architecture</span>
            <span class="text-xl font-heading font-bold tracking-tight text-foreground group-hover:text-primary transition-colors duration-300">Full Stack<span class="text-primary">.</span></span>
          </div>
          <div class="flex items-center gap-2 text-[11px] font-mono-accent text-muted-foreground">
            <span class="px-2.5 py-1 bg-background/60 border border-border rounded-full text-foreground">Backend</span>
            <svg class="w-3.5 h-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="px-2.5 py-1 bg-background/60 border border-border rounded-full text-foreground">Frontend</span>
            <svg class="w-3.5 h-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary">One Codebase</span>
          </div>
        </div>

      </div>
    </div>
  </header>

  <section class="py-32 px-6 sm:px-12 lg:px-24 bg-card/30 border-y border-border">
    <div class="max-w-6xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
        <div>
          <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-6">Philosophy</span>
          <h2 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter leading-tight" style="font-feature-settings: 'ss01'">
            Deliberate <br/>
            Craft.
          </h2>
        </div>
        <div class="space-y-8 text-lg text-muted-foreground font-body leading-relaxed">
          <p>
            We believe a framework should provide a solid foundation without dictating your every move. It should disappear when you don't need it and provide immense leverage when you do.
          </p>
          <p>
            Nara curates exceptional tools—HyperExpress for unyielding server performance, SQLite for zero-latency data, Svelte 5 for elegant reactivity—and integrates them seamlessly. No bloated configuration. Just clarity and momentum.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="py-32 px-6 sm:px-12 lg:px-24 relative overflow-hidden bg-background">
    <div class="max-w-[90rem] mx-auto">
      <div class="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
         <div>
           <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-4">Architecture</span>
           <h3 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter text-foreground" style="font-feature-settings: 'ss01'">
            The Stack
          </h3>
         </div>
         <p class="text-muted-foreground max-w-md text-base leading-relaxed font-body">
           Precision tools curated for developers who care about performance, safety, and developer experience.
         </p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        <Card class="group border-none bg-transparent shadow-none">
          <CardContent class="p-0 flex flex-col h-full border-l-2 border-border group-hover:border-primary pl-6 py-2 transition-colors duration-300">
            <div class="flex justify-between items-start mb-6">
              <span class="text-xs font-mono-accent tracking-wider text-muted-foreground">HTTP Engine</span>
            </div>
            <div>
              <div class="flex items-center gap-3 mb-3">
                 <h4 class="text-xl font-heading font-semibold tracking-tight text-foreground">HyperExpress</h4>
                 <Badge variant="outline" class="text-[10px] font-mono-accent px-1.5 py-0">v6</Badge>
              </div>
              <p class="text-sm text-muted-foreground leading-relaxed">
                High-performance HTTP built on uWebSockets — handles 250k+ req/s without a sweat.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card class="group border-none bg-transparent shadow-none">
          <CardContent class="p-0 flex flex-col h-full border-l-2 border-border group-hover:border-primary pl-6 py-2 transition-colors duration-300">
            <div class="flex justify-between items-start mb-6">
              <span class="text-xs font-mono-accent tracking-wider text-muted-foreground">Routing Bridge</span>
            </div>
            <div>
              <h4 class="text-xl font-heading font-semibold tracking-tight text-foreground mb-3">Inertia.js</h4>
              <p class="text-sm text-muted-foreground leading-relaxed">
                The bridge connecting backend controllers directly to Svelte pages. Monolithic simplicity with SPA fluidity.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card class="group border-none bg-transparent shadow-none">
          <CardContent class="p-0 flex flex-col h-full border-l-2 border-border group-hover:border-primary pl-6 py-2 transition-colors duration-300">
            <div class="flex justify-between items-start mb-6">
              <span class="text-xs font-mono-accent tracking-wider text-muted-foreground">Frontend</span>
            </div>
            <div>
              <h4 class="text-xl font-heading font-semibold tracking-tight text-foreground mb-3">Svelte 5</h4>
              <p class="text-sm text-muted-foreground leading-relaxed">
                Elegant client-side reactivity using runes. A vanishingly small footprint with no virtual DOM overhead.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card class="group border-none bg-transparent shadow-none">
          <CardContent class="p-0 flex flex-col h-full border-l-2 border-border group-hover:border-primary pl-6 py-2 transition-colors duration-300">
            <div class="flex justify-between items-start mb-6">
              <span class="text-xs font-mono-accent tracking-wider text-muted-foreground">Query Builder</span>
            </div>
            <div>
              <h4 class="text-xl font-heading font-semibold tracking-tight text-foreground mb-3">Knex.js</h4>
              <p class="text-sm text-muted-foreground leading-relaxed">
                A "batteries included" query builder. Complete SQL control enhanced by precise TypeScript definitions.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card class="group border-none bg-transparent shadow-none">
          <CardContent class="p-0 flex flex-col h-full border-l-2 border-border group-hover:border-primary pl-6 py-2 transition-colors duration-300">
            <div class="flex justify-between items-start mb-6">
              <span class="text-xs font-mono-accent tracking-wider text-muted-foreground">Database</span>
            </div>
            <div>
              <h4 class="text-xl font-heading font-semibold tracking-tight text-foreground mb-3">SQLite</h4>
              <p class="text-sm text-muted-foreground leading-relaxed">
                Zero-configuration local storage. WAL mode enabled by default for remarkable concurrent read performance.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card class="group border-none bg-transparent shadow-none">
          <CardContent class="p-0 flex flex-col h-full border-l-2 border-primary pl-6 py-2 transition-colors duration-300">
            <div class="flex justify-between items-start mb-6">
              <span class="text-xs font-mono-accent tracking-wider text-primary">Tooling</span>
            </div>
            <div>
              <h4 class="text-xl font-heading font-semibold tracking-tight text-foreground mb-3">Nara CLI</h4>
              <p class="text-sm text-muted-foreground leading-relaxed mb-4">
                Over 20 native commands to scaffold controllers, models, migrations, and manage database state instantly.
              </p>
              <div class="font-mono-accent text-[11px] bg-muted/50 p-2 rounded text-muted-foreground inline-block">
                 <span class="opacity-50">$</span> nara make:resource Post
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  </section>

  <section class="py-32 px-6 sm:px-12 lg:px-24 bg-card/30 border-t border-border">
     <div class="max-w-[90rem] mx-auto">
       <div class="mb-16 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
         <div>
           <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-4">Built-in</span>
           <h3 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter text-foreground" style="font-feature-settings: 'ss01'">
             Included by default.
           </h3>
         </div>
         <p class="text-muted-foreground max-w-sm text-base leading-relaxed font-body lg:text-right">
           Everything you need to ship — no hunting for packages, no glue code.
         </p>
       </div>

       <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

         <div class="group bg-background border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke-linecap="round" stroke-linejoin="round"/>
               <path d="M12 14C8.13401 14 5 17.134 5 21H19C19 17.134 15.866 14 12 14Z" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Authentication</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">Session auth, HTTP-only cookies, RBAC gates, and role-based policies — wired in from day one.</p>
           </div>
         </div>

         <div class="group bg-background border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Real-time</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">Built on uWebSockets.js — broadcast events to thousands of clients with microsecond latency.</p>
           </div>
         </div>

         <div class="group bg-background border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Security</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">CSRF (Double Submit), rate limiting per IP/user, XSS sanitization, and security headers — all on.</p>
           </div>
         </div>

         <div class="group bg-primary text-primary-foreground rounded-2xl p-6 flex flex-col gap-6 hover:opacity-95 transition-opacity duration-300">
           <div class="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
             <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H5C4.46957 17 3.96086 16.7893 3.58579 16.4142C3.21071 16.0391 3 15.5304 3 15M21 15V9C21 8.46957 20.7893 7.96086 20.4142 7.58579C20.0391 7.21071 19.5304 7 19 7H5C4.46957 7 3.96086 7.21071 3.58579 7.58579C3.21071 7.96086 3 8.46957 3 9V15M21 15C21 14.4696 20.7893 13.9609 20.4142 13.5858C20.0391 13.2107 19.5304 13 19 13H5C4.46957 13 3.96086 13.2107 3.58579 13.5858C3.21071 13.9609 3 14.4696 3 15" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight">Job Queues</h4>
             <p class="text-sm opacity-80 font-body leading-relaxed">Async job processing backed by Redis or in-memory drivers. No extra service needed to get started.</p>
           </div>
         </div>

         <div class="group bg-background border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M9 3H5C3.89543 3 3 3.89543 3 5V9M9 3H15M9 3V9M15 3H19C20.1046 3 21 3.89543 21 5V9M15 3V9M21 9V15M21 15V19C21 20.1046 20.1046 21 19 21H15M21 15H15M15 21H9M15 21V15M9 21H5C3.89543 21 3 20.1046 3 19V15M9 21V15M3 15V9M3 9H9M9 9H15M9 9V15M15 9H21M15 9V15M9 15H15" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Event System</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">Decoupled async event dispatcher. Fire events from anywhere, listen from anywhere — clean architecture.</p>
           </div>
         </div>

         <div class="group bg-background border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M4 17L10 11L4 5M12 19H20" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">CLI Scaffolding</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">22 native commands for models, controllers, migrations, seeders, and more. Scaffold in seconds.</p>
           </div>
         </div>

         <div class="group bg-background border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M8 9H16M8 13H14M8 17H11M6 3H18C19.1046 3 20 3.89543 20 5V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V5C4 3.89543 4.89543 3 6 3Z" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Form Requests</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">Dedicated request classes with authorization logic and typed validation rules, inspired by Laravel.</p>
           </div>
         </div>

         <div class="group bg-background border border-border rounded-2xl p-6 flex flex-col gap-6 hover:border-primary/40 hover:shadow-sm transition-all duration-300">
           <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
             <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke-linecap="round" stroke-linejoin="round"/>
               <path d="M9 12L11 14L15 10" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
           </div>
           <div>
             <h4 class="text-base font-heading font-semibold mb-2 tracking-tight text-foreground">Active Record</h4>
             <p class="text-sm text-muted-foreground font-body leading-relaxed">Typed models with built-in CRUD, auto timestamps, and a fluent Knex query builder underneath.</p>
           </div>
         </div>

       </div>
     </div>
  </section>

  <section class="relative bg-background text-foreground overflow-hidden py-40 flex flex-col items-center justify-center transition-colors duration-500">
     <div class="absolute inset-0 opacity-20 dark:opacity-[0.03] bg-[linear-gradient(rgba(0,0,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.1)_1px,transparent_1px)] bg-[size:3rem_3rem] dark:bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
     
     <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(var(--color-primary-rgb,16,185,129),0.05),_transparent_60%)] pointer-events-none"></div>

     <div class="relative z-10 px-6 max-w-3xl text-center flex flex-col items-center">
        <h2 class="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold tracking-tighter mb-8" style="font-feature-settings: 'ss01'">
          Begin Your Project
        </h2>
        
        <p class="text-lg sm:text-xl text-muted-foreground font-body mb-12">
          Experience a web framework crafted for developer productivity and uncompromised performance.
        </p>

        <div class="flex flex-col sm:flex-row items-center gap-4">
          <a href="/docs">
            <Button size="lg" class="rounded-full px-8 py-6 font-heading font-medium text-base hover:scale-105 transition-transform duration-300">
              Read Documentation
            </Button>
          </a>
          
          <Button variant="outline" size="lg" class="rounded-full px-6 py-6 flex items-center gap-3 bg-background/50 backdrop-blur-sm border-border hover:bg-muted/50 transition-colors" on:click={() => navigator.clipboard.writeText('npm create nara-app@latest')}>
             <span class="font-mono-accent text-sm text-foreground">$ npm create nara-app@latest</span>
             <svg class="w-4 h-4 text-muted-foreground ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 17.9291C8 17.9291 9.77123 18.061 11.0264 16.5985C12.2815 15.1361 11.2314 13.9142 11.2314 13.9142C11.2314 13.9142 10.1558 13.4544 11.2314 11.7275C12.3071 10.0007 14.1534 10.0007 14.1534 10.0007M8 17.9291C8 17.9291 6.57703 16.9234 6.57703 14.9234C6.57703 13.3308 7.37873 12.3925 8 11.9649M8 17.9291C8 18.8465 7.15197 19.3465 6.57703 19.3465C5.71453 19.3465 5 18.632 5 17.7695V6.23047C5 5.36797 5.71453 4.65345 6.57703 4.65345C7.15197 4.65345 8 5.15345 8 6.07085M8 6.07085V11.9649M8 6.07085C8 6.07085 9.77123 5.93895 11.0264 7.4014C12.2815 8.86386 11.2314 10.0858 11.2314 10.0858M14.1534 10.0007L16.2305 13.9142M14.1534 10.0007H19V6.23047C19 5.36797 18.2855 4.65345 17.423 4.65345H14.1534" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </Button>
        </div>
     </div>
  </section>

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
  .bento-bar {
    animation: bar-fill 1.4s cubic-bezier(0.4, 0, 0.2, 1) 1s both;
  }

  @keyframes bar-fill {
    from { width: 0%; }
    to { width: 96%; }
  }

  :global(html) {
    scroll-behavior: smooth;
  }
</style>