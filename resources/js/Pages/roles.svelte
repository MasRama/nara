<script lang="ts">
  import { fly } from 'svelte/transition';
  import { page as inertiaPage, router } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import RoleModal from '../Components/RoleModal.svelte';
  import axios from 'axios';
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import type { User, Role, GroupedPermissions, RoleForm } from '../types';
  import { createEmptyRoleForm, roleToForm } from '../types';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import { Button } from '$lib/components/ui/button';
  import { Shield, ShieldCheck, Users, Pencil, Trash2, Plus } from '@lucide/svelte';

  interface PagePermissions {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canAssign: boolean;
  }

  interface Props {
    permissions?: PagePermissions;
  }

  let { permissions = { canCreate: false, canEdit: false, canDelete: false, canAssign: false } }: Props = $props();

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
      api(() => axios.get('/roles/data'), { showSuccessToast: false }),
      api(() => axios.get('/roles/permissions'), { showSuccessToast: false }),
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
      Toast('Nama dan slug wajib diisi', 'error');
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
      result = await api(() => axios.post('/roles', payload));
    } else {
      result = await api(() => axios.put(`/roles/${formData.id}`, payload));
    }

    if (result.success) {
      closeRoleModal();
      await loadData();
    }

    isSubmitting = false;
  }

  async function deleteRole(role: Role): Promise<void> {
    if (role.slug === 'admin') {
      Toast('Role admin tidak bisa dihapus', 'error');
      return;
    }
    if (!confirm(`Yakin ingin menghapus role "${role.name}"?`)) {
      return;
    }

    const result = await api(() => axios.delete(`/roles/${role.id}`));
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

<div class="min-h-screen bg-background text-foreground font-body transition-colors duration-500">

  <section class="relative px-6 sm:px-12 lg:px-24 pt-28 pb-16">
    <div class="max-w-[90rem] mx-auto">

      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10" in:fly={{ y: 20, duration: 800 }}>
        <div>
          <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-3">Management</span>
          <h1 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter" style="font-feature-settings: 'ss01'">Roles</h1>
        </div>

        <div class="flex items-center gap-4">
          <div class="text-right">
            <p class="text-[10px] font-mono-accent uppercase tracking-widest text-muted-foreground mb-1">Total</p>
            <p class="text-3xl font-heading font-bold tracking-tighter">{roles.length}</p>
          </div>

          <div class="h-10 w-px bg-border"></div>

          {#if permissions.canCreate}
            <Button
              class="rounded-full px-6 font-heading font-semibold text-sm"
              onclick={openCreateRole}
              disabled={isSubmitting}
            >
              <Plus class="w-4 h-4 mr-2" />
              Add Role
            </Button>
          {/if}
        </div>
      </div>

      {#if loading}
        <div class="flex items-center justify-center py-20">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      {:else}
        <div class="bg-card border border-border rounded-2xl overflow-hidden mb-8" in:fly={{ y: 20, duration: 800, delay: 150 }}>
          {#if roles.length}
            <Table>
              <TableHeader>
                <TableRow class="border-border">
                  <TableHead class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">Role</TableHead>
                  <TableHead class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">Slug</TableHead>
                  <TableHead class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">Permissions</TableHead>
                  <TableHead class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">Users</TableHead>
                  <TableHead class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {#each roles as role}
                  <TableRow class="border-border hover:bg-muted/30 transition-colors duration-150">
                    <TableCell>
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center {role.slug === 'admin' ? 'bg-primary/10' : 'bg-secondary'}">
                          {#if role.slug === 'admin'}
                            <ShieldCheck class="w-4 h-4 text-primary" />
                          {:else}
                            <Shield class="w-4 h-4 text-muted-foreground" />
                          {/if}
                        </div>
                        <div>
                          <div class="text-sm font-heading font-semibold">{role.name}</div>
                          {#if role.description}
                            <div class="text-xs font-mono-accent text-muted-foreground line-clamp-1">{role.description}</div>
                          {/if}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span class="font-mono-accent text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{role.slug}</span>
                    </TableCell>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-heading font-semibold">{getPermissionCount(role)}</span>
                        <span class="text-xs font-mono-accent text-muted-foreground">permissions</span>
                      </div>
                      {#if role.permissions && role.permissions.length > 0}
                        <div class="flex flex-wrap gap-1 mt-1">
                          {#each Object.entries(
                            role.permissions.reduce((acc, perm: string | { slug: string }) => {
                              const slug = typeof perm === 'string' ? perm : perm.slug;
                              const resource = slug.split('.')[0];
                              if (!acc[resource]) acc[resource] = 0;
                              acc[resource]++;
                              return acc;
                            }, {} as Record<string, number>)
                          ) as [resource, count]}
                            <span class="font-mono-accent text-[9px] px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">
                              {formatResourceName(resource)}: {count}
                            </span>
                          {/each}
                        </div>
                      {/if}
                    </TableCell>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <Users class="w-3.5 h-3.5 text-muted-foreground" />
                        <span class="text-sm font-heading">{role.user_count || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell class="text-right">
                      {#if permissions.canEdit || (permissions.canDelete && role.slug !== 'admin')}
                        <div class="flex justify-end gap-2">
                          {#if permissions.canEdit}
                            <Button
                              variant="outline"
                              size="sm"
                              class="rounded-full text-xs font-heading font-medium px-4 hover:border-primary/40 hover:text-primary transition-colors duration-200"
                              onclick={() => openEditRole(role)}
                              disabled={isSubmitting}
                            >
                              <Pencil class="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          {/if}
                          {#if permissions.canDelete && role.slug !== 'admin'}
                            <Button
                              variant="ghost"
                              size="sm"
                              class="rounded-full text-xs font-heading font-medium px-4 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
                              onclick={() => deleteRole(role)}
                              disabled={isSubmitting}
                            >
                              <Trash2 class="w-3 h-3" />
                            </Button>
                          {/if}
                        </div>
                      {/if}
                    </TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
          {:else}
            <div class="flex flex-col items-center justify-center py-20 px-8 text-center">
              <div class="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mb-5">
                <Shield class="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 class="text-base font-heading font-semibold mb-2">No roles yet</h3>
              <p class="text-sm text-muted-foreground font-body mb-6 max-w-xs">Create your first role to manage user permissions.</p>
              {#if permissions.canCreate}
                <Button class="rounded-full px-6 font-heading font-semibold text-sm" onclick={openCreateRole}>
                  Create First Role
                </Button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

    </div>
  </section>

  <RoleModal
    show={showRoleModal}
    {mode}
    {form}
    {isSubmitting}
    {groupedPermissions}
    on:close={closeRoleModal}
    on:submit={handleSubmit}
  />
</div>
