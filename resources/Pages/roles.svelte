<script lang="ts">
  import { fly } from 'svelte/transition';
  import Header from '../Components/Header.svelte';
  import RoleModal from '../Components/RoleModal.svelte';
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import type { Role, GroupedPermissions, RoleForm } from '../types';
  import { createEmptyRoleForm, roleToForm } from '../types';
  import Button from '../Components/Button.svelte';
  import { Shield, ShieldCheck, Users, Pencil, Trash2, Plus } from '@lucide/svelte';

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
    if (!role.permissions) return 0;
    return role.permissions.length;
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

  <!-- paper grain -->
  <div class="fixed inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-foreground"></div>

  <section class="relative px-6 sm:px-10 lg:px-16 pt-28 pb-16">
    <div class="max-w-[1400px] mx-auto">

      <!-- Header row -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10" in:fly={{ y: 16, duration: 600 }}>
        <div>
          <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Management</p>
          <h1 class="font-heading font-semibold tracking-[-0.02em] text-2xl sm:text-3xl text-foreground">
            Roles <span class="text-muted-foreground font-normal">— the shape of what people can do.</span>
          </h1>
        </div>

        <div class="flex items-center gap-4 shrink-0">
          <div class="inline-flex items-center gap-x-4 gap-y-2 font-mono-accent text-xs text-muted-foreground rounded-full bg-card/60 ring-1 ring-border/40 px-4 py-2 backdrop-blur-sm">
            <span><span class="text-foreground font-medium">{roles.length}</span> roles</span>
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
        <div class="flex items-center justify-center py-32">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      {:else if roles.length}
        <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] overflow-hidden" in:fly={{ y: 16, duration: 600, delay: 120 }}>
          <div class="relative w-full overflow-x-auto">
            <table class="w-full caption-bottom text-sm">
              <thead>
                <tr>
                  <th class="h-12 px-5 text-start font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium whitespace-nowrap">Role</th>
                  <th class="h-12 px-5 text-start font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium whitespace-nowrap">Slug</th>
                  <th class="h-12 px-5 text-start font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium whitespace-nowrap">Permissions</th>
                  <th class="h-12 px-5 text-start font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium whitespace-nowrap">Users</th>
                  <th class="h-12 px-5 text-end font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each roles as role, i}
                  <tr class="border-t border-border/40 hover:bg-muted/30 transition-colors duration-200">
                    <td class="p-4 align-middle whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <span class="font-mono-accent text-[11px] text-muted-foreground/50 w-5 shrink-0 hidden sm:block">{String(i + 1).padStart(2, '0')}</span>
                        <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 {role.slug === 'admin' ? 'bg-primary/10 ring-1 ring-primary/20' : 'bg-gradient-to-br from-muted to-muted/60 ring-1 ring-border/40'}">
                          {#if role.slug === 'admin'}
                            <ShieldCheck class="w-4 h-4 text-primary" />
                          {:else}
                            <Shield class="w-4 h-4 text-muted-foreground" />
                          {/if}
                        </div>
                        <div class="min-w-0">
                          <div class="text-sm font-heading font-semibold tracking-tight text-foreground">{role.name}</div>
                          {#if role.description}
                            <div class="text-xs text-muted-foreground line-clamp-1 mt-0.5">{role.description}</div>
                          {/if}
                        </div>
                      </div>
                    </td>
                    <td class="p-4 align-middle whitespace-nowrap">
                      <span class="font-mono-accent text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full ring-1 ring-border/40">{role.slug}</span>
                    </td>
                    <td class="p-4 align-middle whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-heading font-semibold text-foreground">{getPermissionCount(role)}</span>
                        <span class="text-xs text-muted-foreground">permissions</span>
                      </div>
                      {#if role.permissions && role.permissions.length > 0}
                        <div class="flex flex-wrap gap-1 mt-1.5">
                          {#each Object.entries(
                            role.permissions.reduce((acc, perm: string | { slug: string }) => {
                              const slug = typeof perm === 'string' ? perm : perm.slug;
                              const resource = slug.split('.')[0];
                              if (!acc[resource]) acc[resource] = 0;
                              acc[resource]++;
                              return acc;
                            }, {} as Record<string, number>)
                          ) as [resource, count]}
                            <span class="text-[10px] px-1.5 py-0.5 bg-muted/60 rounded-full ring-1 ring-border/40 text-muted-foreground font-heading">
                              {formatResourceName(resource)}: {count}
                            </span>
                          {/each}
                        </div>
                      {/if}
                    </td>
                    <td class="p-4 align-middle whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <Users class="w-3.5 h-3.5 text-muted-foreground" />
                        <span class="text-sm font-heading font-medium text-foreground">{role.user_count || 0}</span>
                      </div>
                    </td>
                    <td class="p-4 align-middle whitespace-nowrap text-right">
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
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {:else}
        <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center py-20 px-8 text-center" in:fly={{ y: 16, duration: 600, delay: 120 }}>
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
