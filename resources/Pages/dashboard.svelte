<script lang="ts">
  import { fly } from 'svelte/transition';
  import { page as inertiaPage, inertia } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import { ArrowUpRight, ArrowRight } from '@lucide/svelte';
  import type { User } from '../types';

  interface Props {
    users?: User[];
    total?: number;
    page?: number;
    limit?: number;
  }

  let {
    users = [],
    total = 0,
    page = 1,
    limit = 10
  }: Props = $props();

  const currentUser = $derived(inertiaPage.props.user as User | undefined);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  function hasPermission(slug: string): boolean {
    if (!currentUser) return false;
    if (currentUser.roles?.includes('admin')) return true;
    return currentUser.permissions?.includes(slug) ?? false;
  }

  const recentUsers = $derived((users ?? []).slice(0, 5));
  const totalPages = $derived(Math.max(1, Math.ceil((total || 0) / (limit || 10))));
  const permissionCount = $derived(currentUser?.permissions?.length ?? 0);
  const firstName = $derived(currentUser?.name?.split(' ')[0] || 'there');
  const isAdmin = $derived(currentUser?.roles?.includes('admin') ?? false);
</script>

<Header group="dashboard" />

<div class="min-h-[100dvh] bg-background text-foreground font-body antialiased selection:bg-primary/20 selection:text-primary overflow-x-hidden">

  <!-- paper grain -->
  <div class="fixed inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-foreground"></div>

  <!-- ───────────── Greeting + stats ───────────── -->
  <section class="relative px-6 sm:px-10 lg:px-16 pt-28 pb-12">
    <div class="max-w-[1400px] mx-auto" in:fly={{ y: 16, duration: 600 }}>
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div>
          <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">{greeting}</p>
          <h1 class="font-heading font-semibold tracking-[-0.02em] text-2xl sm:text-3xl text-foreground">
            {firstName} <span class="text-muted-foreground font-normal">— the work lives</span> <span class="italic font-medium text-primary">here.</span>
          </h1>
        </div>

<div class="inline-flex flex-wrap items-center gap-x-4 gap-y-2 font-mono-accent text-xs text-muted-foreground rounded-full bg-card/60 ring-1 ring-border/40 px-4 py-2 backdrop-blur-sm">
  <span><span class="text-foreground font-medium">{total || users?.length || 0}</span> users</span>
  <span class="w-px h-3 bg-border/60"></span>
  <span>page <span class="text-foreground font-medium">{page}</span>/{totalPages}</span>
  <span class="w-px h-3 bg-border/60"></span>
  <span><span class="text-foreground font-medium">{permissionCount}</span> perms</span>
  <span class="w-px h-3 bg-border/60"></span>
  <span class="inline-flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span> {isAdmin ? 'admin' : 'user'}</span>
</div>
      </div>
    </div>
  </section>

  <!-- ───────────── Quick actions ───────────── -->
  <section class="px-6 sm:px-10 lg:px-16 pb-12">
    <div class="max-w-[1400px] mx-auto" in:fly={{ y: 16, duration: 600, delay: 120 }}>
      <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-5">Quick actions</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {#if hasPermission('users.view')}
<a href="/users" use:inertia class="group rounded-xl bg-card p-5 flex items-center justify-between gap-3 ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),0_8px_28px_-6px_rgba(16,185,129,0.12)] hover:ring-primary/30 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
  <div class="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
  <div class="relative">
    <h3 class="font-heading font-medium text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">Manage users</h3>
    <p class="text-xs text-muted-foreground mt-0.5">View, create, edit</p>
  </div>
  <ArrowRight class="relative w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
