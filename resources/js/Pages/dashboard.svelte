<script lang="ts">
  import { fly } from 'svelte/transition';
  import { page as inertiaPage, inertia } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
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

<div class="min-h-screen bg-background text-foreground transition-colors duration-500 overflow-x-hidden">
  
  <section class="relative px-6 sm:px-12 lg:px-24 pt-24 pb-20">
    <div class="max-w-[90rem] mx-auto">
      
      <div class="mb-16" in:fly={{ y: 50, duration: 800 }}>
        <p class="text-xs font-bold uppercase tracking-[0.3em] text-primary mb-6">
          {greeting}
        </p>
        <h1 class="text-4xl sm:text-6xl lg:text-7xl leading-tight font-bold tracking-tighter">
          Welcome back,
          <span class="block text-primary">
            {currentUser?.name || 'Commander'}
          </span>
        </h1>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20" in:fly={{ y: 30, duration: 800, delay: 200 }}>
        
        <Card class="relative overflow-hidden">
          <CardHeader class="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle class="text-sm font-medium uppercase tracking-wider text-muted-foreground">Users</CardTitle>
            <Users class="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-4xl font-bold">{total || users?.length || 0}</div>
            <p class="text-xs text-muted-foreground mt-1">Total registered</p>
          </CardContent>
        </Card>

        <Card class="relative overflow-hidden">
          <CardHeader class="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle class="text-sm font-medium uppercase tracking-wider text-muted-foreground">Page</CardTitle>
            <Activity class="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-4xl font-bold">{page}<span class="text-xl text-muted-foreground">/{totalPages}</span></div>
            <p class="text-xs text-muted-foreground mt-1">Current view</p>
          </CardContent>
        </Card>

        <Card class="relative overflow-hidden">
          <CardHeader class="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle class="text-sm font-medium uppercase tracking-wider text-muted-foreground">Filter</CardTitle>
            <Settings class="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-4xl font-bold capitalize">{filter}</div>
            <p class="text-xs text-muted-foreground mt-1">Active filter</p>
          </CardContent>
        </Card>

        <Card class="relative overflow-hidden bg-primary text-primary-foreground border-none">
          <CardHeader class="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle class="text-sm font-medium uppercase tracking-wider opacity-80 text-primary-foreground">Status</CardTitle>
            <Shield class="w-4 h-4 opacity-80" />
          </CardHeader>
          <CardContent>
            <div class="text-4xl font-bold">{currentUser?.roles?.includes('admin') ? 'Admin' : 'User'}</div>
            <div class="flex items-center gap-2 mt-2">
              <span class="inline-flex h-2 w-2 rounded-full bg-background animate-pulse"></span>
              <p class="text-xs opacity-90">{currentUser?.is_verified ? 'Verified' : 'Unverified'}</p>
            </div>
          </CardContent>
        </Card>

      </div>

      <Separator class="my-10" />

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8" in:fly={{ y: 30, duration: 800, delay: 400 }}>
        
        <div class="lg:col-span-5">
          <h2 class="text-lg font-semibold tracking-tight mb-6">Account Details</h2>
          
          <div class="space-y-4">
            <Card>
              <CardContent class="p-6">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium text-muted-foreground mb-1">Email Address</p>
                    <p class="text-lg font-medium">{currentUser?.email}</p>
                  </div>
                  <Badge variant={currentUser?.is_verified ? 'default' : 'secondary'}>
                    {currentUser?.is_verified ? 'Verified' : 'Pending'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent class="p-6">
                <p class="text-sm font-medium text-muted-foreground mb-1">Search Query</p>
                <p class="text-lg font-medium font-mono">{search || '—'}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div class="lg:col-span-7">
          <h2 class="text-lg font-semibold tracking-tight mb-6">Quick Actions</h2>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card class="group hover:border-primary transition-colors duration-300">
              <a href="/users" use:inertia class="block h-full">
                <CardHeader>
                  <div class="flex items-center justify-between mb-2">
                    <div class="p-2 bg-secondary rounded-lg">
                      <Users class="w-5 h-5 text-secondary-foreground" />
                    </div>
                    <ChevronRight class="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle class="text-xl">Manage Users</CardTitle>
                  <CardDescription>View and manage all registered users</CardDescription>
                </CardHeader>
              </a>
            </Card>

            <Card class="group hover:border-primary transition-colors duration-300">
              <a href="/profile" use:inertia class="block h-full">
                <CardHeader>
                  <div class="flex items-center justify-between mb-2">
                    <div class="p-2 bg-secondary rounded-lg">
                      <Settings class="w-5 h-5 text-secondary-foreground" />
                    </div>
                    <ChevronRight class="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle class="text-xl">Edit Profile</CardTitle>
                  <CardDescription>Update your account information</CardDescription>
                </CardHeader>
              </a>
            </Card>
          </div>
        </div>
      </div>

    </div>
  </section>

</div>