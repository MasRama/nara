<script lang="ts">
  import { fly } from 'svelte/transition';
  import axios from 'axios';
  import Header from '../Components/Header.svelte';
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import Input from '../Components/Input.svelte';
  import Label from '../Components/Label.svelte';
  import Button from '../Components/Button.svelte';
  import * as tabs from "@zag-js/tabs";
  import { useMachine, normalizeProps } from "@zag-js/svelte";
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

  interface Props { user: User }

  let { user }: Props = $props();

  let current_password: string = $state('');
  let new_password: string = $state('');
  let confirm_password: string = $state('');
  let isLoading: boolean = $state(false);
  let previewUrl: string | null = $derived(user.avatar || null);

  // Zag Tabs
  const tabsService = useMachine(tabs.machine, { id: "profile-tabs", defaultValue: "personal" });
  const tabsApi = $derived(tabs.connect(tabsService, normalizeProps));

  function handleAvatarChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      isLoading = true;
      axios.post('/assets/avatar', formData)
        .then((response) => {
          setTimeout(() => { isLoading = false; previewUrl = response.data.data.url + '?v=' + Date.now(); }, 500);
          user.avatar = response.data.data.url + '?v=' + Date.now();
          Toast('Avatar berhasil diupload', 'success');
        })
        .catch(() => { isLoading = false; Toast('Gagal mengupload avatar', 'error'); });
    }
  }

  async function changeProfile(): Promise<void> {
    isLoading = true;
    await api(() => axios.post('/change-profile', user));
    isLoading = false;
  }

  async function changePassword(): Promise<void> {
    if (new_password != confirm_password) { Toast('Password tidak cocok', 'error'); return; }
    if (!current_password || !new_password || !confirm_password) { Toast('Mohon isi semua field', 'error'); return; }
    isLoading = true;
    const result = await api(() => axios.post('/change-password', { current_password, new_password }));
    if (result.success) { current_password = ''; new_password = ''; confirm_password = ''; }
    isLoading = false;
  }
</script>

<Header group="profile" />

