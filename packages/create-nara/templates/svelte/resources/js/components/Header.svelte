<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { page, router, inertia } from '@inertiajs/svelte';
  import { clickOutside } from '../components/helper';
  import DarkModeToggle from '../components/DarkModeToggle.svelte';

  interface User {
    id: string;
    name: string;
    email: string;
    is_admin: boolean;
  }

  interface MenuLink {
    href: string;
    label: string;
    group: string;
    show: boolean;
  }

  $: user = $page.props.user as User | undefined;
  let scrollY = 0;
  let isMenuOpen: boolean = false;

  export let group: string; 

  $: scrolled = scrollY > 50;

  $: menuLinks = [
    { href: '/dashboard', label: 'Overview', group: 'dashboard', show: true },  
    { href: '/users', label: 'Users', group: 'users', show: !!(user?.is_admin) },
    { href: '/profile', label: 'Profile', group: 'profile', show: !!user },
  ] as MenuLink[];
  
  $: visibleMenuLinks = menuLinks.filter((item) => item.show);

  function handleLogout(): void {
    router.post('/logout');
  }
</script>

<svelte:window bind:scrollY />

<header 
  class="fixed inset-x-0 top-0 z-50 transition-all duration-500 {scrolled 
    ? 'bg-white/90 dark:bg-surface-dark/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5' 
    : 'bg-white/90 dark:bg-surface-dark/95 backdrop-blur-xl'}"
