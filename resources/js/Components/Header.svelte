<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { page, router, inertia } from '@inertiajs/svelte';
  import { buildCSRFHeaders } from '$lib/csrf';
  import DarkModeToggle from '../Components/DarkModeToggle.svelte';
  
  import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '$lib/components/ui/sheet';
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '$lib/components/ui/dropdown-menu';
  import { Avatar, AvatarFallback } from '$lib/components/ui/avatar';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import { Menu, LogOut } from 'lucide-svelte';

  interface User {
    id: string;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
  }

  interface MenuLink {
    href: string;
    label: string;
    group: string;
    show: boolean;
  }

  let { group }: { group: string } = $props();

  let user = $derived($page.props.user as User | undefined);
  let scrollY = $state(0);
  let isMenuOpen = $state(false);

  let scrolled = $derived(scrollY > 50);

  let menuLinks = $derived([
    { href: '/dashboard', label: 'Overview', group: 'dashboard', show: true },
    { href: '/users', label: 'Users', group: 'users', show: Array.isArray(user?.roles) && user.roles.includes('admin') },
    { href: '/profile', label: 'Profile', group: 'profile', show: !!user },
  ] as MenuLink[]);
  
  let visibleMenuLinks = $derived(menuLinks.filter((item) => item.show));

  function handleLogout(): void {
    router.post('/logout', {}, {
      headers: buildCSRFHeaders()
    });
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
      <div class="hidden md:flex items-center gap-3">
        {#if user && user.id}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="icon" class="rounded-full">
                <Avatar>
                  <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onclick={handleLogout}>
                <LogOut class="mr-2 h-4 w-4" /> 
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      <!-- Mobile Menu Button with Sheet -->
      <div class="md:hidden">
        <Sheet bind:open={isMenuOpen}>
          <SheetTrigger>
            <Button variant="ghost" size="icon">
              <Menu class="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" class="w-[300px] sm:w-[400px]">
            <SheetHeader>
              <SheetTitle class="text-left text-xl font-bold tracking-tighter mt-4">
                NARA.
              </SheetTitle>
            </SheetHeader>
            <div class="flex flex-col h-full py-6 mt-4">
              <!-- Navigation Links -->
              <nav class="flex flex-col gap-4">
                {#each visibleMenuLinks as item, i}
                  <a 
                    href={item.href}
                    use:inertia
                    onclick={() => isMenuOpen = false}
                    class="text-2xl font-bold tracking-tighter transition-all duration-300
                      {item.group === group 
                        ? 'text-primary-500' 
                        : 'text-slate-900 dark:text-white hover:text-primary-500'}"
                  >
                    <span class="inline-flex items-center gap-4">
                      <span class="text-xs font-mono text-slate-400 dark:text-slate-500">0{i + 1}</span>
                      {item.label}
                    </span>
                  </a>
                {/each}
              </nav>

              <!-- Mobile Auth Actions -->
              <div class="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800">
                {#if user}
                  <div class="flex items-center gap-3 mb-6">
                    <Avatar>
                      <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div class="flex flex-col">
                      <span class="text-sm font-medium text-slate-900 dark:text-white">{user.name}</span>
                      <span class="text-xs text-slate-500">{user.email}</span>
                    </div>
                  </div>
                  <Button variant="outline" class="w-full justify-start" onclick={handleLogout}>
                    <LogOut class="mr-2 h-4 w-4" /> 
                    <span>Logout</span>
                  </Button>
                {:else}
                  <div class="flex flex-col gap-3">
                    <a
                      href="/login"
                      use:inertia
                      class="flex items-center justify-center px-6 py-3 text-sm font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-full hover:border-primary-500 transition-colors"
                      onclick={() => isMenuOpen = false}
                    >
                      Login
                    </a>
                    <a
                      href="/register"
                      use:inertia
                      class="flex items-center justify-center px-6 py-3 text-sm font-bold uppercase tracking-wider bg-slate-900 dark:bg-white text-white dark:text-black rounded-full"
                      onclick={() => isMenuOpen = false}
                    >
                      Register
                    </a>
                  </div>
                {/if}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

    </div>
  </nav>
</header>