<script lang="ts">
  import { fly } from 'svelte/transition';
  import axios from 'axios';
  import Header from '../Components/Header.svelte';
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import { Avatar, AvatarImage, AvatarFallback } from '$lib/components/ui/avatar';
  import { Separator } from '$lib/components/ui/separator';
  import { Badge } from '$lib/components/ui/badge';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
  import { Loader2, Camera } from '@lucide/svelte';

  interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    roles: string[];
    permissions: string[];
    is_verified: boolean;
  }

  interface Props {
    user: User;
  }

  let { user }: Props = $props();

  let current_password: string = $state('');
  let new_password: string = $state('');
  let confirm_password: string = $state('');
  let isLoading: boolean = $state(false);
  let previewUrl: string | null = $derived(user.avatar || null);

  function handleAvatarChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      isLoading = true;
      axios
        .post('/assets/avatar', formData)
        .then((response) => {
          setTimeout(() => {
            isLoading = false;
            previewUrl = response.data.data.url + '?v=' + Date.now();
          }, 500);
          user.avatar = response.data.data.url + '?v=' + Date.now();
          Toast('Avatar berhasil diupload', 'success');
        })
        .catch(() => {
          isLoading = false;
          Toast('Gagal mengupload avatar', 'error');
        });
    }
  }

  async function changeProfile(): Promise<void> {
    isLoading = true;
    await api(() => axios.post('/change-profile', user));
    isLoading = false;
  }

  async function changePassword(): Promise<void> {
    if (new_password != confirm_password) {
      Toast('Password tidak cocok', 'error');
      return;
    }

    if (!current_password || !new_password || !confirm_password) {
      Toast('Mohon isi semua field', 'error');
      return;
    }

    isLoading = true;
    const result = await api(() =>
      axios.post('/change-password', {
        current_password,
        new_password,
      })
    );

    if (result.success) {
      current_password = '';
      new_password = '';
      confirm_password = '';
    }
    isLoading = false;
  }
</script>

<Header group="profile" />

