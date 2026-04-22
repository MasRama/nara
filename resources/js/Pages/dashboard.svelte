<script lang="ts">
  import { fly } from 'svelte/transition';
  import { page as inertiaPage, inertia } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import { Card, CardContent } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { Users, Settings, Shield, Activity, ChevronRight } from 'lucide-svelte';
  import type { User } from '../types';

  interface Props {
    users?: User[];
    search?: string;
    filter?: string;
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
    filter = 'all', 
    total = 0, 
    page = 1,
    limit = 10,
    totalPages = 1,
    hasNext = false,
    hasPrev = false
  }: Props = $props();

  const currentUser = $derived($inertiaPage.props.user as User | undefined);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
</script>

<Header group="dashboard" />

<div class="min-h-screen bg-background text-foreground font-body transition-colors duration-500">

  <section class="relative px-6 sm:px-12 lg:px-24 pt-28 pb-16">
    <div class="max-w-[90rem] mx-auto">

      <div class="mb-12" in:fly={{ y: 20, duration: 800 }}>
        <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-3">{greeting}</span>
        <h1 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter leading-tight" style="font-feature-settings: 'ss01'">
          Welcome back,
          <span class="text-primary">{currentUser?.name || 'there'}</span>
        </h1>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12" in:fly={{ y: 20, duration: 800, delay: 150 }}>

        <div class="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 transition-colors duration-300 group">
          <div class="flex items-center justify-between mb-4">
            <span class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">Total Users</span>
            <Users class="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
          </div>
          <div>
            <div class="text-3xl font-heading font-bold tracking-tighter text-foreground group-hover:text-primary transition-colors duration-300">{total || users?.length || 0}</div>
            <div class="text-xs font-mono-accent text-muted-foreground mt-1">registered</div>
          </div>
        </div>

        <div class="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 transition-colors duration-300 group">
          <div class="flex items-center justify-between mb-4">
            <span class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">Page</span>
            <Activity class="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
          </div>
          <div>
            <div class="text-3xl font-heading font-bold tracking-tighter text-foreground group-hover:text-primary transition-colors duration-300">
              {page}<span class="text-lg text-muted-foreground font-normal">/{totalPages}</span>
            </div>
            <div class="text-xs font-mono-accent text-muted-foreground mt-1">current view</div>
          </div>
        </div>

        <div class="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 transition-colors duration-300 group">
          <div class="flex items-center justify-between mb-4">
            <span class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">Filter</span>
            <Settings class="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
          </div>
          <div>
            <div class="text-3xl font-heading font-bold tracking-tighter text-foreground capitalize group-hover:text-primary transition-colors duration-300">{filter}</div>
            <div class="text-xs font-mono-accent text-muted-foreground mt-1">active filter</div>
          </div>
        </div>

        <div class="bg-primary text-primary-foreground rounded-2xl p-5 flex flex-col justify-between">
          <div class="flex items-center justify-between mb-4">
            <span class="font-mono-accent text-[10px] uppercase tracking-widest opacity-70">Status</span>
            <Shield class="w-3.5 h-3.5 opacity-70" />
          </div>
          <div>
            <div class="text-3xl font-heading font-bold tracking-tighter">
              {currentUser?.roles?.includes('admin') ? 'Admin' : 'User'}
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span class="inline-flex h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse"></span>
              <div class="text-xs font-mono-accent opacity-80">{currentUser?.is_verified ? 'Verified' : 'Unverified'}</div>
            </div>
          </div>
        </div>

      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6" in:fly={{ y: 20, duration: 800, delay: 300 }}>

        <div class="lg:col-span-5 flex flex-col gap-4">
          <h2 class="text-sm font-mono-accent font-semibold uppercase tracking-widest text-muted-foreground">Account Details</h2>

          <div class="bg-card border border-border rounded-2xl p-6 flex items-center justify-between hover:border-primary/40 transition-colors duration-300">
            <div>
              <p class="text-xs font-mono-accent text-muted-foreground mb-1.5">Email Address</p>
              <p class="text-base font-heading font-semibold tracking-tight">{currentUser?.email}</p>
            </div>
            <Badge variant={currentUser?.is_verified ? 'default' : 'secondary'} class="font-mono-accent text-[10px]">
              {currentUser?.is_verified ? 'Verified' : 'Pending'}
            </Badge>
          </div>

          <div class="bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors duration-300">
            <p class="text-xs font-mono-accent text-muted-foreground mb-1.5">Search Query</p>
            <p class="text-base font-heading font-semibold tracking-tight font-mono-accent">{search || '—'}</p>
          </div>

          <div class="bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors duration-300">
            <p class="text-xs font-mono-accent text-muted-foreground mb-3">Roles</p>
            <div class="flex flex-wrap gap-2">
              {#each (currentUser?.roles ?? []) as role}
                <span class="font-mono-accent text-[11px] px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary capitalize">{role}</span>
              {/each}
              {#if !currentUser?.roles?.length}
                <span class="font-mono-accent text-[11px] px-2.5 py-1 bg-secondary rounded-full text-muted-foreground">No roles</span>
              {/if}
            </div>
          </div>
        </div>

        <div class="lg:col-span-7 flex flex-col gap-4">
          <h2 class="text-sm font-mono-accent font-semibold uppercase tracking-widest text-muted-foreground">Quick Actions</h2>

          <a href="/users" use:inertia class="group bg-card border border-border rounded-2xl p-6 flex items-center justify-between hover:border-primary/40 hover:shadow-sm transition-all duration-300 cursor-pointer">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300 shrink-0">
                <Users class="w-5 h-5 text-foreground group-hover:text-primary transition-colors duration-300" />
              </div>
              <div>
                <h4 class="text-base font-heading font-semibold tracking-tight">Manage Users</h4>
                <p class="text-sm text-muted-foreground font-body mt-0.5">View and manage all registered users</p>
              </div>
            </div>
            <ChevronRight class="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors duration-300 shrink-0" />
          </a>

          <a href="/profile" use:inertia class="group bg-card border border-border rounded-2xl p-6 flex items-center justify-between hover:border-primary/40 hover:shadow-sm transition-all duration-300 cursor-pointer">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300 shrink-0">
                <Settings class="w-5 h-5 text-foreground group-hover:text-primary transition-colors duration-300" />
              </div>
              <div>
                <h4 class="text-base font-heading font-semibold tracking-tight">Edit Profile</h4>
                <p class="text-sm text-muted-foreground font-body mt-0.5">Update your account information</p>
              </div>
            </div>
            <ChevronRight class="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors duration-300 shrink-0" />
          </a>

          <div class="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p class="text-xs font-mono-accent text-primary mb-1">Framework</p>
              <p class="text-base font-heading font-semibold tracking-tight">Nara Framework</p>
              <p class="text-sm text-muted-foreground font-body mt-0.5">HyperExpress · Svelte 5 · Inertia.js</p>
            </div>
            <span class="font-mono-accent text-[11px] px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary">v1.0.0</span>
          </div>
        </div>

      </div>
    </div>
  </section>

</div>
