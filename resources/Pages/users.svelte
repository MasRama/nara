<script lang="ts">
  import { fly } from 'svelte/transition';
  import { router } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import UserModal from '../Components/UserModal.svelte';
  import Pagination from '../Components/Pagination.svelte';
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import type { User, UserForm, PaginationMeta, RoleInfo } from '../types';
  import { createEmptyUserForm, userToForm } from '../types';
  import Button from '../Components/Button.svelte';
  import { Users, Plus, Pencil, Trash2 } from '@lucide/svelte';

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
    hasPrev = false
  }: Props = $props();

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
      ? await api('/users', { method: 'POST', body: payload })
      : await api(`/users/${formData.id}`, { method: 'PUT', body: payload });

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

    const result = await api('/users', { method: 'DELETE', body: { ids: [id] } });

    if (result.success) {
      router.visit('/users', { preserveScroll: true, preserveState: true });
    }

    isSubmitting = false;
  }
</script>

<Header group="users" />

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
            Users <span class="text-muted-foreground font-normal">— every seat at the table.</span>
          </h1>
        </div>

        <div class="flex items-center gap-4 shrink-0">
          <div class="inline-flex items-center gap-x-4 gap-y-2 font-mono-accent text-xs text-muted-foreground rounded-full bg-card/60 ring-1 ring-border/40 px-4 py-2 backdrop-blur-sm">
            <span><span class="text-foreground font-medium">{total}</span> total</span>
            <span class="w-px h-3 bg-border/60"></span>
            <span>page <span class="text-foreground font-medium">{page}</span>/{totalPages}</span>
          </div>
          {#if permissions.canCreate}
            <Button onclick={openCreateUser} disabled={isSubmitting} size="lg" class="rounded-xl">
              <Plus class="w-4 h-4" />
              Add user
            </Button>
          {/if}
        </div>
      </div>

      <!-- Table -->
      {#if users && users.length}
        <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] overflow-hidden" in:fly={{ y: 16, duration: 600, delay: 120 }}>
          <div class="relative w-full overflow-x-auto">
            <table class="w-full caption-bottom text-sm">
              <thead>
                <tr>
                  <th class="h-12 px-5 text-start font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium whitespace-nowrap">User</th>
                  <th class="h-12 px-5 text-start font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium whitespace-nowrap">Roles</th>
                  <th class="h-12 px-5 text-end font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each users as userItem, i}
                  <tr class="border-t border-border/40 hover:bg-muted/30 transition-colors duration-200">
                    <td class="p-4 align-middle whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <span class="font-mono-accent text-[11px] text-muted-foreground/50 w-5 shrink-0 hidden sm:block">{String(i + 1).padStart(2, '0')}</span>
                        <div class="w-9 h-9 rounded-full bg-gradient-to-br from-muted to-muted/60 ring-1 ring-border/40 flex items-center justify-center shrink-0">
                          <span class="text-xs font-heading font-medium text-foreground">{userItem.name?.charAt(0).toUpperCase()}</span>
                        </div>
                        <div class="min-w-0">
                          <div class="text-sm font-heading font-semibold tracking-tight text-foreground truncate">{userItem.name}</div>
                          <div class="text-xs text-muted-foreground truncate font-mono-accent">{userItem.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td class="p-4 align-middle whitespace-nowrap">
                      <div class="flex flex-wrap items-center gap-1.5">
                        {#each (userItem.roles || []) as roleSlug}
                          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-heading font-medium capitalize {roleSlug === 'admin' ? 'bg-primary/10 ring-1 ring-primary/20 text-primary' : 'bg-muted ring-1 ring-border/50 text-muted-foreground'}">
                            {getRoleDisplayName(roleSlug)}
                          </span>
                        {/each}
                        {#if !userItem.roles?.length}
                          <span class="text-xs text-muted-foreground">No roles</span>
                        {/if}
                      </div>
                    </td>
                    <td class="p-4 align-middle whitespace-nowrap text-right">
                      {#if permissions.canEdit || permissions.canDelete}
                        <div class="flex justify-end gap-2">
                          {#if permissions.canEdit}
                            <Button variant="outline" size="sm" onclick={() => openEditUser(userItem)} disabled={isSubmitting} class="rounded-lg">
                              <Pencil class="w-3 h-3" />
                              Edit
                            </Button>
                          {/if}
                          {#if permissions.canDelete}
                            <Button variant="ghost" size="sm" class="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg" onclick={() => deleteUser(userItem.id)} disabled={isSubmitting}>
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

        <div in:fly={{ y: 10, duration: 600, delay: 240 }}>
          <Pagination meta={paginationMeta} />
        </div>
      {:else}
        <!-- Empty state -->
        <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center py-20 px-8 text-center" in:fly={{ y: 16, duration: 600, delay: 120 }}>
          <div class="w-14 h-14 rounded-full bg-gradient-to-br from-muted to-muted/60 ring-1 ring-border/40 flex items-center justify-center mb-6">
            <Users class="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 class="font-heading font-semibold text-lg tracking-tight text-foreground mb-2">No users yet</h3>
          <p class="text-sm text-muted-foreground max-w-xs mb-6">Start by adding your first person to the system.</p>
          {#if permissions.canCreate}
            <Button onclick={openCreateUser} size="lg" class="rounded-xl">
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
    bind:form
    {isSubmitting}
    {availableRoles}
    on:close={closeUserModal}
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
