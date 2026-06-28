<script lang="ts">
  import { fly } from 'svelte/transition';
  import { page as inertiaPage, router } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import UserModal from '../Components/UserModal.svelte';
  import Pagination from '../Components/Pagination.svelte';
  import axios from 'axios';
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import type { User, UserForm, PaginationMeta, RoleInfo } from '../types';
  import { createEmptyUserForm, userToForm } from '../types';
  import Button from '../Components/Button.svelte';
  import { Users, Plus, Pencil, Trash2, ArrowUpRight } from '@lucide/svelte';

  interface Props {
    users?: User[];
    availableRoles?: RoleInfo[];
    permissions?: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
    search?: string;
  }

  let {
    users = [],
    availableRoles = [],
    permissions = { canCreate: false, canEdit: false, canDelete: false },
    total = 0,
    page = 1,
    limit = 10,
    totalPages = 1,
    hasNext = false,
    hasPrev = false,
    search = ''
  }: Props = $props();

  const currentUser = $derived(inertiaPage.props.user as User | undefined);

  let paginationMeta = $derived({ total, page, limit, totalPages, hasNext, hasPrev } as PaginationMeta);

  let showUserModal: boolean = $state(false);
  let isSubmitting: boolean = $state(false);
  let mode: 'create' | 'edit' = $state('create');
  let form: UserForm = $state(createEmptyUserForm());

  function openCreateUser(): void {
    mode = 'create';
    form = createEmptyUserForm();
    showUserModal = true;
  }

  function openEditUser(userItem: User): void {
    mode = 'edit';
    form = userToForm(userItem);
    showUserModal = true;
  }

  function closeUserModal(): void {
    showUserModal = false;
    form = createEmptyUserForm();
  }

  function getRoleDisplayName(slug: string): string {
    const role = availableRoles.find(r => r.slug === slug);
    return role ? role.name : slug;
  }

  async function handleSubmit(event: CustomEvent<UserForm>): Promise<void> {
    const formData = event.detail;
    if (!formData.name || !formData.email) {
      Toast('Name and email are required', 'error');
      return;
    }

    isSubmitting = true;

    const payload = {
      name: formData.name,
      email: formData.email,
      roles: formData.roles || [],
      password: formData.password || undefined
    };

    const result = mode === 'create'
      ? await api(() => axios.post('/users', payload))
      : await api(() => axios.put(`/users/${formData.id}`, payload));

    if (result.success) {
      closeUserModal();
      router.visit('/users', { preserveScroll: true, preserveState: true });
    }

    isSubmitting = false;
  }

  async function deleteUser(id: string): Promise<void> {
    if (!confirm('Delete this user? This cannot be undone.')) {
      return;
    }

    isSubmitting = true;

    const result = await api(() => axios.delete('/users', { data: { ids: [id] } }));

    if (result.success) {
      router.visit('/users', { preserveScroll: true, preserveState: true });
    }

    isSubmitting = false;
  }
</script>

<Header group="users" />

