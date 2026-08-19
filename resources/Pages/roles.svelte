<script lang="ts">
  import Header from '../Components/Header.svelte';
  import RoleModal from '../Components/RoleModal.svelte';
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import type { Role, GroupedPermissions, RoleForm } from '../types';
  import { createEmptyRoleForm, roleToForm } from '../types';
  import Button from '../Components/Button.svelte';
  import { Pencil, Plus, Shield, ShieldCheck, Trash2 } from '@lucide/svelte';
  interface PagePermissions {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }

  interface Props {
    permissions?: PagePermissions;
  }

  let { permissions = { canCreate: false, canEdit: false, canDelete: false } }: Props = $props();

  let roles: Role[] = $state([]);
  let groupedPermissions: GroupedPermissions = $state({});
  let loading: boolean = $state(true);

  let showRoleModal: boolean = $state(false);
  let isSubmitting: boolean = $state(false);
  let mode: 'create' | 'edit' = $state('create');
  let form: RoleForm = $state(createEmptyRoleForm());

  const permissionCount = $derived(Object.values(groupedPermissions).reduce((total, perms) => total + perms.length, 0));
  const assignedUserCount = $derived(roles.reduce((total, role) => total + (role.user_count ?? 0), 0));

  async function loadData(): Promise<void> {
    loading = true;
    const [rolesRes, permsRes] = await Promise.all([
      api('/roles/data', { showSuccessToast: false }),
      api('/roles/permissions', { showSuccessToast: false }),
    ]);

    if (rolesRes.success && rolesRes.data) {
      roles = rolesRes.data as Role[];
    }
    if (permsRes.success && permsRes.data) {
      groupedPermissions = permsRes.data as GroupedPermissions;
    }
    loading = false;
  }

  function openCreateRole(): void {
    mode = 'create';
    form = createEmptyRoleForm();
    showRoleModal = true;
  }

  function openEditRole(role: Role): void {
    mode = 'edit';
    form = roleToForm(role);
    showRoleModal = true;
  }

  function closeRoleModal(): void {
    showRoleModal = false;
    form = createEmptyRoleForm();
  }

  async function handleSubmit(event: CustomEvent<RoleForm>): Promise<void> {
    const formData = event.detail;
    if (!formData.name || !formData.slug) {
      Toast('Name and slug are required', 'error');
      return;
    }

    isSubmitting = true;

    const payload = {
      name: formData.name,
      slug: formData.slug,
      description: formData.description || null,
      permissions: formData.permissions,
    };

    let result;
    if (mode === 'create') {
      result = await api('/roles', { method: 'POST', body: payload });
    } else {
      result = await api(`/roles/${formData.id}`, { method: 'PUT', body: payload });
    }

    if (result.success) {
      closeRoleModal();
      await loadData();
    }

    isSubmitting = false;
  }

  async function deleteRole(role: Role): Promise<void> {
    if (role.slug === 'admin') {
      Toast('The admin role cannot be deleted', 'error');
      return;
    }
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) {
      return;
    }

    const result = await api('/roles', { method: 'DELETE', body: { ids: [role.id] } });
    if (result.success) {
      await loadData();
    }
  }

  function getPermissionCount(role: Role): number {
    return role.permissions?.length ?? 0;
  }

  function getPermissionGroups(role: Role): Array<{ resource: string; count: number }> {
    const counts = (role.permissions ?? []).reduce<Record<string, number>>((acc, slug) => {
      const resource = slug.split('.')[0];
      acc[resource] = (acc[resource] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([resource, count]) => ({ resource, count }));
  }

  function formatResourceName(resource: string): string {
    return resource.charAt(0).toUpperCase() + resource.slice(1);
  }

  $effect(() => {
    loadData();
  });
</script>

<Header group="roles" />

<div class="min-h-[100dvh] bg-background text-foreground font-body antialiased selection:bg-primary/20 selection:text-primary overflow-x-hidden">

  <div class="fixed inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-foreground"></div>

  <section class="relative px-6 sm:px-10 lg:px-16 pt-28 pb-16">
    <div class="max-w-[1400px] mx-auto">

      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
        <div>
          <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Management</p>
          <h1 class="font-heading font-semibold tracking-[-0.02em] text-2xl sm:text-3xl text-foreground">
            Roles <span class="text-muted-foreground font-normal">— clear access, by design.</span>
          </h1>
        </div>

        <div class="flex flex-wrap items-center gap-3 sm:justify-end">
          <div class="inline-flex items-center gap-x-4 font-mono-accent text-xs text-muted-foreground rounded-full bg-card/60 ring-1 ring-border/40 px-4 py-2 backdrop-blur-sm">
            <span><span class="text-foreground font-medium">{roles.length}</span> roles</span>
            <span class="w-px h-3 bg-border/60"></span>
            <span><span class="text-foreground font-medium">{permissionCount}</span> permissions</span>
          </div>
          {#if permissions.canCreate}
            <Button onclick={openCreateRole} disabled={isSubmitting} size="lg" class="rounded-xl">
              <Plus class="w-4 h-4" />
              Add role
            </Button>
          {/if}
        </div>
      </div>

      {#if loading}
        <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] flex items-center justify-center py-32">
          <div class="flex items-center gap-3 text-sm text-muted-foreground">
            <div class="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
            Loading roles
          </div>
        </div>
      {:else if roles.length}
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">

          <aside class="lg:col-span-4 flex flex-col gap-4">
            <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] p-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Access model</p>
                  <h2 class="text-xl font-heading font-semibold tracking-tight text-foreground">Roles & permissions</h2>
                </div>
                <div class="w-10 h-10 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                  <ShieldCheck class="w-5 h-5 text-primary" />
                </div>
              </div>

              <p class="text-sm text-muted-foreground leading-relaxed mt-5">Organize access around responsibilities, then keep each role focused on what it actually needs.</p>

              <div class="grid grid-cols-2 gap-2 mt-6">
                <div class="rounded-xl bg-muted/40 ring-1 ring-border/40 p-3">
                  <p class="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Roles</p>
                  <p class="text-2xl font-heading font-semibold tracking-tight text-foreground mt-2">{roles.length}</p>
                </div>
                <div class="rounded-xl bg-muted/40 ring-1 ring-border/40 p-3">
                  <p class="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Permissions</p>
                  <p class="text-2xl font-heading font-semibold tracking-tight text-foreground mt-2">{permissionCount}</p>
                </div>
                <div class="rounded-xl bg-muted/40 ring-1 ring-border/40 p-3">
                  <p class="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Assigned users</p>
                  <p class="text-2xl font-heading font-semibold tracking-tight text-foreground mt-2">{assignedUserCount}</p>
                </div>
                <div class="rounded-xl bg-muted/40 ring-1 ring-border/40 p-3">
                  <p class="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Resources</p>
                  <p class="text-2xl font-heading font-semibold tracking-tight text-foreground mt-2">{Object.keys(groupedPermissions).length}</p>
                </div>
              </div>

              <div class="h-px bg-gradient-to-r from-transparent via-border/70 to-transparent my-6"></div>

              <div>
                <div class="flex items-center justify-between gap-3">
                  <p class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Permission catalog</p>
                  <span class="font-mono-accent text-[11px] text-muted-foreground">{permissionCount} total</span>
                </div>
                <div class="flex flex-col gap-2 mt-3">
                  {#each Object.entries(groupedPermissions) as [resource, resourcePermissions]}
                    <div class="flex items-center justify-between gap-3 rounded-xl bg-muted/30 ring-1 ring-border/40 px-3 py-2.5">
                      <span class="text-sm font-heading font-medium text-foreground">{formatResourceName(resource)}</span>
                      <span class="font-mono-accent text-[11px] text-muted-foreground">{resourcePermissions.length}</span>
                    </div>
                  {/each}
                </div>
              </div>
            </div>

          </aside>

          <div class="lg:col-span-8">

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {#each roles as role, i}
                <div class="group relative h-full rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] p-5 flex flex-col gap-5 overflow-hidden hover:ring-primary/30 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),0_8px_28px_-6px_rgba(16,185,129,0.12)] transition-all duration-300">
                  <div class="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                  <div class="relative flex items-start justify-between gap-4">
                    <div class="flex items-center gap-3 min-w-0">
                      <span class="font-mono-accent text-[11px] text-muted-foreground/50 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 {role.slug === 'admin' ? 'bg-primary/10 ring-1 ring-primary/20' : 'bg-gradient-to-br from-muted to-muted/60 ring-1 ring-border/40'}">
                        {#if role.slug === 'admin'}
                          <ShieldCheck class="w-4 h-4 text-primary" />
                        {:else}
                          <Shield class="w-4 h-4 text-muted-foreground" />
                        {/if}
                      </div>
                      <div class="min-w-0">
                        <h3 class="text-base font-heading font-semibold tracking-tight text-foreground truncate">{role.name}</h3>
                        <p class="font-mono-accent text-[11px] text-muted-foreground truncate mt-0.5">{role.slug}</p>
                      </div>
                    </div>
                    {#if role.slug === 'admin'}
                      <span class="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-heading font-medium text-primary ring-1 ring-primary/20 shrink-0">Protected</span>
                    {/if}
                  </div>

                  <p class="relative text-sm text-muted-foreground leading-relaxed min-h-[2.75rem]">
                    {role.description || 'No description added for this role.'}
                  </p>

                  <div class="relative grid grid-cols-2 divide-x divide-border/50 rounded-xl bg-muted/30 ring-1 ring-border/40">
                    <div class="p-3">
                      <p class="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Permissions</p>
                      <p class="text-xl font-heading font-semibold tracking-tight text-foreground mt-1.5">{getPermissionCount(role)}</p>
                    </div>
                    <div class="p-3 pl-4">
                      <p class="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Users</p>
                      <p class="text-xl font-heading font-semibold tracking-tight text-foreground mt-1.5">{role.user_count || 0}</p>
                    </div>
                  </div>

                  <div class="relative flex-1 border-t border-border/50 pt-4">
                    <div class="flex items-center justify-between gap-3">
                      <p class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Access scope</p>
                      <span class="font-mono-accent text-[11px] text-muted-foreground">{getPermissionGroups(role).length} areas</span>
                    </div>
                    {#if getPermissionGroups(role).length}
                      <div class="flex flex-wrap gap-1.5 mt-3">
                        {#each getPermissionGroups(role).slice(0, 4) as group}
                          <span class="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-heading text-muted-foreground ring-1 ring-border/40">
                            {formatResourceName(group.resource)}
                            <span class="font-mono-accent text-[10px] text-muted-foreground/70">{group.count}</span>
                          </span>
                        {/each}
                        {#if getPermissionGroups(role).length > 4}
                          <span class="inline-flex items-center rounded-full bg-muted/40 px-2.5 py-1 text-[11px] font-heading text-muted-foreground ring-1 ring-border/40">+{getPermissionGroups(role).length - 4} more</span>
                        {/if}
                      </div>
                    {:else}
                      <p class="text-xs text-muted-foreground mt-3">No permissions assigned.</p>
                    {/if}
                  </div>

                  <div class="relative flex items-center justify-between gap-3 border-t border-border/50 pt-4">
                    <span class="text-xs text-muted-foreground">{role.slug === 'admin' ? 'Built-in role' : 'Custom role'}</span>
                    {#if permissions.canEdit || (permissions.canDelete && role.slug !== 'admin')}
                      <div class="flex justify-end gap-2">
                        {#if permissions.canEdit}
                          <Button variant="outline" size="sm" onclick={() => openEditRole(role)} disabled={isSubmitting} class="rounded-lg">
                            <Pencil class="w-3 h-3" />
                            Edit
                          </Button>
                        {/if}
                        {#if permissions.canDelete && role.slug !== 'admin'}
                          <Button variant="ghost" size="sm" class="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg" onclick={() => deleteRole(role)} disabled={isSubmitting}>
                            <Trash2 class="w-3 h-3" />
                          </Button>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else}
        <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center py-20 px-8 text-center">
          <div class="w-14 h-14 rounded-full bg-gradient-to-br from-muted to-muted/60 ring-1 ring-border/40 flex items-center justify-center mb-6">
            <Shield class="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 class="font-heading font-semibold text-lg tracking-tight text-foreground mb-2">No roles yet</h3>
          <p class="text-sm text-muted-foreground max-w-xs mb-6">Create your first role to start managing permissions.</p>
          {#if permissions.canCreate}
            <Button onclick={openCreateRole} size="lg" class="rounded-xl">
              <Plus class="w-4 h-4" />
              Add first role
            </Button>
          {/if}
        </div>
      {/if}

    </div>
  </section>

  <RoleModal
    show={showRoleModal}
    {mode}
    bind:form
    {isSubmitting}
    {groupedPermissions}
    on:close={closeRoleModal}
    on:submit={handleSubmit}
  />
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
