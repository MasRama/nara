<script lang="ts">
  import { page, router, inertia } from '@inertiajs/svelte';
  import axios from 'axios';
  import { api } from '$lib/api';
  import DarkModeToggle from './DarkModeToggle.svelte';
  import Button from './Button.svelte';
  import * as menu from "@zag-js/menu";
  import * as dialog from "@zag-js/dialog";
  import { useMachine, normalizeProps, portal } from "@zag-js/svelte";
  import { Menu, LogOut } from '@lucide/svelte';

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

  let user = $derived(page.props.user as User | undefined);
  let scrollY = $state(0);
  let isMenuOpen = $state(false);

  let scrolled = $derived(scrollY > 50);

  // Zag.js Menu (dropdown)
  const menuService = useMachine(menu.machine, { id: "header-menu" });
  const menuApi = $derived(menu.connect(menuService, normalizeProps));

  // Zag.js Dialog (mobile sheet)
  const sheetService = useMachine(dialog.machine, {
    id: "mobile-sheet",
    get open() { return isMenuOpen; },
    onOpenChange(details) { isMenuOpen = details.open; },
  });
  const sheetApi = $derived(dialog.connect(sheetService, normalizeProps));

  function hasPermission(slug: string): boolean {
    if (!user) return false;
    if (user.roles?.includes('admin')) return true;
    return user.permissions?.includes(slug) ?? false;
  }

  let menuLinks = $derived([
    { href: '/dashboard', label: 'Overview', group: 'dashboard', show: true },
    { href: '/users', label: 'Users', group: 'users', show: hasPermission('users.view') },
    { href: '/roles', label: 'Roles', group: 'roles', show: hasPermission('roles.view') },
    { href: '/profile', label: 'Profile', group: 'profile', show: !!user },
  ] as MenuLink[]);

  let visibleMenuLinks = $derived(menuLinks.filter((item) => item.show));

  async function handleLogout(): Promise<void> {
    const result = await api(() => axios.post('/logout'));
    if (result.success) router.visit('/login');
  }
</script>

<svelte:window bind:scrollY />

