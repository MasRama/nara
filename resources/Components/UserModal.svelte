<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Input from './Input.svelte';
  import Label from './Label.svelte';
  import Button from './Button.svelte';
  import Switch from './Switch.svelte';
  import * as dialog from "@zag-js/dialog";
  import { useMachine, normalizeProps, portal } from "@zag-js/svelte";
  import { Loader2 } from '@lucide/svelte';
  import type { UserForm, RoleInfo } from '../types';

  let {
    show = false,
    mode = 'create',
    form,
    isSubmitting = false,
    availableRoles = []
  }: {
    show?: boolean;
    mode?: 'create' | 'edit';
    form: UserForm;
    isSubmitting?: boolean;
    availableRoles?: RoleInfo[];
  } = $props();

  const dispatch = createEventDispatcher<{
    close: void;
    submit: UserForm;
  }>();

  const dialogService = useMachine(dialog.machine, {
    id: "user-modal",
    get open() { return show; },
    onOpenChange(details) {
      if (!details.open) dispatch('close');
    },
  });
  const dialogApi = $derived(dialog.connect(dialogService, normalizeProps));

  function handleClose(): void {
    dispatch('close');
  }

  function handleSubmit(): void {
    dispatch('submit', form);
  }

  function toggleRole(slug: string, checked: boolean): void {
    if (checked) {
      form.roles = [...(form.roles || []), slug];
    } else {
      form.roles = (form.roles || []).filter(r => r !== slug);
    }
  }

  function hasRole(slug: string): boolean {
    return form.roles?.includes(slug) ?? false;
  }
</script>

{#if dialogApi.open}
  <div use:portal>
    <div {...dialogApi.getBackdropProps()} class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"></div>
    <div {...dialogApi.getPositionerProps()}>
      <div {...dialogApi.getContentProps()} class="bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border shadow-lg sm:max-w-md font-body overflow-hidden">

        <div class="px-6 pt-6 pb-5 border-b border-border">
          <span class="text-[10px] font-mono-accent uppercase tracking-widest text-primary mb-2 block">
            {mode === 'create' ? 'New User' : 'Edit User'}
          </span>
          <h2 {...dialogApi.getTitleProps()} class="font-heading font-semibold text-xl tracking-tight" style="font-feature-settings: 'ss01'">
            {mode === 'create' ? 'Create User' : 'Update User'}
          </h2>
          <p {...dialogApi.getDescriptionProps()} class="text-sm text-muted-foreground font-body mt-1">
            {mode === 'create' ? 'Add a new user to the system.' : 'Make changes to the user profile here.'}
          </p>
        </div>

        <form id="user-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div class="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            <div class="space-y-2">
              <Label for="name" class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">Full Name</Label>
              <Input id="name" type="text" bind:value={form.name} placeholder="Enter full name" class="rounded-xl h-11 bg-background border-border font-body text-sm" required />
            </div>
            <div class="space-y-2">
              <Label for="email" class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">Email Address</Label>
              <Input id="email" type="email" bind:value={form.email} placeholder="user@example.com" class="rounded-xl h-11 bg-background border-border font-body text-sm" required />
            </div>
            <div class="space-y-2">
              <Label for="phone" class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">Phone <span class="normal-case tracking-normal font-body text-muted-foreground">(optional)</span></Label>
              <Input id="phone" type="text" bind:value={form.phone} placeholder="+62 xxx xxxx xxxx" class="rounded-xl h-11 bg-background border-border font-body text-sm" />
            </div>
            <div class="space-y-2">
              <Label for="password" class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">{mode === 'create' ? 'Password' : 'New Password'} <span class="normal-case tracking-normal font-body text-muted-foreground">(optional)</span></Label>
              <Input id="password" type="password" bind:value={form.password} placeholder={mode === 'create' ? 'Leave empty to use email' : 'Leave empty to keep current'} class="rounded-xl h-11 bg-background border-border font-body text-sm" />
            </div>

            <div class="space-y-3">
              <Label class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">Roles</Label>
              <div class="grid grid-cols-2 gap-2">
                {#each availableRoles as role}
                  <div class="flex items-center gap-3 bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/40 transition-colors duration-200">
                    <Switch checked={hasRole(role.slug)} onCheckedChange={(c: boolean) => toggleRole(role.slug, c)} id="role-{role.slug}" />
                    <div>
                      <Label for="role-{role.slug}" class="text-sm font-heading font-semibold cursor-pointer capitalize">{role.name}</Label>
                      {#if role.description}
                        <p class="text-[10px] font-mono-accent text-muted-foreground mt-0.5 line-clamp-1">{role.description}</p>
                      {/if}
                    </div>
                  </div>
                {/each}
                {#if availableRoles.length === 0}
                  <p class="text-xs text-muted-foreground font-mono-accent col-span-2">No roles available</p>
                {/if}
              </div>
            </div>

            <div class="flex items-center gap-3 bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/40 transition-colors duration-200">
              <Switch bind:checked={form.is_verified} id="verified-status" />
              <div>
                <Label for="verified-status" class="text-sm font-heading font-semibold cursor-pointer">Verified</Label>
                <p class="text-xs font-mono-accent text-muted-foreground mt-0.5">Email confirmed</p>
              </div>
            </div>
          </div>
        </form>

        <div class="px-6 py-4 border-t border-border flex gap-2">
          <Button variant="outline" onclick={handleClose} disabled={isSubmitting} class="rounded-full font-mono-accent text-xs uppercase tracking-widest border-border hover:border-primary/40 hover:text-primary transition-colors duration-200">Cancel</Button>
          <Button type="submit" form="user-form" disabled={isSubmitting} class="rounded-full font-mono-accent text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-transform duration-200">
            {#if isSubmitting}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
            {mode === 'create' ? 'Create User' : 'Save Changes'}
          </Button>
        </div>

        <button {...dialogApi.getCloseTriggerProps()} class="absolute end-4 top-4 rounded-lg opacity-50 transition-opacity hover:opacity-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          <span class="sr-only">Close</span>
        </button>
      </div>
    </div>
  </div>
{/if}