>
  <nav class="px-6 sm:px-12 lg:px-24 py-5 flex items-center justify-between">
    
    <!-- Left: Brand + Nav -->
    <div class="flex items-center gap-10">
      <!-- Radical Brand -->
      <a 
        href="/" 
        use:inertia 
        class="group flex items-center gap-3"
      >
        <span class="text-xl font-bold tracking-tighter text-slate-900 dark:text-white group-hover:text-primary-500 transition-colors">
          NARA.
        </span>
        <span class="hidden sm:block text-[9px] uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 font-medium">
          Dashboard
        </span>
      </a>

      <!-- Desktop Navigation - Radical Style -->
      <div class="hidden md:flex items-center gap-1">
        {#each visibleMenuLinks as item, i}
          <a 
            use:inertia 
            href={item.href} 
            class="relative px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] transition-all duration-300
              {item.group === group 
                ? 'text-primary-500' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
          >
            {item.label}
            {#if item.group === group}
              <span class="absolute bottom-0 left-4 right-4 h-px bg-primary-500"></span>
            {/if}
          </a>
          {#if i < visibleMenuLinks.length - 1}
            <span class="w-px h-3 bg-slate-200 dark:bg-slate-700"></span>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-4">
      <!-- Current Page Indicator (Mobile) -->
      <span class="md:hidden text-[10px] uppercase tracking-[0.2em] text-primary-500 font-medium">
        {group}
      </span>

      <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
      
      <DarkModeToggle />

      <!-- Auth Actions -->
      <div class="hidden sm:flex items-center gap-3">
        {#if user && user.id}
          <div class="flex items-center gap-3">
            <span class="text-xs text-slate-500 dark:text-slate-400">
              {user.name}
            </span>
            <button 
              on:click={handleLogout}
              class="group relative px-5 py-2 text-xs font-bold uppercase tracking-wider overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 hover:border-red-500/50 dark:hover:border-red-500/50 transition-colors"
            >
              <span class="relative z-10 text-slate-600 dark:text-slate-300 group-hover:text-red-500 transition-colors">
                Logout
              </span>
            </button>
          </div>
        {:else}
          <a
            href="/login"
            use:inertia
            class="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Login
          </a>
          <a
            href="/register"
            use:inertia
            class="group relative px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-wider rounded-full overflow-hidden hover:scale-105 transition-transform"
          >
            <span class="relative z-10">Register</span>
            <div class="absolute inset-0 bg-primary-500 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </a>
        {/if}
      </div>

      <!-- Mobile Menu Button -->
      <button
        class="md:hidden relative w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 hover:border-primary-500/50 transition-colors text-slate-900 dark:text-white"
        on:click={() => isMenuOpen = !isMenuOpen}
        aria-label="Menu"
      >
        <div class="flex flex-col gap-1.5 w-4">
          <span class="block h-px bg-slate-900 dark:bg-white transition-transform duration-300 {isMenuOpen ? 'rotate-45 translate-y-[3.5px]' : ''}"></span>
          <span class="block h-px bg-slate-900 dark:bg-white transition-opacity duration-300 {isMenuOpen ? 'opacity-0' : ''}"></span>
          <span class="block h-px bg-slate-900 dark:bg-white transition-transform duration-300 {isMenuOpen ? '-rotate-45 -translate-y-[3.5px]' : ''}"></span>
        </div>
      </button>
    </div>
  </nav>
  
  </header>

<!-- Mobile Menu - Radical Full Screen (Outside header for proper z-index) -->
{#if isMenuOpen}
<div  
  transition:fade={{ duration: 200 }}
  class="fixed inset-0 bg-white dark:bg-surface-dark z-[9999] md:hidden overflow-y-auto"
  style="top: 0; left: 0; right: 0; bottom: 0;"
>
  <!-- Close Button -->
  <button
    class="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white z-10"
    on:click={() => isMenuOpen = false}
    aria-label="Close menu"
  >
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  <!-- Brand -->
  <div class="absolute top-6 left-6 z-10">
    <span class="text-xl font-bold tracking-tighter text-slate-900 dark:text-white">NARA.</span>
  </div>

  <!-- Menu Content -->
  <div class="min-h-screen flex flex-col justify-center px-8 sm:px-12 py-24">
    <!-- Navigation Links -->
    <nav class="space-y-6 mb-12">
      {#each visibleMenuLinks as item, i}
        <a 
          href={item.href}
          use:inertia
          on:click={() => isMenuOpen = false}
          class="block text-4xl sm:text-5xl font-bold tracking-tighter transition-all duration-300
            {item.group === group 
              ? 'text-primary-500' 
              : 'text-slate-900 dark:text-white hover:text-primary-500 dark:hover:text-primary-400 hover:translate-x-2'}"
          in:fly={{ y: 20, duration: 400, delay: i * 100 }}
        >
          <span class="inline-flex items-center gap-4">
            <span class="text-xs font-mono text-slate-400 dark:text-slate-500">0{i + 1}</span>
            {item.label}
          </span>
        </a>
      {/each}
    </nav>

    <!-- Mobile Auth -->
    <div class="pt-8 border-t border-slate-200 dark:border-slate-800" in:fly={{ y: 20, duration: 400, delay: 300 }}>
      {#if user}
        <p class="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4">Signed in as</p>
        <p class="text-lg font-medium text-slate-900 dark:text-white mb-6">{user.name}</p>
        <button 
          on:click={handleLogout}
          class="px-6 py-3 text-sm font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-full hover:border-red-500 hover:text-red-500 transition-colors"
        >
          Logout
        </button>
      {:else}
        <div class="flex gap-4">
          <a 
            href="/login" 
            use:inertia
            class="px-6 py-3 text-sm font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-full hover:border-primary-500 transition-colors"
          >
            Login
          </a>
          <a 
            href="/register" 
            use:inertia
            class="px-6 py-3 text-sm font-bold uppercase tracking-wider bg-slate-900 dark:bg-white text-white dark:text-black rounded-full"
          >
            Register
          </a>
        </div>
      {/if}
    </div>
  </div>

  <!-- Decorative -->
  <div class="absolute bottom-8 left-8 sm:left-12 text-[10px] uppercase tracking-[0.3em] text-slate-300 dark:text-slate-600">
    NARA Framework
  </div>

  <!-- Background Decoration -->
  <div class="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl pointer-events-none"></div>
  <div class="absolute bottom-0 left-0 w-48 h-48 bg-accent-500/5 rounded-full blur-3xl pointer-events-none"></div>
</div>
{/if}