<div class="min-h-[100dvh] bg-background text-foreground font-body antialiased selection:bg-primary/20 selection:text-primary">

  <section class="px-6 sm:px-10 lg:px-16 pt-28 pb-16">
    <div class="max-w-[1400px] mx-auto">

      <!-- Header row -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12" in:fly={{ y: 20, duration: 800 }}>
        <div>
          <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-4">Management</p>
          <h1 class="font-heading font-semibold tracking-[-0.03em] leading-[1] text-[clamp(2.5rem,6vw,4.5rem)] text-foreground">
            Users.
          </h1>
          <p class="mt-5 text-lg text-muted-foreground leading-relaxed max-w-[52ch]">
            Every person who has a seat at the table. Add, edit, or remove them here.
          </p>
        </div>

        <div class="flex items-center gap-6 shrink-0">
          <div class="text-right">
            <p class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Total</p>
            <p class="font-heading font-semibold text-3xl tracking-[-0.03em] text-foreground">{total}</p>
          </div>
          {#if permissions.canCreate}
            <Button onclick={openCreateUser} disabled={isSubmitting} size="lg">
              <Plus class="w-4 h-4" />
              Add user
            </Button>
          {/if}
        </div>
      </div>

      <!-- Table -->
      {#if users && users.length}
        <div class="border border-border rounded-xl overflow-hidden bg-card" in:fly={{ y: 20, duration: 800, delay: 150 }}>
          <div class="relative w-full overflow-x-auto">
            <table class="w-full caption-bottom text-sm">
              <thead>
                <tr class="border-b border-border">
                  <th class="h-12 px-5 text-start font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium whitespace-nowrap">User</th>
                  <th class="h-12 px-5 text-start font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium whitespace-nowrap">Roles</th>
                  <th class="h-12 px-5 text-end font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each users as userItem}
                  <tr class="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors duration-150">
                    <td class="p-5 align-middle whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div class="relative flex w-9 h-9 shrink-0 overflow-hidden rounded-full bg-muted border border-border items-center justify-center">
                          <span class="text-xs font-heading font-medium text-foreground">{userItem.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div class="min-w-0">
                          <div class="text-sm font-heading font-semibold tracking-tight text-foreground truncate">{userItem.name}</div>
                          <div class="text-xs text-muted-foreground truncate">{userItem.email}</div>
                        </div>
                      </div>
                    </td>
                    <td class="p-5 align-middle whitespace-nowrap">
                      <div class="flex flex-wrap items-center gap-1.5">
                        {#each (userItem.roles || []) as roleSlug}
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-heading font-medium capitalize {roleSlug === 'admin' ? 'bg-primary/10 border border-primary/20 text-primary' : 'bg-muted text-muted-foreground border border-border'}">
                            {getRoleDisplayName(roleSlug)}
                          </span>
                        {/each}
                        {#if !userItem.roles?.length}
                          <span class="text-xs text-muted-foreground">No roles</span>
                        {/if}
                      </div>
                    </td>
                    <td class="p-5 align-middle whitespace-nowrap text-right">
                      {#if permissions.canEdit || permissions.canDelete}
                        <div class="flex justify-end gap-2">
                          {#if permissions.canEdit}
                            <Button variant="outline" size="sm" onclick={() => openEditUser(userItem)} disabled={isSubmitting}>
                              <Pencil class="w-3 h-3" />
                              Edit
                            </Button>
                          {/if}
                          {#if permissions.canDelete}
                            <Button variant="ghost" size="sm" class="text-destructive hover:bg-destructive/10 hover:text-destructive" onclick={() => deleteUser(userItem.id)} disabled={isSubmitting}>
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

        <div in:fly={{ y: 10, duration: 600, delay: 300 }}>
          <Pagination meta={paginationMeta} />
        </div>
      {:else}
        <!-- Empty state -->
        <div class="border border-border rounded-xl bg-card flex flex-col items-center justify-center py-24 px-8 text-center" in:fly={{ y: 20, duration: 800, delay: 150 }}>
          <div class="w-14 h-14 rounded-full bg-muted border border-border flex items-center justify-center mb-6">
            <Users class="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 class="font-heading font-semibold text-xl tracking-tight text-foreground mb-2">No users yet</h3>
          <p class="text-sm text-muted-foreground max-w-xs mb-8">Start by adding your first person to the system.</p>
          {#if permissions.canCreate}
            <Button onclick={openCreateUser} size="lg">
              <Plus class="w-4 h-4" />
              Add first user
            </Button>
          {/if}
        </div>
      {/if}

    </div>
  </section>

  <UserModal
    show={showUserModal}
    {mode}
    {form}
    {isSubmitting}
    {availableRoles}
    on:close={closeUserModal}
    on:submit={handleSubmit}
  />
</div>
