<script lang="ts">
  import { page, router, inertia } from '@inertiajs/svelte';
  import { buildCSRFHeaders } from '$lib/csrf';
  import DarkModeToggle from '../Components/DarkModeToggle.svelte';
  import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '$lib/components/ui/sheet';
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '$lib/components/ui/dropdown-menu';
  import { Avatar, AvatarFallback } from '$lib/components/ui/avatar';
  import { Button } from '$lib/components/ui/button';
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
    router.post('/logout', {}, { headers: buildCSRFHeaders() });
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

      <div class="hidden md:flex items-center gap-3">
        {#if user && user.id}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="icon" class="rounded-full h-8 w-8 cursor-pointer">
                <Avatar class="h-8 w-8">
                  <AvatarFallback class="text-xs font-mono-accent bg-secondary text-foreground">
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="font-body">
              <DropdownMenuLabel class="font-heading font-semibold text-sm">{user.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onclick={handleLogout} class="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                <LogOut class="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        {:else}
          <a href="/login" use:inertia class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors duration-200">
            Login
          </a>
          <a href="/register" use:inertia class="px-5 py-2 rounded-full bg-foreground text-background text-xs font-mono-accent uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-colors duration-200">
            Register
          </a>
        {/if}
      </div>

      <div class="md:hidden">
        <Sheet bind:open={isMenuOpen}>
          <SheetTrigger>
            <Button variant="ghost" size="icon" class="cursor-pointer">
              <Menu class="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" class="w-[280px] bg-background border-border font-body">
            <SheetHeader>
              <SheetTitle class="text-left font-heading font-bold text-xl tracking-tighter mt-4" style="font-feature-settings: 'ss01'">
                NARA.
              </SheetTitle>
            </SheetHeader>
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
                    <Avatar class="h-8 w-8">
                      <AvatarFallback class="text-xs font-mono-accent bg-secondary text-foreground">
                        {user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
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
          </SheetContent>
        </Sheet>
      </div>
    </div>

  </nav>
</header>
