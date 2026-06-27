<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { page as inertiaPage, inertia } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import { Users, ShieldCheck, UserCog, ArrowUpRight, ArrowRight } from '@lucide/svelte';
  import type { User } from '../types';

  interface Props {
    users?: User[];
    search?: string;
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  }

  let {
    users = [],
    search = '',
    total = 0,
    page = 1,
    limit = 10,
    totalPages = 1,
    hasNext = false,
    hasPrev = false
  }: Props = $props();

  const currentUser = $derived(inertiaPage.props.user as User | undefined);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  function hasPermission(slug: string): boolean {
    if (!currentUser) return false;
    if (currentUser.roles?.includes('admin')) return true;
    return currentUser.permissions?.includes(slug) ?? false;
  }

  const recentUsers = $derived((users ?? []).slice(0, 4));
</script>

<Header group="dashboard" />

<div class="min-h-[100dvh] bg-background text-foreground font-body antialiased selection:bg-primary/20 selection:text-primary">

  <!-- ───────────── Greeting ───────────── -->
  <section class="px-6 sm:px-10 lg:px-16 pt-28 pb-14">
    <div in:fly={{ y: 20, duration: 800 }}>
      <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-4">{greeting}</p>
      <h1 class="font-heading font-semibold tracking-[-0.03em] leading-[1] text-[clamp(2.5rem,6vw,4.5rem)] text-foreground">
        {currentUser?.name?.split(' ')[0] || 'there'}.
      </h1>
      <p class="mt-5 text-lg text-muted-foreground leading-relaxed max-w-[52ch]">
        Here is where the work lives. Quiet, flat, ready for the next prompt.
      </p>
    </div>
  </section>

  <!-- ───────────── Stats — border band, no boxes ───────────── -->
  <section class="px-6 sm:px-10 lg:px-16 pb-20">
    <div class="border-t border-border" in:fly={{ y: 20, duration: 800, delay: 150 }}>
      <div class="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">

        <div class="py-10 md:py-12 md:pr-10 flex flex-col gap-3">
          <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Total users</span>
          <div class="font-heading font-semibold tracking-[-0.03em] text-[clamp(2.5rem,5vw,3.75rem)] leading-none text-foreground">
            {total || users?.length || 0}
          </div>
          <span class="text-sm text-muted-foreground">registered accounts</span>
        </div>

        <div class="py-10 md:py-12 md:px-10 flex flex-col gap-3">
          <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Current view</span>
          <div class="font-heading font-semibold tracking-[-0.03em] text-[clamp(2.5rem,5vw,3.75rem)] leading-none text-foreground">
            {page}<span class="text-muted-foreground text-2xl font-normal">/{totalPages}</span>
          </div>
          <span class="text-sm text-muted-foreground">page of the list</span>
        </div>

        <div class="py-10 md:py-12 md:pl-10 flex flex-col gap-3">
          <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Your role</span>
          <div class="font-heading font-semibold tracking-[-0.03em] text-[clamp(2.5rem,5vw,3.75rem)] leading-none text-foreground">
            {currentUser?.roles?.includes('admin') ? 'Admin' : 'User'}
          </div>
          <span class="text-sm text-muted-foreground inline-flex items-center gap-2">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            Active session
          </span>
        </div>

      </div>
      <div class="border-b border-border"></div>
    </div>
  </section>

  <!-- ───────────── Account + Quick actions ───────────── -->
  <section class="px-6 sm:px-10 lg:px-16 pb-24">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16" in:fly={{ y: 20, duration: 800, delay: 300 }}>

      <!-- Account — list with border-b dividers, no card wrapper -->
      <div class="lg:col-span-5 flex flex-col gap-10">
        <h2 class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">Account</h2>

        <div class="flex flex-col">
          <div class="border-t border-border py-5 flex items-baseline justify-between gap-4">
            <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground shrink-0">Name</span>
            <span class="font-heading font-medium text-lg tracking-tight text-foreground text-right">{currentUser?.name}</span>
          </div>

          <div class="border-t border-border py-5 flex items-baseline justify-between gap-4">
            <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground shrink-0">Email</span>
            <span class="font-heading font-medium text-base tracking-tight text-foreground text-right break-all">{currentUser?.email}</span>
          </div>

          <div class="border-t border-border py-5 flex items-start justify-between gap-4">
            <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground shrink-0 pt-1">Roles</span>
            <div class="flex flex-wrap gap-2 justify-end">
              {#each (currentUser?.roles ?? []) as role}
                <span class="inline-flex items-center px-3 py-1 rounded-sm bg-primary/10 border border-primary/20 text-primary text-xs font-heading capitalize">{role}</span>
              {/each}
              {#if !currentUser?.roles?.length}
                <span class="inline-flex items-center px-3 py-1 rounded-sm bg-muted text-muted-foreground text-xs font-heading">No roles</span>
              {/if}
            </div>
          </div>

          {#if search}
            <div class="border-t border-border py-5 flex items-baseline justify-between gap-4">
              <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground shrink-0">Last search</span>
              <span class="font-heading font-medium text-base tracking-tight text-foreground text-right">{search}</span>
            </div>
          {/if}

          <div class="border-t border-b border-border"></div>
        </div>
      </div>

      <!-- Quick actions — list with border-b dividers, no card boxes -->
      <div class="lg:col-span-7 flex flex-col gap-10">
        <h2 class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">Quick actions</h2>

        <div class="flex flex-col">
          {#if hasPermission('users.view')}
            <a href="/users" use:inertia class="group border-t border-border py-6 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors -mx-2 px-2">
              <div class="flex items-center gap-5 min-w-0">
                <div class="w-11 h-11 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
                  <Users class="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
                </div>
                <div class="min-w-0">
                  <h3 class="font-heading font-semibold text-lg tracking-tight text-foreground">Manage users</h3>
                  <p class="text-sm text-muted-foreground mt-0.5 truncate">View, create, and edit every registered account.</p>
                </div>
              </div>
              <ArrowRight class="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
            </a>
          {/if}

          {#if hasPermission('roles.view')}
            <a href="/roles" use:inertia class="group border-t border-border py-6 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors -mx-2 px-2">
              <div class="flex items-center gap-5 min-w-0">
                <div class="w-11 h-11 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
                  <ShieldCheck class="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
                </div>
                <div class="min-w-0">
                  <h3 class="font-heading font-semibold text-lg tracking-tight text-foreground">Manage roles</h3>
                  <p class="text-sm text-muted-foreground mt-0.5 truncate">Configure roles and their permissions.</p>
                </div>
              </div>
              <ArrowRight class="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
            </a>
          {/if}

          <a href="/profile" use:inertia class="group border-t border-b border-border py-6 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors -mx-2 px-2">
            <div class="flex items-center gap-5 min-w-0">
              <div class="w-11 h-11 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
                <UserCog class="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
              </div>
              <div class="min-w-0">
                <h3 class="font-heading font-semibold text-lg tracking-tight text-foreground">Edit profile</h3>
                <p class="text-sm text-muted-foreground mt-0.5 truncate">Update your name, avatar, and password.</p>
              </div>
            </div>
            <ArrowRight class="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
          </a>
        </div>

        <!-- Recently added — list with dividers, no card wrapper -->
        {#if recentUsers.length > 0}
          <div class="mt-2 flex flex-col gap-6">
            <h2 class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">Recently added</h2>
            <div class="flex flex-col">
              {#each recentUsers as u, i}
                <div class="border-t border-border py-4 flex items-center gap-4 {i === recentUsers.length - 1 ? 'border-b' : ''}">
                  <div class="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                    <span class="text-xs font-heading font-medium text-foreground">{u.name?.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-heading font-medium text-sm tracking-tight text-foreground truncate">{u.name}</p>
                    <p class="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  {#if u.roles?.length}
                    <span class="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-primary text-[10px] font-heading capitalize shrink-0">{u.roles[0]}</span>
                  {/if}
                </div>
              {/each}
            </div>
            {#if hasPermission('users.view')}
              <a href="/users" use:inertia class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group w-fit">
                View all users
                <ArrowUpRight class="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            {/if}
          </div>
        {/if}
      </div>

    </div>
  </section>

</div>
