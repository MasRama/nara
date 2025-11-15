<script>
  import { fly } from 'svelte/transition';
  import { page, router, inertia } from '@inertiajs/svelte';
  import { clickOutside } from '../Components/helper';

  let user = $page.props.user;
 
  let isMenuOpen = false;
  let isUserMenuOpen = false;

  export let group; 

  const menuLinks = [
    { href: '/dashboard', label: 'Overview', group: 'dashboard', show : true },  
    { href: '/users', label: 'Users', group: 'users', show : user && user.is_admin ? true : false },
    { href: '/profile', label: 'Profile', group: 'profile', show : user ? true : false },
  ];
 
  

  function isActive(path) {
    return currentPath === path;
  }

  function handleLogout() {
    router.post('/logout');
  }
</script>

<header class="fixed inset-x-0 top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl" 
  in:fly={{ y: -20, duration: 1000, delay: 200 }}>
  <nav
    class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between"
  >
    <div class="flex items-center gap-6">
      <a href="/" use:inertia class="flex items-center gap-2">
        <img src="/public/nara.png" alt="Nara logo" class="h-7 w-7 rounded-lg object-cover" />
        <div class="flex flex-col leading-tight">
          <span class="text-sm font-semibold tracking-tight text-slate-50">Nara</span>
          <span class="text-[10px] uppercase tracking-[0.22em] text-slate-500">TypeScript framework</span>
        </div>
      </a>

      <!-- Desktop Menu - pill style, dengan active state netral -->
      <div class="hidden md:flex items-center gap-3 text-xs font-medium">
        {#each menuLinks.filter((item) => item.show) as item}
          <a 
            use:inertia 
            href={item.href} 
            class="inline-flex items-center rounded-full px-3 py-1.5 transition-colors border {item.group === group 
              ? 'border-slate-600 bg-slate-900/80 text-slate-50' 
              : 'border-transparent text-slate-300 hover:text-slate-50 hover:bg-slate-900/70'}"
          >
            {item.label}
          </a>
        {/each}
      </div>
    </div>

    <div class="flex items-center gap-3">
      <!-- Auth Buttons - saat login hanya Logout di ujung kanan -->
      <div class="hidden sm:flex items-center gap-2 text-xs font-medium dark:text-gray-300">
        {#if user && user.id}
          <button 
            on:click={handleLogout}
            class="inline-flex items-center rounded-full px-3.5 py-1.5 text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors"
          >
            Logout
          </button>
        {:else}
          <a
            href="/login"
            class="inline-flex items-center rounded-full px-3 py-1.5 text-slate-300 hover:text-slate-50 hover:bg-slate-900/70 transition-colors"
          >
            Masuk
          </a>
          <a
            href="/register"
            class="inline-flex items-center rounded-full px-3.5 py-1.5 text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors"
          >
            Daftar
          </a>
        {/if}
      </div>

      <!-- Mobile Menu Button -->
      <button
        class="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400"
        on:click={() => isMenuOpen = !isMenuOpen}
        aria-label="Menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-6 h-6"
        >
          {#if !isMenuOpen}
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
          {:else}
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
          {/if}
        </svg>
      </button>
    </div>
  </nav>
  
  <!-- Mobile Menu -->
  {#if isMenuOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div  
    use:clickOutside on:click_outside={() => isMenuOpen = false}
    class="fixed inset-0 bg-black/20   backdrop-blur-sm z-50 md:hidden {isMenuOpen ? 'block' : 'hidden'}"
    on:click={() => (isMenuOpen = false)}
  >
    <div
      class="absolute right-0 top-0 h-screen w-64 bg-white dark:bg-gray-800 shadow-lg"
      on:click|stopPropagation
    >
      <div class="flex flex-col p-4 space-y-4">
        {#each menuLinks.filter((item) => item.show) as item}
          <a 
            href={item.href} 
            class="mobile-nav-link dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white {item.group === group ? 'active' : ''}"
          >
            {item.label}
          </a>
        {/each}
      </div>
      <div class="px-4 py-3 border-t dark:border-gray-700 border-gray-200">
        <div class="flex items-center space-x-3">
          {#if user}
            <button 
              class="flex-1 btn-secondary dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:text-white dark:text-gray-400 text-sm py-2"
              on:click={handleLogout}
            >
              Logout
            </button>
          {:else}
            <a href="/login" class="flex-1 btn-secondary text-sm py-2">Masuk</a>
            <a href="/register" class="flex-1 btn-primary text-sm py-2">Daftar</a>
          {/if}
        </div>
      </div>
    </div>
  </div>
  {/if}
</header>

 
<br>
<br>