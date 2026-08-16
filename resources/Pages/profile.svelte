<script lang="ts">
  import { fly } from 'svelte/transition';
  import Header from '../Components/Header.svelte';
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import Input from '../Components/Input.svelte';
  import Label from '../Components/Label.svelte';
  import Button from '../Components/Button.svelte';
  import { Tabs } from 'bits-ui';
  import { Loader2, Camera, Shield } from '@lucide/svelte';
  import type { User } from '../types';

  interface Props { user: User }

  let { user }: Props = $props();

  let current_password: string = $state('');
  let new_password: string = $state('');
  let confirm_password: string = $state('');
  let isLoading: boolean = $state(false);
  let previewUrl: string | null = $derived(user.avatar || null);
  let activeTab: string = $state('personal');

  async function handleAvatarChange(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    isLoading = true;
    try {
      const result = await api('/assets/avatar', { method: 'POST', body: formData });
      if (result.success && result.data) {
        const url = `${(result.data as { url: string }).url}?v=${Date.now()}`;
        previewUrl = url;
        user.avatar = url;
      }
    } finally {
      isLoading = false;
    }
  }

  async function changeProfile(): Promise<void> {
    isLoading = true;
    await api('/change-profile', { method: 'POST', body: user });
    isLoading = false;
  }

  async function changePassword(): Promise<void> {
    if (new_password != confirm_password) { Toast('Passwords do not match', 'error'); return; }
    if (!current_password || !new_password || !confirm_password) { Toast('Please fill in all fields', 'error'); return; }
    isLoading = true;
    const result = await api('/change-password', { method: 'POST', body: { current_password, new_password } });
    if (result.success) { current_password = ''; new_password = ''; confirm_password = ''; }
    isLoading = false;
  }
</script>

<Header group="profile" />

