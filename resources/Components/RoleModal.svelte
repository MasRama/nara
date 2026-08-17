<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Dialog } from 'bits-ui';
  import FloatingInput from './FloatingInput.svelte';
  import Label from './Label.svelte';
  import Button from './Button.svelte';
  import { Loader2, CheckSquare, Square, X } from '@lucide/svelte';
  import type { RoleForm, GroupedPermissions } from '../types';

  let {
    show = false,
    mode = 'create',
    form = $bindable(),
    isSubmitting = false,
    groupedPermissions = {}
  }: {
    show?: boolean;
    mode?: 'create' | 'edit';
    form: RoleForm;
    isSubmitting?: boolean;
    groupedPermissions?: GroupedPermissions;
  } = $props();

  const dispatch = createEventDispatcher<{ close: void; submit: RoleForm }>();

  function handleOpenChange(open: boolean): void {
    if (!open) dispatch('close');
  }

  $effect(() => {
    if (mode === 'create' && form.name) {
      form.slug = form.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
    }
  });

  function handleClose(): void { dispatch('close'); }
  function handleSubmit(): void { dispatch('submit', form); }

  function hasPermission(slug: string): boolean { return form.permissions.includes(slug); }

  function togglePermission(slug: string, checked: boolean): void {
    if (checked) { if (!form.permissions.includes(slug)) form.permissions = [...form.permissions, slug]; }
    else { form.permissions = form.permissions.filter(p => p !== slug); }
  }

  function toggleResourceAll(resource: string, checked: boolean): void {
    const perms = groupedPermissions[resource] || [];
    if (checked) { form.permissions = [...form.permissions, ...perms.map(p => p.slug).filter(s => !form.permissions.includes(s))]; }
    else { const slugs = perms.map(p => p.slug); form.permissions = form.permissions.filter(p => !slugs.includes(p)); }
  }

  function isResourceAllChecked(resource: string): boolean {
    const perms = groupedPermissions[resource] || [];
    return perms.length > 0 && perms.every(p => form.permissions.includes(p.slug));
  }

  function isResourcePartial(resource: string): boolean {
    const perms = groupedPermissions[resource] || [];
    const checked = perms.filter(p => form.permissions.includes(p.slug)).length;
    return checked > 0 && checked < perms.length;
  }

  function formatResourceName(resource: string): string {
    return resource.charAt(0).toUpperCase() + resource.slice(1);
  }
</script>

<Dialog.Root open={show} onOpenChange={handleOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
<Dialog.Content class="bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-2xl ring-1 ring-border/50 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_16px_64px_-12px_rgba(0,0,0,0.1)] sm:max-w-lg font-body overflow-hidden outline-none">
  <div class="px-6 pt-6 pb-5 border-b border-border/60 flex items-start justify-between gap-4">
    <div>
      <p class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{mode === 'create' ? 'New role' : 'Edit role'}</p>
      <Dialog.Title class="font-heading font-semibold text-xl tracking-tight text-foreground">{mode === 'create' ? 'Create a role' : 'Update role'}</Dialog.Title>
      <Dialog.Description class="text-sm text-muted-foreground font-body mt-1">{mode === 'create' ? 'Define a new role and assign permissions.' : 'Update role details and permissions.'}</Dialog.Description>
    </div>
    <Dialog.Close class="text-muted-foreground hover:text-foreground transition-colors p-1 -mt-1 -mr-1 shrink-0 rounded-lg hover:bg-muted/60">
      <X class="w-5 h-5" />
      <span class="sr-only">Close</span>
    </Dialog.Close>
  </div>

      <form id="role-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <div class="px-6 py-5 flex flex-col gap-5 max-h-[65vh] overflow-y-auto">
  <div class="grid grid-cols-2 gap-3">
    <FloatingInput id="role-name" type="text" bind:value={form.name} label="Name" required />
    <FloatingInput id="role-slug" type="text" bind:value={form.slug} label="Slug" required disabled={mode === 'edit'} class="font-mono-accent" />
  </div>
  <FloatingInput id="role-desc" type="text" bind:value={form.description} label="Description (optional)" />

  <div class="h-px bg-gradient-to-r from-transparent via-border/70 to-transparent my-1"></div>

  <div class="flex flex-col gap-3">
    <Label class="text-xs uppercase tracking-widest font-heading text-muted-foreground">Permissions</Label>
    {#each Object.entries(groupedPermissions) as [resource, perms]}
      <div class="rounded-xl ring-1 ring-border/40 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/30">
          <button type="button" class="flex items-center gap-2 text-xs font-heading uppercase tracking-widest text-foreground cursor-pointer hover:text-primary transition-colors" onclick={() => toggleResourceAll(resource, !isResourceAllChecked(resource))}>
            {#if isResourceAllChecked(resource)}<CheckSquare class="w-3.5 h-3.5 text-primary" />
            {:else if isResourcePartial(resource)}<CheckSquare class="w-3.5 h-3.5 text-muted-foreground/50" />
            {:else}<Square class="w-3.5 h-3.5 text-muted-foreground" />{/if}
            {formatResourceName(resource)}
          </button>
          <span class="text-[11px] text-muted-foreground font-mono-accent">{perms.filter(p => form.permissions.includes(p.slug)).length}/{perms.length}</span>
        </div>
        <div class="grid grid-cols-2 gap-0">
          {#each perms as perm}
            <label class="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-primary/[0.03] transition-colors border-b border-border/40 last:border-b-0 even:border-r-0">
              <input type="checkbox" checked={hasPermission(perm.slug)} onchange={(e) => togglePermission(perm.slug, e.currentTarget.checked)} class="rounded-md border-border accent-primary w-3.5 h-3.5" />
              <span class="text-xs font-body text-foreground capitalize">{perm.action}</span>
            </label>
          {/each}
        </div>
      </div>
    {/each}
    {#if Object.keys(groupedPermissions).length === 0}
      <p class="text-xs text-muted-foreground">No permissions defined yet.</p>
    {/if}
  </div>

        </div>
      </form>

<div class="px-6 py-4 border-t border-border/60 flex gap-2 justify-end">
  <Button variant="outline" onclick={handleClose} disabled={isSubmitting} class="rounded-xl">Cancel</Button>
  <Button type="submit" form="role-form" disabled={isSubmitting} class="rounded-xl">
    {#if isSubmitting}<Loader2 class="w-4 h-4 animate-spin" />{/if}
    {mode === 'create' ? 'Create role' : 'Save changes'}
  </Button>
</div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
