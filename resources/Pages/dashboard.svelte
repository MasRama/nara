<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { page as inertiaPage, inertia } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import { Users, ShieldCheck, ArrowUpRight, ArrowRight } from '@lucide/svelte';
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
  <section class="px-6 sm:px-10 lg:px-16 pt-28 pb-16">
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

  <!-- ───────────── Stats + Actions bento ───────────── -->
  <section class="px-6 sm:px-10 lg:px-16 pb-16">
    <div class="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[minmax(200px,auto)]" in:fly={{ y: 20, duration: 800, delay: 150 }}>

      <!-- Total users — accent tile, large -->
      <div class="md:col-span-2 md:row-span-2 rounded-xl bg-primary text-primary-foreground p-8 flex flex-col justify-between min-h-[280px]">
        <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-primary-foreground/60">Total users</span>
        <div>
          <div class="font-heading font-semibold tracking-[-0.03em] text-[clamp(3rem,6vw,5rem)] leading-none">
            {total || users?.length || 0}
          </div>
          <span class="text-sm text-primary-foreground/70 mt-2 block">registered accounts</span>
        </div>
      </div>

      <!-- Current page -->
      <div class="md:col-span-2 rounded-xl border border-border bg-card p-8 flex flex-col justify-between">
        <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Current view</span>
        <div>
          <div class="font-heading font-semibold tracking-[-0.03em] text-[clamp(2.5rem,4vw,3.5rem)] leading-none text-foreground">
            {page}<span class="text-muted-foreground text-2xl font-normal">/{totalPages}</span>
          </div>
          <span class="text-sm text-muted-foreground mt-1 block">page of the list</span>
        </div>
      </div>

      <!-- Your role -->
      <div class="md:col-span-2 rounded-xl border border-border bg-card p-8 flex flex-col justify-between">
        <span class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Your role</span>
        <div>
          <div class="font-heading font-semibold tracking-[-0.03em] text-[clamp(2.5rem,4vw,3.5rem)] leading-none text-foreground">
            {currentUser?.roles?.includes('admin') ? 'Admin' : 'User'}
          </div>
          <span class="text-sm text-muted-foreground inline-flex items-center gap-2 mt-1">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            Active session
          </span>
        </div>
      </div>

      <!-- Quick action: Manage users -->
      {#if hasPermission('users.view')}
        <a href="/users" use:inertia class="md:col-span-2 rounded-xl border border-border bg-card p-8 flex flex-col justify-between hover:border-primary/40 hover:bg-muted/30 transition-all duration-300 group">
          <div class="w-11 h-11 rounded-full bg-muted border border-border flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
            <Users class="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
          </div>
          <div>
            <h3 class="font-heading font-semibold text-lg tracking-tight text-foreground">Manage users</h3>
            <p class="text-sm text-muted-foreground mt-1">View, create, and edit accounts.</p>
          </div>
        </a>
      {/if}

      <!-- Quick action: Manage roles -->
      {#if hasPermission('roles.view')}
        <a href="/roles" use:inertia class="md:col-span-2 rounded-xl border border-border bg-card p-8 flex flex-col justify-between hover:border-primary/40 hover:bg-muted/30 transition-all duration-300 group">
          <div class="w-11 h-11 rounded-full bg-muted border border-border flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
            <ShieldCheck class="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
          </div>
          <div>
            <h3 class="font-heading font-semibold text-lg tracking-tight text-foreground">Manage roles</h3>
            <p class="text-sm text-muted-foreground mt-1">Configure roles and permissions.</p>
          </div>
        </a>
      {/if}

    </div>
  </section>

  <!-- ───────────── Account + Recent users ───────────── -->
  <section class="px-6 sm:px-10 lg:px-16 pb-24">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4" in:fly={{ y: 20, duration: 800, delay: 300 }}>

      <!-- Account card -->
      <div class="lg:col-span-5 rounded-xl border border-border bg-card p-8 flex flex-col gap-6">
        <h2 class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">Account</h2>

        <div class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">Name</span>
            <span class="font-heading font-medium text-lg tracking-tight text-foreground">{currentUser?.name}</span>
          </div>

          <div class="h-px bg-border"></div>

          <div class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">Email</span>
            <span class="font-heading font-medium text-base tracking-tight text-foreground break-all">{currentUser?.email}</span>
          </div>

          <div class="h-px bg-border"></div>

          <div class="flex flex-col gap-2">
            <span class="text-xs text-muted-foreground">Roles</span>
            <div class="flex flex-wrap gap-2">
              {#each (currentUser?.roles ?? []) as role}
                <span class="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-heading capitalize">{role}</span>
              {/each}
              {#if !currentUser?.roles?.length}
                <span class="inline-flex items-center px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-heading">No roles</span>
              {/if}
            </div>
          </div>
        </div>

        <a href="/profile" use:inertia class="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group w-fit">
          Edit profile
          <ArrowRight class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </a>
      </div>

      <!-- Recent users -->
      <div class="lg:col-span-7 flex flex-col gap-6">
        {#if recentUsers.length > 0}
          <div class="flex items-center justify-between">
            <h2 class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">Recently added</h2>
            {#if hasPermission('users.view')}
              <a href="/users" use:inertia class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                View all
                <ArrowUpRight class="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            {/if}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {#each recentUsers as u}
              <div class="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                  <span class="text-xs font-heading font-medium text-foreground">{u.name?.slice(0, 2).toUpperCase()}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-heading font-medium text-sm tracking-tight text-foreground truncate">{u.name}</p>
                  <p class="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                {#if u.roles?.length}
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-heading capitalize shrink-0">{u.roles[0]}</span>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="rounded-xl border border-border bg-card p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
            <div class="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center mb-4">
              <Users class="w-5 h-5 text-muted-foreground" />
            </div>
            <p class="font-heading font-medium text-lg tracking-tight text-foreground">No users yet</p>
            <p class="text-sm text-muted-foreground mt-1 max-w-[32ch]">When people register, they will appear here.</p>
            {#if hasPermission('users.view')}
              <a href="/users" use:inertia class="mt-5 inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors group">
                Go to users
                <ArrowRight class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            {/if}
          </div>
        {/if}
      </div>

    </div>
  </section>

</div>
