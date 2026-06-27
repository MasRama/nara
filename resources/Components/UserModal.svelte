<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Input from './Input.svelte';
  import Label from './Label.svelte';
  import Button from './Button.svelte';
  import Switch from './Switch.svelte';
  import * as dialog from "@zag-js/dialog";
  import { useMachine, normalizeProps, portal } from "@zag-js/svelte";
  import { Loader2, X } from '@lucide/svelte';
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
      <div {...dialogApi.getContentProps()} class="bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-sm border border-border shadow-lg sm:max-w-md font-body overflow-hidden">

        <div class="px-6 pt-6 pb-5 border-b border-border flex items-start justify-between gap-4">
          <div>
            <p class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
              {mode === 'create' ? 'New user' : 'Edit user'}
            </p>
            <h2 {...dialogApi.getTitleProps()} class="font-heading font-semibold text-xl tracking-tight text-foreground">
              {mode === 'create' ? 'Create a user' : 'Update user'}
            </h2>
            <p {...dialogApi.getDescriptionProps()} class="text-sm text-muted-foreground font-body mt-1">
              {mode === 'create' ? 'Add a new person to the system.' : 'Make changes to this account.'}
            </p>
          </div>
          <button {...dialogApi.getCloseTriggerProps()} class="text-muted-foreground hover:text-foreground transition-colors p-1 -mt-1 -mr-1 shrink-0">
            <X class="w-5 h-5" />
            <span class="sr-only">Close</span>
          </button>
        </div>

        <form id="user-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div class="px-6 py-5 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
            <div class="flex flex-col gap-2">
              <Label for="name" class="text-xs uppercase tracking-widest font-heading text-muted-foreground">Full name</Label>
              <Input id="name" type="text" bind:value={form.name} placeholder="Enter full name" class="h-11" required />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="email" class="text-xs uppercase tracking-widest font-heading text-muted-foreground">Email</Label>
              <Input id="email" type="email" bind:value={form.email} placeholder="user@example.com" class="h-11" required />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="password" class="text-xs uppercase tracking-widest font-heading text-muted-foreground">
                {mode === 'create' ? 'Password' : 'New password'} <span class="normal-case tracking-normal text-muted-foreground/70">(optional)</span>
              </Label>
              <Input id="password" type="password" bind:value={form.password} placeholder={mode === 'create' ? 'Leave empty to use email' : 'Leave empty to keep current'} class="h-11" />
            </div>

            <div class="flex flex-col gap-3">
              <Label class="text-xs uppercase tracking-widest font-heading text-muted-foreground">Roles</Label>
              <div class="grid grid-cols-2 gap-2">
                {#each availableRoles as role}
                  <div class="flex items-center gap-3 border border-border rounded-sm p-3 cursor-pointer hover:border-foreground/30 transition-colors">
                    <Switch checked={hasRole(role.slug)} onCheckedChange={(c: boolean) => toggleRole(role.slug, c)} id="role-{role.slug}" />
                    <div class="min-w-0">
                      <Label for="role-{role.slug}" class="text-sm font-heading font-medium cursor-pointer capitalize">{role.name}</Label>
                      {#if role.description}
                        <p class="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{role.description}</p>
                      {/if}
                    </div>
                  </div>
                {/each}
                {#if availableRoles.length === 0}
                  <p class="text-xs text-muted-foreground col-span-2">No roles available</p>
                {/if}
              </div>
            </div>
          </div>
        </form>

        <div class="px-6 py-4 border-t border-border flex gap-2 justify-end">
          <Button variant="outline" onclick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="user-form" disabled={isSubmitting}>
            {#if isSubmitting}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            {mode === 'create' ? 'Create user' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}