<div class="min-h-screen bg-background text-foreground font-body transition-colors duration-500">
  <section class="relative px-6 sm:px-12 lg:px-24 pt-28 pb-16">
    <div class="max-w-[90rem] mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">

        <!-- Sidebar -->
        <div class="lg:col-span-4 flex flex-col gap-4" in:fly={{ y: 20, duration: 800 }}>
          <div class="mb-4">
            <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-3">Account</span>
            <h1 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter" style="font-feature-settings: 'ss01'">Profile</h1>
          </div>

          <div class="bg-card border border-border rounded-2xl p-6">
            <div class="flex items-center gap-4 mb-6">
              <div class="relative shrink-0">
                <div class="w-16 h-16 rounded-2xl bg-secondary border border-border overflow-hidden">
                  {#if previewUrl}
                    <img src={previewUrl} alt="Profile" class="aspect-square size-full object-cover" onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  {/if}
                  {#if !previewUrl}
                    <div class="bg-secondary text-foreground font-semibold flex size-full items-center justify-center rounded-2xl text-xl font-heading">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  {/if}
                </div>
                <label class="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-foreground text-background rounded-full flex items-center justify-center cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors duration-200">
                  <Camera class="w-3.5 h-3.5" />
                  <input type="file" accept="image/*" onchange={handleAvatarChange} class="hidden" />
                </label>
              </div>
              <div>
                <h2 class="text-lg font-heading font-semibold tracking-tight">{user.name}</h2>
                <p class="text-sm font-mono-accent text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <span class="font-mono-accent text-[10px] px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary">{user.roles?.includes('admin') ? 'Admin' : 'User'}</span>
              <span class="font-mono-accent text-[10px] px-2.5 py-1 {user.is_verified ? 'bg-primary/10 border border-primary/20 text-primary' : 'bg-secondary text-muted-foreground'} rounded-full">{user.is_verified ? 'Verified' : 'Unverified'}</span>
            </div>
          </div>

          {#if user.phone}
            <div class="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors duration-300">
              <p class="text-xs font-mono-accent text-muted-foreground mb-1.5">Phone</p>
              <p class="text-base font-heading font-semibold tracking-tight font-mono-accent">{user.phone}</p>
            </div>
          {/if}

          <div class="bg-card border border-border rounded-2xl p-5 flex items-start gap-3">
            <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg class="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div>
              <p class="text-xs font-mono-accent font-semibold uppercase tracking-widest text-muted-foreground mb-1">Secure Storage</p>
              <p class="text-xs text-muted-foreground font-body leading-relaxed">Your data is encrypted and stored securely on Nara's backend.</p>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="lg:col-span-8" in:fly={{ y: 20, duration: 800, delay: 150 }}>
          <div {...tabsApi.getRootProps()} class="flex flex-col gap-2 w-full">
            <div {...tabsApi.getListProps()} class="bg-card border border-border text-muted-foreground inline-flex h-auto w-fit items-center justify-center rounded-full p-1 gap-0.5 mb-8">
              <button {...tabsApi.getTriggerProps({ value: "personal" })} class="data-[state=active]:bg-foreground data-[state=active]:text-background text-muted-foreground hover:text-foreground inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-transparent px-5 py-2 text-xs font-mono-accent uppercase tracking-widest whitespace-nowrap transition-all duration-200">
                Personal Info
              </button>
              <button {...tabsApi.getTriggerProps({ value: "security" })} class="data-[state=active]:bg-foreground data-[state=active]:text-background text-muted-foreground hover:text-foreground inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-transparent px-5 py-2 text-xs font-mono-accent uppercase tracking-widest whitespace-nowrap transition-all duration-200">
                Security
              </button>
            </div>

            <div {...tabsApi.getContentProps({ value: "personal" })} class="flex-1 outline-none">
              <div class="bg-card border border-border rounded-2xl p-6 sm:p-8">
                <div class="mb-6">
                  <h3 class="text-lg font-heading font-semibold tracking-tight">Personal Information</h3>
                  <p class="text-sm text-muted-foreground font-body mt-1">Update your personal details and public profile.</p>
                </div>
                <div class="h-px bg-border mb-6"></div>
                <form onsubmit={(e) => { e.preventDefault(); changeProfile(); }} class="space-y-5">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div class="space-y-2">
                      <Label for="name" class="text-xs font-mono-accent font-semibold uppercase tracking-widest text-muted-foreground">Full Name</Label>
                      <Input id="name" type="text" bind:value={user.name} placeholder="Your full name" class="rounded-xl h-11 bg-background border-border font-body text-sm" />
                    </div>
                    <div class="space-y-2">
                      <Label for="phone" class="text-xs font-mono-accent font-semibold uppercase tracking-widest text-muted-foreground">Phone Number</Label>
                      <Input id="phone" type="text" bind:value={user.phone} placeholder="+62 xxx xxxx xxxx" class="rounded-xl h-11 bg-background border-border font-body text-sm" />
                    </div>
                  </div>
                  <div class="space-y-2">
                    <Label for="email" class="text-xs font-mono-accent font-semibold uppercase tracking-widest text-muted-foreground">Email Address</Label>
                    <Input id="email" type="email" bind:value={user.email} placeholder="you@example.com" class="rounded-xl h-11 bg-background border-border font-body text-sm" />
                  </div>
                  <div class="flex justify-end pt-2">
                    <Button type="submit" disabled={isLoading} class="rounded-full px-8 font-heading font-semibold text-sm hover:scale-105 active:scale-95 transition-transform duration-200">
                      {#if isLoading}<Loader2 class="mr-2 h-4 w-4 animate-spin" />Saving...{:else}Save Changes{/if}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            <div {...tabsApi.getContentProps({ value: "security" })} class="flex-1 outline-none">
              <div class="bg-card border border-border rounded-2xl p-6 sm:p-8">
                <div class="mb-6">
                  <h3 class="text-lg font-heading font-semibold tracking-tight">Change Password</h3>
                  <p class="text-sm text-muted-foreground font-body mt-1">Use a long, random password to keep your account secure.</p>
                </div>
                <div class="h-px bg-border mb-6"></div>
                <form onsubmit={(e) => { e.preventDefault(); changePassword(); }} class="space-y-5">
                  <div class="space-y-2">
                    <Label for="current_password" class="text-xs font-mono-accent font-semibold uppercase tracking-widest text-muted-foreground">Current Password</Label>
                    <Input id="current_password" type="password" bind:value={current_password} placeholder="••••••••" class="rounded-xl h-11 bg-background border-border font-body text-sm" />
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div class="space-y-2">
                      <Label for="new_password" class="text-xs font-mono-accent font-semibold uppercase tracking-widest text-muted-foreground">New Password</Label>
                      <Input id="new_password" type="password" bind:value={new_password} placeholder="••••••••" class="rounded-xl h-11 bg-background border-border font-body text-sm" />
                    </div>
                    <div class="space-y-2">
                      <Label for="confirm_password" class="text-xs font-mono-accent font-semibold uppercase tracking-widest text-muted-foreground">Confirm Password</Label>
                      <Input id="confirm_password" type="password" bind:value={confirm_password} placeholder="••••••••" class="rounded-xl h-11 bg-background border-border font-body text-sm" />
                    </div>
                  </div>
                  <div class="flex justify-end pt-2">
                    <Button variant="outline" type="submit" disabled={isLoading} class="rounded-full px-8 font-heading font-semibold text-sm border-border hover:border-primary/40 hover:text-primary transition-colors duration-200">
                      {#if isLoading}<Loader2 class="mr-2 h-4 w-4 animate-spin" />Updating...{:else}Update Password{/if}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>