<div class="min-h-[100dvh] bg-background text-foreground font-body antialiased selection:bg-primary/20 selection:text-primary">

  <section class="px-6 sm:px-10 lg:px-16 pt-28 pb-16">
    <div class="max-w-[1400px] mx-auto">

      <!-- Page header -->
      <div class="mb-12" in:fly={{ y: 20, duration: 800 }}>
        <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-4">Account</p>
        <h1 class="font-heading font-semibold tracking-[-0.03em] leading-[1] text-[clamp(2.5rem,6vw,4.5rem)] text-foreground">
          Profile.
        </h1>
        <p class="mt-5 text-lg text-muted-foreground leading-relaxed max-w-[52ch]">
          The face the system sees. Update your name, your photo, or your password.
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12" in:fly={{ y: 20, duration: 800, delay: 150 }}>

        <!-- Sidebar -->
        <div class="lg:col-span-4 flex flex-col gap-6">

          <!-- Identity card -->
          <div class="border border-border rounded-xl bg-card p-6">
            <div class="flex items-center gap-4 mb-6">
              <div class="relative shrink-0">
                <div class="w-16 h-16 rounded-full bg-muted border border-border overflow-hidden">
                  {#if previewUrl}
                    <img src={previewUrl} alt="Profile" class="aspect-square size-full object-cover" onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  {/if}
                  {#if !previewUrl}
                    <div class="bg-muted text-foreground font-heading font-semibold flex size-full items-center justify-center text-2xl">
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                  {/if}
                </div>
                <label class="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-foreground text-background rounded-full flex items-center justify-center cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors border border-border">
                  <Camera class="w-3.5 h-3.5" />
                  <input type="file" accept="image/*" onchange={handleAvatarChange} class="hidden" />
                </label>
              </div>
              <div class="min-w-0">
                <h2 class="text-lg font-heading font-semibold tracking-tight text-foreground truncate">{user.name}</h2>
                <p class="text-sm text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-heading font-medium capitalize {user.roles?.includes('admin') ? 'bg-primary/10 border border-primary/20 text-primary' : 'bg-muted text-muted-foreground border border-border'}">
                {user.roles?.includes('admin') ? 'Admin' : 'User'}
              </span>
            </div>
          </div>

          <!-- Security note -->
          <div class="border border-border rounded-xl bg-card p-5 flex items-start gap-3">
            <div class="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <Shield class="w-4 h-4 text-primary" />
            </div>
            <div>
              <p class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Encrypted</p>
              <p class="text-xs text-muted-foreground leading-relaxed">Your data is encrypted at rest and in transit on Nara's backend.</p>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="lg:col-span-8">
          <Tabs.Root bind:value={activeTab} class="flex flex-col gap-2 w-full">

            <!-- Tab triggers -->
            <Tabs.List class="border border-border rounded-xl inline-flex h-auto w-fit items-stretch bg-card p-1 gap-0.5 mb-8">
              <Tabs.Trigger value="personal" class="data-[state=active]:bg-foreground data-[state=active]:text-background text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-lg px-5 py-2 text-sm font-heading font-medium whitespace-nowrap transition-colors">
                Personal info
              </Tabs.Trigger>
              <Tabs.Trigger value="security" class="data-[state=active]:bg-foreground data-[state=active]:text-background text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-lg px-5 py-2 text-sm font-heading font-medium whitespace-nowrap transition-colors">
                Security
              </Tabs.Trigger>
            </Tabs.List>

            <!-- Personal info -->
            <Tabs.Content value="personal" class="flex-1 outline-none">
              <div class="border border-border rounded-xl bg-card p-6 sm:p-8">
                <div class="mb-6">
                  <h3 class="text-xl font-heading font-semibold tracking-tight text-foreground">Personal information</h3>
                  <p class="text-sm text-muted-foreground mt-1">Update your personal details and public profile.</p>
                </div>
                <div class="h-px bg-border mb-6"></div>
                <form onsubmit={(e) => { e.preventDefault(); changeProfile(); }} class="flex flex-col gap-5">
                  <div class="flex flex-col gap-2">
                    <Label for="name" class="text-xs uppercase tracking-[0.2em] font-heading text-muted-foreground">Full name</Label>
                    <Input id="name" type="text" bind:value={user.name} placeholder="Your full name" class="h-12 rounded-xl" />
                  </div>
                  <div class="flex flex-col gap-2">
                    <Label for="email" class="text-xs uppercase tracking-[0.2em] font-heading text-muted-foreground">Email</Label>
                    <Input id="email" type="email" bind:value={user.email} placeholder="you@example.com" class="h-12 rounded-xl" />
                  </div>
                  <div class="flex justify-end pt-2">
                    <Button type="submit" disabled={isLoading} size="lg">
                      {#if isLoading}<Loader2 class="w-4 h-4 animate-spin" />Saving...{:else}Save changes{/if}
                    </Button>
                  </div>
                </form>
              </div>
            </Tabs.Content>

            <!-- Security -->
            <Tabs.Content value="security" class="flex-1 outline-none">
              <div class="border border-border rounded-xl bg-card p-6 sm:p-8">
                <div class="mb-6">
                  <h3 class="text-xl font-heading font-semibold tracking-tight text-foreground">Change password</h3>
                  <p class="text-sm text-muted-foreground mt-1">Use a long, random password to keep your account secure.</p>
                </div>
                <div class="h-px bg-border mb-6"></div>
                <form onsubmit={(e) => { e.preventDefault(); changePassword(); }} class="flex flex-col gap-5">
                  <div class="flex flex-col gap-2">
                    <Label for="current_password" class="text-xs uppercase tracking-[0.2em] font-heading text-muted-foreground">Current password</Label>
                    <Input id="current_password" type="password" bind:value={current_password} placeholder="••••••••" class="h-12 rounded-xl" />
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div class="flex flex-col gap-2">
                      <Label for="new_password" class="text-xs uppercase tracking-[0.2em] font-heading text-muted-foreground">New password</Label>
                      <Input id="new_password" type="password" bind:value={new_password} placeholder="••••••••" class="h-12 rounded-xl" />
                    </div>
                    <div class="flex flex-col gap-2">
                      <Label for="confirm_password" class="text-xs uppercase tracking-[0.2em] font-heading text-muted-foreground">Confirm password</Label>
                      <Input id="confirm_password" type="password" bind:value={confirm_password} placeholder="••••••••" class="h-12 rounded-xl" />
                    </div>
                  </div>
                  <div class="flex justify-end pt-2">
                    <Button variant="outline" type="submit" disabled={isLoading} size="lg">
                      {#if isLoading}<Loader2 class="w-4 h-4 animate-spin" />Updating...{:else}Update password{/if}
                    </Button>
                  </div>
                </form>
              </div>
            </Tabs.Content>
          </Tabs.Root>
        </div>

      </div>
    </div>
  </section>
</div>
