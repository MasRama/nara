<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Input from './Input.svelte';
  import Label from './Label.svelte';
  import Button from './Button.svelte';
  import Switch from './Switch.svelte';
  import * as dialog from "@zag-js/dialog";
  import { useMachine, normalizeProps, portal } from "@zag-js/svelte";
  import { Loader2, CheckSquare, Square, X } from '@lucide/svelte';
  import type { RoleForm, GroupedPermissions } from '../types';

  let {
    show = false,
    mode = 'create',
    form,
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

  const dialogService = useMachine(dialog.machine, {
    id: "role-modal",
    get open() { return show; },
    onOpenChange(details) {
      if (!details.open) dispatch('close');
    },
  });
  const dialogApi = $derived(dialog.connect(dialogService, normalizeProps));

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

{#if dialogApi.open}
  <div use:portal>
    <div {...dialogApi.getBackdropProps()} class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"></div>
    <div {...dialogApi.getPositionerProps()}>
      <div {...dialogApi.getContentProps()} class="bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-xl border border-border shadow-lg sm:max-w-lg font-body overflow-hidden">

        <div class="px-6 pt-6 pb-5 border-b border-border flex items-start justify-between gap-4">
          <div>
            <p class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{mode === 'create' ? 'New role' : 'Edit role'}</p>
            <h2 {...dialogApi.getTitleProps()} class="font-heading font-semibold text-xl tracking-tight text-foreground">{mode === 'create' ? 'Create a role' : 'Update role'}</h2>
            <p {...dialogApi.getDescriptionProps()} class="text-sm text-muted-foreground font-body mt-1">{mode === 'create' ? 'Define a new role and assign permissions.' : 'Update role details and permissions.'}</p>
          </div>
          <button {...dialogApi.getCloseTriggerProps()} class="text-muted-foreground hover:text-foreground transition-colors p-1 -mt-1 -mr-1 shrink-0">
            <X class="w-5 h-5" />
            <span class="sr-only">Close</span>
          </button>
        </div>

        <form id="role-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div class="px-6 py-5 flex flex-col gap-5 max-h-[65vh] overflow-y-auto">
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-2">
                <Label for="role-name" class="text-xs uppercase tracking-widest font-heading text-muted-foreground">Name</Label>
                <Input id="role-name" type="text" bind:value={form.name} placeholder="e.g. Editor" class="h-11" required />
              </div>
              <div class="flex flex-col gap-2">
                <Label for="role-slug" class="text-xs uppercase tracking-widest font-heading text-muted-foreground">Slug</Label>
                <Input id="role-slug" type="text" bind:value={form.slug} placeholder="e.g. editor" class="h-11 font-mono-accent" required disabled={mode === 'edit'} />
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <Label for="role-desc" class="text-xs uppercase tracking-widest font-heading text-muted-foreground">
                Description <span class="normal-case tracking-normal text-muted-foreground/70">(optional)</span>
              </Label>
              <Input id="role-desc" type="text" bind:value={form.description} placeholder="Describe what this role can do" class="h-11" />
            </div>

            <div class="flex flex-col gap-3">
              <Label class="text-xs uppercase tracking-widest font-heading text-muted-foreground">Permissions</Label>
              {#each Object.entries(groupedPermissions) as [resource, perms]}
                <div class="border border-border rounded-xl overflow-hidden">
                  <div class="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
                    <button type="button" class="flex items-center gap-2 text-xs font-heading uppercase tracking-widest text-foreground cursor-pointer hover:text-primary transition-colors" onclick={() => toggleResourceAll(resource, !isResourceAllChecked(resource))}>
                      {#if isResourceAllChecked(resource)}<CheckSquare class="w-3.5 h-3.5 text-primary" />
                      {:else if isResourcePartial(resource)}<CheckSquare class="w-3.5 h-3.5 text-muted-foreground/50" />
                      {:else}<Square class="w-3.5 h-3.5 text-muted-foreground" />{/if}
                      {formatResourceName(resource)}
                    </button>
                    <span class="text-[11px] text-muted-foreground font-heading">{perms.filter(p => form.permissions.includes(p.slug)).length}/{perms.length}</span>
                  </div>
                  <div class="grid grid-cols-2 gap-0">
                    {#each perms as perm}
                      <label class="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-muted/20 transition-colors border-b border-border/50 last:border-b-0 even:border-r-0">
                        <input type="checkbox" checked={hasPermission(perm.slug)} onchange={(e) => togglePermission(perm.slug, e.currentTarget.checked)} class="rounded-xl border-border accent-primary w-3.5 h-3.5" />
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

        <div class="px-6 py-4 border-t border-border flex gap-2 justify-end">
          <Button variant="outline" onclick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="role-form" disabled={isSubmitting}>
            {#if isSubmitting}<Loader2 class="w-4 h-4 animate-spin" />{/if}
            {mode === 'create' ? 'Create role' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}