</a>
        {/if}
        {#if hasPermission('roles.view')}
<a href="/roles" use:inertia class="group rounded-xl bg-card p-5 flex items-center justify-between gap-3 ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),0_8px_28px_-6px_rgba(16,185,129,0.12)] hover:ring-primary/30 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
  <div class="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
  <div class="relative">
    <h3 class="font-heading font-medium text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">Manage roles</h3>
    <p class="text-xs text-muted-foreground mt-0.5">Roles & permissions</p>
  </div>
  <ArrowRight class="relative w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
</a>
        {/if}
<a href="/profile" use:inertia class="group rounded-xl bg-card p-5 flex items-center justify-between gap-3 ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),0_8px_28px_-6px_rgba(16,185,129,0.12)] hover:ring-primary/30 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
  <div class="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
  <div class="relative">
    <h3 class="font-heading font-medium text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">Edit profile</h3>
    <p class="text-xs text-muted-foreground mt-0.5">Name, email, avatar</p>
  </div>
  <ArrowRight class="relative w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
</a>
      </div>
    </div>
  </section>

  <!-- ───────────── Account + Recent ───────────── -->
  <section class="px-6 sm:px-10 lg:px-16 pb-24">
    <div class="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4" in:fly={{ y: 16, duration: 600, delay: 240 }}>

      <!-- Account -->
<div class="lg:col-span-5 rounded-2xl bg-card p-6 ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] flex flex-col gap-5">
  <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">Account</p>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-4">
      <span class="text-xs text-muted-foreground shrink-0">Name</span>
      <span class="font-heading font-medium text-sm tracking-tight text-foreground text-right">{currentUser?.name}</span>
    </div>
    <div class="h-px bg-gradient-to-r from-transparent via-border/70 to-transparent"></div>
    <div class="flex items-center justify-between gap-4">
      <span class="text-xs text-muted-foreground shrink-0">Email</span>
      <span class="font-mono-accent text-xs text-foreground text-right break-all">{currentUser?.email}</span>
    </div>
    <div class="h-px bg-gradient-to-r from-transparent via-border/70 to-transparent"></div>
    <div class="flex items-start justify-between gap-4">
      <span class="text-xs text-muted-foreground shrink-0 pt-0.5">Roles</span>
      <div class="flex flex-wrap gap-1.5 justify-end">
        {#each (currentUser?.roles ?? []) as role}
          <span class="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 ring-1 ring-primary/20 text-primary text-[11px] font-heading capitalize">{role}</span>
        {/each}
        {#if !currentUser?.roles?.length}
          <span class="inline-flex items-center px-2.5 py-1 rounded-full bg-muted ring-1 ring-border/50 text-muted-foreground text-[11px] font-heading">None</span>
        {/if}
      </div>
    </div>
  </div>
</div>

      <!-- Recent users -->
<div class="lg:col-span-7 rounded-2xl bg-card p-6 ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] flex flex-col gap-4">
  {#if recentUsers.length > 0}
    <div class="flex items-center justify-between">
      <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">Recently added</p>
      {#if hasPermission('users.view')}
        <a href="/users" use:inertia class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group">
          View all
          <ArrowUpRight class="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </a>
      {/if}
    </div>
    <div class="flex flex-col">
      {#each recentUsers as u, i}
        <div class="flex items-center gap-3 py-3 rounded-xl px-2 -mx-2 {i > 0 ? 'border-t border-border/40' : ''} hover:bg-muted/40 transition-colors">
          <span class="font-mono-accent text-[11px] text-muted-foreground/50 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
          <div class="w-9 h-9 rounded-full bg-gradient-to-br from-muted to-muted/60 ring-1 ring-border/40 flex items-center justify-center shrink-0">
            <span class="text-[11px] font-heading font-medium text-foreground">{u.name?.slice(0, 2).toUpperCase()}</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-heading font-medium text-sm tracking-tight text-foreground truncate">{u.name}</p>
            <p class="text-xs text-muted-foreground truncate font-mono-accent">{u.email || '—'}</p>
          </div>
          {#if u.roles?.length}
            <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 ring-1 ring-primary/20 text-primary text-[10px] font-heading capitalize shrink-0">{u.roles[0]}</span>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="flex flex-col items-center justify-center text-center min-h-[200px]">
      <p class="font-heading font-medium text-base tracking-tight text-foreground">No users yet</p>
      <p class="text-xs text-muted-foreground mt-1 max-w-[32ch]">When people register, they will appear here.</p>
      {#if hasPermission('users.view')}
        <a href="/users" use:inertia class="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors group">
          Go to users
          <ArrowRight class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </a>
      {/if}
    </div>
  {/if}
</div>

    </div>
  </section>

</div>

<style>
  :global(html) {
    scroll-behavior: smooth;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(html) {
      scroll-behavior: auto;
    }
  }
</style>