<div class="min-h-screen bg-surface-light dark:bg-surface-dark text-slate-900 dark:text-slate-100 transition-colors duration-500 overflow-x-hidden selection:bg-primary-400 selection:text-black">
  
  <div class="fixed inset-0 pointer-events-none z-0">
    <div class="absolute top-0 right-0 w-[600px] h-[600px] bg-info-500/5 rounded-full blur-3xl -mr-64 -mt-64"></div>
    <div class="absolute bottom-0 left-0 w-[800px] h-[800px] bg-primary-500/5 rounded-full blur-3xl -ml-96 -mb-96"></div>
  </div>

  <section class="relative px-6 sm:px-12 lg:px-24 pt-24 pb-20">
    <div class="max-w-[90rem] mx-auto">
      
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 mb-20">
        
        <div class="lg:col-span-4" in:fly={{ x: -50, duration: 800 }}>
          <p class="text-xs font-bold uppercase tracking-[0.3em] text-info-600 dark:text-info-400 mb-6">
            Account
          </p>
          <h1 class="text-4xl sm:text-5xl lg:text-6xl leading-[0.9] font-bold tracking-tighter mb-8">
            YOUR
            <span class="block text-transparent bg-clip-text bg-gradient-to-r from-info-500 to-primary-400">
              PROFILE
            </span>
          </h1>

          <Card class="relative overflow-hidden border-slate-200 dark:border-white/5 bg-surface-card-light dark:bg-surface-card-dark rounded-3xl">
            <div class="absolute top-0 right-0 p-32 bg-info-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <CardHeader class="relative z-10 pb-0">
              <div class="flex items-center gap-6 mb-4">
                <div class="relative group">
                  <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-info-500 to-primary-500 p-0.5">
                    <div class="w-full h-full rounded-2xl bg-surface-card-light dark:bg-surface-card-dark flex items-center justify-center overflow-hidden">
                      <Avatar class="h-full w-full rounded-2xl">
                        {#if previewUrl}
                          <AvatarImage src={previewUrl} alt="Profile" class="object-cover" />
                        {/if}
                        <AvatarFallback class="text-3xl font-bold bg-transparent text-transparent bg-clip-text bg-gradient-to-br from-info-500 to-primary-500 rounded-2xl">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                  <label class="absolute -bottom-2 -right-2 w-8 h-8 bg-slate-900 dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                    <Camera class="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onchange={handleAvatarChange}
                      class="hidden"
                    />
                  </label>
                </div>
                <div>
                  <h2 class="text-2xl font-bold tracking-tight mb-1">{user.name}</h2>
                  <p class="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent class="relative z-10 pt-4">
              <div class="flex flex-wrap gap-2 mb-6">
                <Badge variant="outline" class={user.roles?.includes('admin') ? 'bg-accent-500/10 text-accent-600 border-accent-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 border-slate-300'}>
                  {user.roles?.includes('admin') ? 'Administrator' : 'Standard User'}
                </Badge>
                <Badge variant="outline" class={user.is_verified ? 'bg-primary-500/10 text-primary-600 border-primary-500/20' : 'bg-warning-500/10 text-warning-600 border-warning-500/20'}>
                  {user.is_verified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>

              <div class="space-y-3">
                <div class="flex items-center gap-3 text-sm">
                  <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span class="font-mono text-slate-600 dark:text-slate-300">{user.phone || '—'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div class="mt-6 p-4 border border-slate-200 dark:border-white/5 rounded-2xl">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div>
                <p class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Secure Storage</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Your data is encrypted and stored securely on Nara's backend infrastructure.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-8" in:fly={{ x: 50, duration: 800, delay: 200 }}>
          
          <Tabs value="personal" class="w-full">
            <TabsList class="grid w-full max-w-md grid-cols-2 mb-8 bg-surface-card-light dark:bg-surface-card-dark rounded-full p-1 border border-slate-200 dark:border-white/5 h-14">
              <TabsTrigger value="personal" class="rounded-full data-[state=active]:bg-info-500 data-[state=active]:text-white h-full text-sm font-bold uppercase tracking-wider">
                Personal Info
              </TabsTrigger>
              <TabsTrigger value="security" class="rounded-full data-[state=active]:bg-warning-500 data-[state=active]:text-white h-full text-sm font-bold uppercase tracking-wider">
                Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal" class="space-y-6 outline-none focus-visible:ring-0 mt-0">
              <Card class="bg-surface-card-light dark:bg-surface-card-dark border-slate-200 dark:border-white/5 rounded-3xl">
                <CardHeader>
                  <CardTitle class="text-xl font-bold tracking-tight">Personal Information</CardTitle>
                  <CardDescription>Update your personal details and public profile.</CardDescription>
                </CardHeader>
                <Separator class="bg-slate-200 dark:bg-white/5" />
                <CardContent class="pt-6">
                  <form onsubmit={(e) => { e.preventDefault(); changeProfile(); }} class="space-y-6">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div class="space-y-2">
                        <Label for="name" class="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</Label>
                        <Input id="name" type="text" bind:value={user.name} placeholder="Your full name" class="rounded-xl h-12 bg-white dark:bg-black/50 border-slate-200 dark:border-slate-700" />
                      </div>
                      <div class="space-y-2">
                        <Label for="phone" class="text-xs font-bold uppercase tracking-wider text-slate-500">Phone Number</Label>
                        <Input id="phone" type="text" bind:value={user.phone} placeholder="+62 xxx xxxx xxxx" class="rounded-xl h-12 bg-white dark:bg-black/50 border-slate-200 dark:border-slate-700" />
                      </div>
                    </div>

                    <div class="space-y-2">
                      <Label for="email" class="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</Label>
                      <Input id="email" type="email" bind:value={user.email} placeholder="you@example.com" class="rounded-xl h-12 bg-white dark:bg-black/50 border-slate-200 dark:border-slate-700" />
                    </div>

                    <div class="flex justify-end pt-4">
                      <Button type="submit" disabled={isLoading} class="px-8 h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black font-bold uppercase tracking-wider text-xs hover:bg-info-500 dark:hover:bg-info-500 hover:text-white transition-colors duration-300">
                        {#if isLoading}
                          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        {:else}
                          Save Changes
                        {/if}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" class="space-y-6 outline-none focus-visible:ring-0 mt-0">
              <Card class="bg-surface-card-light dark:bg-surface-card-dark border-slate-200 dark:border-white/5 rounded-3xl">
                <CardHeader>
                  <CardTitle class="text-xl font-bold tracking-tight">Change Password</CardTitle>
                  <CardDescription>Ensure your account is using a long, random password to stay secure.</CardDescription>
                </CardHeader>
                <Separator class="bg-slate-200 dark:bg-white/5" />
                <CardContent class="pt-6">
                  <form onsubmit={(e) => { e.preventDefault(); changePassword(); }} class="space-y-6">
                    <div class="space-y-2">
                      <Label for="current_password" class="text-xs font-bold uppercase tracking-wider text-slate-500">Current Password</Label>
                      <Input id="current_password" type="password" bind:value={current_password} placeholder="••••••••" class="rounded-xl h-12 bg-white dark:bg-black/50 border-slate-200 dark:border-slate-700" />
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div class="space-y-2">
                        <Label for="new_password" class="text-xs font-bold uppercase tracking-wider text-slate-500">New Password</Label>
                        <Input id="new_password" type="password" bind:value={new_password} placeholder="••••••••" class="rounded-xl h-12 bg-white dark:bg-black/50 border-slate-200 dark:border-slate-700" />
                      </div>
                      <div class="space-y-2">
                        <Label for="confirm_password" class="text-xs font-bold uppercase tracking-wider text-slate-500">Confirm Password</Label>
                        <Input id="confirm_password" type="password" bind:value={confirm_password} placeholder="••••••••" class="rounded-xl h-12 bg-white dark:bg-black/50 border-slate-200 dark:border-slate-700" />
                      </div>
                    </div>

                    <div class="flex justify-end pt-4">
                      <Button variant="outline" type="submit" disabled={isLoading} class="px-8 h-12 rounded-full border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider text-xs hover:border-warning-500 hover:text-warning-500 dark:hover:border-warning-500 dark:hover:text-warning-500 transition-colors duration-300 bg-transparent">
                        {#if isLoading}
                          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        {:else}
                          Update Password
                        {/if}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        </div>
      </div>

    </div>
  </section>

</div>
