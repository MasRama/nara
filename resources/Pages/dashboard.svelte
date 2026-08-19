<script lang="ts">
  import { page as inertiaPage, inertia } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import { ArrowRight, ArrowUpRight, Shield, Users } from '@lucide/svelte';
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
  const totalUsers = $derived(total || users.length);
  const permissionCount = $derived(currentUser?.permissions?.length ?? 0);
  const firstName = $derived(currentUser?.name?.split(' ')[0] || 'there');
  const isAdmin = $derived(currentUser?.roles?.includes('admin') ?? false);
</script>

<Header group="dashboard" />

<div class="min-h-[100dvh] bg-background text-foreground font-body antialiased selection:bg-primary/20 selection:text-primary overflow-x-hidden">
  <div class="fixed inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-foreground"></div>

  <section class="relative px-6 sm:px-10 lg:px-16 pt-28 pb-16">
    <div class="max-w-[1400px] mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
        <div>
          <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">{greeting}</p>
          <h1 class="font-heading font-semibold tracking-[-0.02em] text-2xl sm:text-3xl text-foreground">
            {firstName} <span class="text-muted-foreground font-normal">— here's the shape of your workspace.</span>
          </h1>
        </div>

        <div class="inline-flex flex-wrap items-center gap-x-4 gap-y-2 font-mono-accent text-xs text-muted-foreground rounded-full bg-card/60 ring-1 ring-border/40 px-4 py-2 backdrop-blur-sm">
          <span><span class="text-foreground font-medium">{totalUsers}</span> users</span>
          <span class="w-px h-3 bg-border/60"></span>
          <span>page <span class="text-foreground font-medium">{page}</span>/{totalPages}</span>
          <span class="w-px h-3 bg-border/60"></span>
          <span><span class="text-foreground font-medium">{permissionCount}</span> perms</span>
          <span class="w-px h-3 bg-border/60"></span>
          <span class="inline-flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
            {isAdmin ? 'admin access' : 'member access'}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <aside class="lg:col-span-4 flex flex-col gap-4">
          <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] p-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Workspace</p>
                <h2 class="font-heading font-semibold text-xl tracking-tight text-foreground">At a glance</h2>
              </div>
              <div class="w-10 h-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                <Shield class="w-5 h-5 text-primary" />
              </div>
            </div>
            <p class="text-sm text-muted-foreground leading-relaxed mt-4">A compact view of your account, access, and the people currently in the system.</p>

            <div class="grid grid-cols-2 gap-3 mt-6">
              <div class="rounded-xl bg-muted/30 ring-1 ring-border/40 p-4">
                <p class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Users</p>
                <p class="font-heading font-semibold text-2xl tracking-tight text-foreground mt-2">{totalUsers}</p>
              </div>
              <div class="rounded-xl bg-muted/30 ring-1 ring-border/40 p-4">
                <p class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Permissions</p>
                <p class="font-heading font-semibold text-2xl tracking-tight text-foreground mt-2">{permissionCount}</p>
              </div>
              <div class="rounded-xl bg-muted/30 ring-1 ring-border/40 p-4">
                <p class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Page</p>
                <p class="font-heading font-semibold text-2xl tracking-tight text-foreground mt-2">{page}<span class="text-sm text-muted-foreground font-normal">/{totalPages}</span></p>
              </div>
              <div class="rounded-xl bg-muted/30 ring-1 ring-border/40 p-4">
                <p class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Access</p>
                <p class="font-heading font-semibold text-lg tracking-tight text-primary mt-3">{isAdmin ? 'Admin' : 'Member'}</p>
              </div>
            </div>

            <div class="h-px bg-gradient-to-r from-transparent via-border/70 to-transparent my-6"></div>

            <div>
              <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-4">Account</p>
              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between gap-4">
                  <span class="text-xs text-muted-foreground shrink-0">Name</span>
                  <span class="font-heading font-medium text-sm tracking-tight text-foreground text-right">{currentUser?.name || '—'}</span>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <span class="text-xs text-muted-foreground shrink-0">Email</span>
                  <span class="font-mono-accent text-xs text-foreground text-right break-all">{currentUser?.email || '—'}</span>
                </div>
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
          </div>
        </aside>

        <div class="lg:col-span-8 flex flex-col gap-4">
          <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border/50 p-5 sm:p-6">
              <div>
                <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Shortcuts</p>
                <h2 class="font-heading font-semibold text-xl tracking-tight text-foreground">Quick actions</h2>
                <p class="text-sm text-muted-foreground mt-1">Jump directly to the parts of your workspace you use most.</p>
              </div>
              <span class="inline-flex items-center rounded-full bg-muted/50 ring-1 ring-border/50 px-3 py-1.5 text-[11px] text-muted-foreground shrink-0">
                {isAdmin ? 'Full access' : 'Role-based access'}
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 sm:p-5">
              {#if hasPermission('users.view')}
                <a href="/users" use:inertia class="group rounded-xl bg-background/70 ring-1 ring-border/50 p-4 flex items-center justify-between gap-3 hover:ring-primary/30 hover:bg-primary/[0.03] transition-colors">
                  <div>
                    <p class="font-heading font-medium text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">Manage users</p>
                    <p class="text-xs text-muted-foreground mt-1">View, create, and edit accounts</p>
                  </div>
                  <ArrowRight class="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </a>
              {/if}
              {#if hasPermission('roles.view')}
                <a href="/roles" use:inertia class="group rounded-xl bg-background/70 ring-1 ring-border/50 p-4 flex items-center justify-between gap-3 hover:ring-primary/30 hover:bg-primary/[0.03] transition-colors">
                  <div>
                    <p class="font-heading font-medium text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">Manage roles</p>
                    <p class="text-xs text-muted-foreground mt-1">Review roles and permissions</p>
                  </div>
                  <ArrowRight class="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </a>
              {/if}
              <a href="/profile" use:inertia class="group rounded-xl bg-background/70 ring-1 ring-border/50 p-4 flex items-center justify-between gap-3 hover:ring-primary/30 hover:bg-primary/[0.03] transition-colors">
                <div>
                  <p class="font-heading font-medium text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">Edit profile</p>
                  <p class="text-xs text-muted-foreground mt-1">Update your name, email, or avatar</p>
                </div>
                <ArrowRight class="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
              </a>
            </div>
          </div>

          <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
            <div class="flex items-start justify-between gap-4 border-b border-border/50 p-5 sm:p-6">
              <div>
                <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Directory</p>
                <h2 class="font-heading font-semibold text-xl tracking-tight text-foreground">Recently added</h2>
                <p class="text-sm text-muted-foreground mt-1">The latest people registered in your workspace.</p>
              </div>
              {#if hasPermission('users.view')}
                <a href="/users" use:inertia class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group shrink-0 mt-1">
                  View all
                  <ArrowUpRight class="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              {/if}
            </div>

            {#if recentUsers.length > 0}
              <div class="flex flex-col p-3 sm:p-4">
                {#each recentUsers as u, i}
                  <div class="flex items-center gap-3 py-3 px-2 rounded-xl {i > 0 ? 'border-t border-border/40' : ''} hover:bg-muted/40 transition-colors">
                    <span class="font-mono-accent text-[11px] text-muted-foreground/50 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-muted to-muted/60 ring-1 ring-border/40 flex items-center justify-center shrink-0">
                      <span class="text-[11px] font-heading font-medium text-foreground">{u.name?.slice(0, 2).toUpperCase() || '—'}</span>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="font-heading font-medium text-sm tracking-tight text-foreground truncate">{u.name || 'Unnamed user'}</p>
                      <p class="text-xs text-muted-foreground truncate font-mono-accent">{u.email || '—'}</p>
                    </div>
                    {#if u.roles?.length}
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 ring-1 ring-primary/20 text-primary text-[10px] font-heading capitalize shrink-0">{u.roles[0]}</span>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <div class="flex flex-col items-center justify-center text-center min-h-[220px] px-6">
                <div class="w-12 h-12 rounded-full bg-muted/50 ring-1 ring-border/50 flex items-center justify-center mb-4">
                  <Users class="w-5 h-5 text-muted-foreground" />
                </div>
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