<header class="fixed inset-x-0 top-0 z-50 transition-all duration-500 bg-background/80 backdrop-blur-md {scrolled ? 'border-b border-border' : ''}">
  <nav class="px-6 sm:px-12 lg:px-24 py-4 flex items-center justify-between">

    <div class="flex items-center gap-8">
      <a href="/" use:inertia class="font-heading font-bold text-xl tracking-tighter hover:text-primary transition-colors duration-200" style="font-feature-settings: 'ss01'">
        NARA.
      </a>

      <div class="hidden md:flex items-center gap-1">
        {#each visibleMenuLinks as item, i}
          <a
            use:inertia
            href={item.href}
            class="relative px-4 py-2 text-xs font-mono-accent uppercase tracking-widest transition-colors duration-200
              {item.group === group
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'}"
          >
            {item.label}
            {#if item.group === group}
              <span class="absolute bottom-0 left-4 right-4 h-px bg-primary"></span>
            {/if}
          </a>
          {#if i < visibleMenuLinks.length - 1}
            <span class="w-px h-3 bg-border"></span>
          {/if}
        {/each}
      </div>
    </div>

    <div class="flex items-center gap-3">
      <span class="md:hidden text-[10px] font-mono-accent uppercase tracking-widest text-primary">{group}</span>

      <div class="h-4 w-px bg-border hidden sm:block"></div>

      <DarkModeToggle />

      <!-- Desktop: Dropdown menu -->
      <div class="hidden md:flex items-center gap-3">
        {#if user && user.id}
          <button {...menuApi.getTriggerProps()}>
            <Button variant="ghost" size="icon" class="rounded-full h-8 w-8 cursor-pointer">
              <div class="relative flex w-8 h-8 shrink-0 overflow-hidden rounded-full bg-secondary items-center justify-center">
                <span class="text-xs font-mono-accent text-foreground">{user.name.slice(0, 2).toUpperCase()}</span>
              </div>
            </Button>
          </button>
          <div use:portal {...menuApi.getPositionerProps()}>
            <div {...menuApi.getContentProps()} class="bg-background text-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50 min-w-[10rem] rounded-xl border border-border p-1.5 shadow-sm outline-none font-body">
              <div class="px-3 py-2 text-sm font-heading font-semibold">{user.name}</div>
              <hr class="bg-border -mx-1 my-1 h-px" />
              <div {...menuApi.getItemProps({ value: "logout" })} onclick={handleLogout} class="data-[highlighted]:bg-muted data-[highlighted]:text-foreground relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-150 outline-hidden select-none text-muted-foreground hover:text-foreground">
                <LogOut class="mr-2 h-4 w-4" />
                <span>Logout</span>
              </div>
            </div>
          </div>
        {:else}
          <a href="/login" use:inertia class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors duration-200">
            Login
          </a>
          <a href="/register" use:inertia class="px-5 py-2 rounded-full bg-foreground text-background text-xs font-mono-accent uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-colors duration-200">
            Register
          </a>
        {/if}
      </div>

      <!-- Mobile: Sheet (side panel) -->
      <div class="md:hidden">
        <button {...sheetApi.getTriggerProps()}>
          <Button variant="ghost" size="icon" class="cursor-pointer">
            <Menu class="h-5 w-5" />
          </Button>
        </button>
        {#if sheetApi.open}
          <div use:portal>
            <div {...sheetApi.getBackdropProps()} class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"></div>
            <div {...sheetApi.getPositionerProps()}>
              <div {...sheetApi.getContentProps()} class="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed inset-y-0 left-0 z-50 h-full w-3/4 border-r border-border p-6 shadow-lg transition ease-in-out duration-300 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left sm:max-w-sm font-body">
                <div class="flex flex-col gap-2 text-start">
                  <h2 {...sheetApi.getTitleProps()} class="text-left font-heading font-bold text-xl tracking-tighter mt-4" style="font-feature-settings: 'ss01'">
                    NARA.
                  </h2>
                </div>
                <div class="flex flex-col h-full py-8 mt-2">
                  <nav class="flex flex-col gap-1">
                    {#each visibleMenuLinks as item, i}
                      <a
                        href={item.href}
                        use:inertia
                        onclick={() => isMenuOpen = false}
                        class="flex items-center gap-4 px-3 py-3 rounded-xl transition-colors duration-200
                          {item.group === group
                            ? 'bg-primary/5 text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}"
                      >
                        <span class="text-[10px] font-mono-accent text-muted-foreground">0{i + 1}</span>
                        <span class="text-sm font-mono-accent uppercase tracking-widest">{item.label}</span>
                        {#if item.group === group}
                          <span class="ml-auto w-1.5 h-1.5 rounded-full bg-primary"></span>
                        {/if}
                      </a>
                    {/each}
                  </nav>

                  <div class="mt-auto pt-6 border-t border-border">
                    {#if user}
                      <div class="flex items-center gap-3 mb-5 px-1">
                        <div class="relative flex w-8 h-8 shrink-0 overflow-hidden rounded-full bg-secondary items-center justify-center">
                          <span class="text-xs font-mono-accent text-foreground">{user.name.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div>
                          <p class="text-sm font-heading font-semibold">{user.name}</p>
                          <p class="text-xs font-mono-accent text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <Button variant="outline" class="w-full justify-start rounded-xl border-border font-mono-accent text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground cursor-pointer" onclick={handleLogout}>
                        <LogOut class="mr-2 h-4 w-4" />
                        Logout
                      </Button>
                    {:else}
                      <div class="flex flex-col gap-3">
                        <a href="/login" use:inertia onclick={() => isMenuOpen = false} class="flex items-center justify-center px-6 py-3 rounded-full border border-border text-xs font-mono-accent uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors duration-200">
                          Login
                        </a>
                        <a href="/register" use:inertia onclick={() => isMenuOpen = false} class="flex items-center justify-center px-6 py-3 rounded-full bg-foreground text-background text-xs font-mono-accent uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-colors duration-200">
                          Register
                        </a>
                      </div>
                    {/if}
                  </div>
                </div>
                <button {...sheetApi.getCloseTriggerProps()} class="ring-offset-background focus:ring-ring absolute end-4 top-4 rounded-lg opacity-50 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  <span class="sr-only">Close</span>
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>

  </nav>
</header>
