<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
  } from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import { Loader2, CheckSquare, Square } from 'lucide-svelte';
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

  const dispatch = createEventDispatcher<{
    close: void;
    submit: RoleForm;
  }>();

  // Auto-generate slug from name (only in create mode)
  $effect(() => {
    if (mode === 'create' && form.name) {
      form.slug = form.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }
  });

  function handleClose(): void {
    dispatch('close');
  }

  function handleSubmit(): void {
    dispatch('submit', form);
  }

  function hasPermission(slug: string): boolean {
    return form.permissions.includes(slug);
  }

  function togglePermission(slug: string, checked: boolean): void {
    if (checked) {
      if (!form.permissions.includes(slug)) {
        form.permissions = [...form.permissions, slug];
      }
    } else {
      form.permissions = form.permissions.filter(p => p !== slug);
    }
  }

  function toggleResourceAll(resource: string, checked: boolean): void {
    const perms = groupedPermissions[resource] || [];
    if (checked) {
      const newPerms = perms.map(p => p.slug).filter(slug => !form.permissions.includes(slug));
      form.permissions = [...form.permissions, ...newPerms];
    } else {
      const permSlugs = perms.map(p => p.slug);
      form.permissions = form.permissions.filter(p => !permSlugs.includes(p));
    }
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

<Dialog open={show} onOpenChange={(v) => { if (!v) handleClose(); }}>
  <DialogContent class="sm:max-w-lg bg-background border-border font-body p-0 gap-0 overflow-hidden">

    <DialogHeader class="px-6 pt-6 pb-5 border-b border-border">
      <span class="text-[10px] font-mono-accent uppercase tracking-widest text-primary mb-2 block">
        {mode === 'create' ? 'New Role' : 'Edit Role'}
      </span>
      <DialogTitle class="font-heading font-semibold text-xl tracking-tight" style="font-feature-settings: 'ss01'">
        {mode === 'create' ? 'Create Role' : 'Update Role'}
      </DialogTitle>
      <DialogDescription class="text-sm text-muted-foreground font-body mt-1">
        {mode === 'create'
          ? 'Define a new role and assign permissions.'
          : 'Update role details and permissions.'}
      </DialogDescription>
    </DialogHeader>

    <form id="role-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div class="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="role-name" class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">Name</Label>
            <Input
              id="role-name"
              type="text"
              bind:value={form.name}
              placeholder="e.g. Editor"
              class="rounded-xl h-11 bg-background border-border font-body text-sm"
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="role-slug" class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">Slug</Label>
            <Input
              id="role-slug"
              type="text"
              bind:value={form.slug}
              placeholder="e.g. editor"
              class="rounded-xl h-11 bg-background border-border font-body text-sm font-mono-accent"
              required
              disabled={mode === 'edit'}
            />
          </div>
        </div>

        <div class="space-y-2">
          <Label for="role-desc" class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">
            Description <span class="normal-case tracking-normal font-body text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="role-desc"
            type="text"
            bind:value={form.description}
            placeholder="Describe what this role can do"
            class="rounded-xl h-11 bg-background border-border font-body text-sm"
          />
        </div>

        <!-- Permissions -->
        <div class="space-y-3">
          <Label class="text-xs font-mono-accent uppercase tracking-widest text-muted-foreground">Permissions</Label>

          {#each Object.entries(groupedPermissions) as [resource, perms]}
            <div class="bg-card border border-border rounded-xl overflow-hidden">
              <!-- Resource header with select all -->
              <div class="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
                <button
                  type="button"
                  class="flex items-center gap-2 text-xs font-mono-accent uppercase tracking-widest text-foreground cursor-pointer hover:text-primary transition-colors"
                  onclick={() => toggleResourceAll(resource, !isResourceAllChecked(resource))}
                >
                  {#if isResourceAllChecked(resource)}
                    <CheckSquare class="w-3.5 h-3.5 text-primary" />
                  {:else if isResourcePartial(resource)}
                    <CheckSquare class="w-3.5 h-3.5 text-muted-foreground/50" />
                  {:else}
                    <Square class="w-3.5 h-3.5 text-muted-foreground" />
                  {/if}
                  {formatResourceName(resource)}
                </button>
                <span class="text-[10px] font-mono-accent text-muted-foreground">
                  {perms.filter(p => form.permissions.includes(p.slug)).length}/{perms.length}
                </span>
              </div>

              <!-- Individual permissions -->
              <div class="grid grid-cols-2 gap-0">
                {#each perms as perm}
                  <label class="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-muted/20 transition-colors duration-150 border-b border-border/50 last:border-b-0">
                    <input
                      type="checkbox"
                      checked={hasPermission(perm.slug)}
                      onchange={(e) => togglePermission(perm.slug, e.currentTarget.checked)}
                      class="rounded border-border accent-primary w-3.5 h-3.5"
                    />
                    <span class="text-xs font-body text-foreground capitalize">{perm.action}</span>
                  </label>
                {/each}
              </div>
            </div>
          {/each}

          {#if Object.keys(groupedPermissions).length === 0}
            <p class="text-xs text-muted-foreground font-mono-accent">No permissions defined yet. Run seed to populate permissions.</p>
          {/if}
        </div>

      </div>
    </form>

    <DialogFooter class="px-6 py-4 border-t border-border flex gap-2">
      <Button
        variant="outline"
        onclick={handleClose}
        disabled={isSubmitting}
        class="rounded-full font-mono-accent text-xs uppercase tracking-widest border-border hover:border-primary/40 hover:text-primary transition-colors duration-200"
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="role-form"
        disabled={isSubmitting}
        class="rounded-full font-mono-accent text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-transform duration-200"
      >
        {#if isSubmitting}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
        {/if}
        {mode === 'create' ? 'Create Role' : 'Save Changes'}
      </Button>
    </DialogFooter>

  </DialogContent>
</Dialog>
