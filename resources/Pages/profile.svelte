<script lang="ts">
  import Header from '../Components/Header.svelte';
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import FloatingInput from '../Components/FloatingInput.svelte';
  import Button from '../Components/Button.svelte';
  import { Tabs } from 'bits-ui';
  import { Camera, Info, Loader2, LockKeyhole, Shield, UserRound } from '@lucide/svelte';
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

<div class="min-h-[100dvh] bg-background text-foreground font-body antialiased selection:bg-primary/20 selection:text-primary overflow-x-hidden">

  <div class="fixed inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-foreground"></div>

  <section class="relative px-6 sm:px-10 lg:px-16 pt-28 pb-16">
    <div class="max-w-[1400px] mx-auto">

      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
        <div>
          <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Account</p>
          <h1 class="font-heading font-semibold tracking-[-0.02em] text-2xl sm:text-3xl text-foreground">
            Profile <span class="text-muted-foreground font-normal">— make it yours.</span>
          </h1>
        </div>

        <div class="inline-flex items-center gap-x-4 font-mono-accent text-xs text-muted-foreground rounded-full bg-card/60 ring-1 ring-border/40 px-4 py-2 backdrop-blur-sm w-fit">
          <span class="inline-flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-primary"></span> account</span>
          <span class="w-px h-3 bg-border/60"></span>
          <span>protected</span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">

        <aside class="lg:col-span-4 flex flex-col gap-4">
          <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] p-6">
            <div class="flex items-start justify-between gap-4">
              <div class="relative shrink-0">
                <div class="w-16 h-16 rounded-full bg-gradient-to-br from-muted to-muted/60 ring-1 ring-border/40 overflow-hidden">
                  {#if previewUrl}
                    <img src={previewUrl} alt="Profile" class="aspect-square size-full object-cover" onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  {:else}
                    <div class="bg-muted text-foreground font-heading font-semibold flex size-full items-center justify-center text-2xl">
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                  {/if}
                </div>
                <label class="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-foreground text-background rounded-full flex items-center justify-center cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors ring-1 ring-border {isLoading ? 'pointer-events-none opacity-50' : ''}" aria-label="Change profile photo">
                  <Camera class="w-3.5 h-3.5" />
                  <input type="file" accept="image/*" onchange={handleAvatarChange} class="hidden" />
                </label>
              </div>
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-heading font-medium capitalize {user.roles?.includes('admin') ? 'bg-primary/10 ring-1 ring-primary/20 text-primary' : 'bg-muted ring-1 ring-border/50 text-muted-foreground'}">
                {user.roles?.includes('admin') ? 'Admin' : 'User'}
              </span>
            </div>

            <div class="mt-5">
              <h2 class="text-lg font-heading font-semibold tracking-tight text-foreground truncate">{user.name}</h2>
              <p class="text-sm text-muted-foreground truncate font-mono-accent mt-1">{user.email}</p>
            </div>

            <div class="h-px bg-gradient-to-r from-transparent via-border/70 to-transparent my-5"></div>

            <dl class="flex flex-col gap-4">
              <div class="flex items-center justify-between gap-4">
                <dt class="text-xs text-muted-foreground">Account type</dt>
                <dd class="text-sm font-heading font-medium text-foreground">Personal</dd>
              </div>
              <div class="flex items-center justify-between gap-4">
                <dt class="text-xs text-muted-foreground">Access level</dt>
                <dd class="text-sm font-heading font-medium text-foreground">{user.roles?.includes('admin') ? 'Administrator' : 'Standard'}</dd>
              </div>
            </dl>
          </div>

          <div class="rounded-2xl bg-primary/[0.04] ring-1 ring-primary/20 p-5 flex items-start gap-3">
            <div class="w-9 h-9 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <Shield class="w-4 h-4 text-primary" />
            </div>
            <div>
              <p class="font-heading text-[11px] uppercase tracking-[0.25em] text-primary mb-1">Privacy first</p>
              <p class="text-xs text-muted-foreground leading-relaxed">Your account details stay protected with Nara's session-based security.</p>
            </div>
          </div>
        </aside>

        <div class="lg:col-span-8">
          <Tabs.Root bind:value={activeTab} class="w-full">
            <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
              <div class="border-b border-border/50 px-6 pt-6 sm:px-8 sm:pt-8">
                <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Settings</p>
                    <h2 class="text-xl font-heading font-semibold tracking-tight text-foreground">Account settings</h2>
                    <p class="text-sm text-muted-foreground mt-1">Keep your personal details and sign-in access up to date.</p>
                  </div>

                  <Tabs.List class="grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1 sm:flex sm:w-fit sm:shrink-0 sm:rounded-none sm:bg-transparent sm:p-0">
                    <Tabs.Trigger
                      value="personal"
                      class="relative inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-heading font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:rounded-none sm:px-3 sm:py-3 sm:data-[state=active]:bg-transparent sm:data-[state=active]:shadow-none"
                    >
                      <UserRound class="w-3.5 h-3.5 {activeTab === 'personal' ? 'text-primary' : ''}" />
                      Personal info
                      <span class="absolute inset-x-3 -bottom-px h-0.5 {activeTab === 'personal' ? 'bg-primary' : 'bg-transparent'}"></span>
                    </Tabs.Trigger>
                    <Tabs.Trigger
                      value="security"
                      class="relative inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-heading font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:rounded-none sm:px-3 sm:py-3 sm:data-[state=active]:bg-transparent sm:data-[state=active]:shadow-none"
                    >
                      <LockKeyhole class="w-3.5 h-3.5 {activeTab === 'security' ? 'text-primary' : ''}" />
                      Security
                      <span class="absolute inset-x-3 -bottom-px h-0.5 {activeTab === 'security' ? 'bg-primary' : 'bg-transparent'}"></span>
                    </Tabs.Trigger>
                  </Tabs.List>
                </div>
              </div>

              <Tabs.Content value="personal" class="outline-none p-6 sm:p-8">
                  <form onsubmit={(e) => { e.preventDefault(); changeProfile(); }} class="flex flex-col gap-6">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <FloatingInput id="name" type="text" bind:value={user.name} label="Full name" />
                      <FloatingInput id="email" type="email" bind:value={user.email} label="Email" />
                    </div>

                    <div class="flex items-start gap-3 rounded-xl bg-muted/40 ring-1 ring-border/40 p-4">
                      <Info class="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p class="font-heading text-xs font-medium text-foreground">Profile details</p>
                        <p class="text-xs text-muted-foreground leading-relaxed mt-1">Use a name and email address that make it easy for your team to recognize you.</p>
                      </div>
                    </div>

                    <div class="flex flex-col gap-4 border-t border-border/50 pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p class="font-heading text-sm font-medium text-foreground">Personal information</p>
                        <p class="text-xs text-muted-foreground mt-1">Changes are saved to your account immediately.</p>
                      </div>
                      <Button type="submit" disabled={isLoading} size="lg" class="rounded-xl">
                        {#if isLoading}<Loader2 class="w-4 h-4 animate-spin" />Saving...{:else}Save changes{/if}
                      </Button>
                    </div>
                  </form>
              </Tabs.Content>

              <Tabs.Content value="security" class="outline-none p-6 sm:p-8">
                  <div class="flex items-start gap-3 rounded-xl bg-primary/[0.04] ring-1 ring-primary/20 p-4 mb-6">
                    <div class="w-9 h-9 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                      <Shield class="w-4 h-4 text-primary" />
                    </div>
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="font-heading text-sm font-medium text-foreground">Password protection</p>
                        <span class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-heading font-medium text-primary ring-1 ring-primary/20">Enabled</span>
                      </div>
                      <p class="text-xs text-muted-foreground leading-relaxed mt-1">Choose a password you do not use anywhere else.</p>
                    </div>
                  </div>

                  <form onsubmit={(e) => { e.preventDefault(); changePassword(); }} class="flex flex-col gap-6">
                    <div>
                      <p class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Current password</p>
                      <p class="text-xs text-muted-foreground mb-4">Confirm your current password before setting a new one.</p>
                      <FloatingInput id="current_password" type="password" bind:value={current_password} label="Current password" />
                    </div>

                    <div class="border-t border-border/50 pt-6">
                      <p class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-1">New password</p>
                      <p class="text-xs text-muted-foreground mb-4">Make it long, unique, and difficult to guess.</p>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <FloatingInput id="new_password" type="password" bind:value={new_password} label="New password" />
                        <FloatingInput id="confirm_password" type="password" bind:value={confirm_password} label="Confirm password" />
                      </div>
                    </div>

                    <div class="flex flex-col gap-4 border-t border-border/50 pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p class="font-heading text-sm font-medium text-foreground">Update password</p>
                        <p class="text-xs text-muted-foreground mt-1">You will stay signed in on this device.</p>
                      </div>
                      <Button variant="outline" type="submit" disabled={isLoading} size="lg" class="rounded-xl">
                        {#if isLoading}<Loader2 class="w-4 h-4 animate-spin" />Updating...{:else}Update password{/if}
                      </Button>
                    </div>
                  </form>
              </Tabs.Content>
            </div>
          </Tabs.Root>
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
