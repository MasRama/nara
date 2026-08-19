<script lang="ts">
  import { router } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import UserModal from '../Components/UserModal.svelte';
  import Pagination from '../Components/Pagination.svelte';
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import type { User, UserForm, PaginationMeta, RoleInfo } from '../types';
  import { createEmptyUserForm, userToForm } from '../types';
  import Button from '../Components/Button.svelte';
  import { Pencil, Plus, Trash2, Users } from '@lucide/svelte';

  interface PagePermissions {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }

  interface Props {
    users?: User[];
    availableRoles?: RoleInfo[];
    permissions?: PagePermissions;
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
  const visibleRoleSlugs = $derived(Array.from(new Set(users.flatMap((userItem) => userItem.roles ?? []))));
  const roleTypeCount = $derived(availableRoles.length || visibleRoleSlugs.length);

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

  function getInitials(name: string | null): string {
    const initials = (name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();

    return initials || '?';
  }

  function getUsersWithRole(roleSlug: string): number {
    return users.filter(userItem => userItem.roles?.includes(roleSlug)).length;
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

  <div class="fixed inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-foreground"></div>

  <section class="relative px-6 sm:px-10 lg:px-16 pt-28 pb-16">
    <div class="max-w-[1400px] mx-auto">

      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
        <div>
          <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Management</p>
          <h1 class="font-heading font-semibold tracking-[-0.02em] text-2xl sm:text-3xl text-foreground">
            Users <span class="text-muted-foreground font-normal">— the people behind the work.</span>
          </h1>
        </div>

        <div class="flex flex-wrap items-center gap-3 sm:justify-end">
          <div class="inline-flex items-center gap-x-4 font-mono-accent text-xs text-muted-foreground rounded-full bg-card/60 ring-1 ring-border/40 px-4 py-2 backdrop-blur-sm">
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

      {#if users && users.length}
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">

          <aside class="lg:col-span-4 flex flex-col gap-4">
            <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] p-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">People</p>
                  <h2 class="text-xl font-heading font-semibold tracking-tight text-foreground">User directory</h2>
                </div>
                <div class="w-10 h-10 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                  <Users class="w-5 h-5 text-primary" />
                </div>
              </div>

              <p class="text-sm text-muted-foreground leading-relaxed mt-5">Keep account details and access roles clear for everyone working in Nara.</p>

              <div class="grid grid-cols-2 gap-2 mt-6">
                <div class="rounded-xl bg-muted/40 ring-1 ring-border/40 p-3">
                  <p class="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Showing</p>
                  <p class="text-2xl font-heading font-semibold tracking-tight text-foreground mt-2">{users.length}</p>
                </div>
                <div class="rounded-xl bg-muted/40 ring-1 ring-border/40 p-3">
                  <p class="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Total users</p>
                  <p class="text-2xl font-heading font-semibold tracking-tight text-foreground mt-2">{total}</p>
                </div>
                <div class="rounded-xl bg-muted/40 ring-1 ring-border/40 p-3">
                  <p class="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Page</p>
                  <p class="text-2xl font-heading font-semibold tracking-tight text-foreground mt-2">{page}<span class="text-sm font-normal text-muted-foreground">/{totalPages}</span></p>
                </div>
                <div class="rounded-xl bg-muted/40 ring-1 ring-border/40 p-3">
                  <p class="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Role types</p>
                  <p class="text-2xl font-heading font-semibold tracking-tight text-foreground mt-2">{roleTypeCount}</p>
                </div>
              </div>

              <div class="h-px bg-gradient-to-r from-transparent via-border/70 to-transparent my-6"></div>

              <div>
                <div class="flex items-center justify-between gap-3">
                  <p class="font-heading text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Current page roles</p>
                  <span class="font-mono-accent text-[11px] text-muted-foreground">{visibleRoleSlugs.length} used</span>
                </div>
                {#if visibleRoleSlugs.length}
                  <div class="flex flex-col gap-2 mt-3">
                    {#each visibleRoleSlugs.slice(0, 5) as roleSlug}
                      <div class="flex items-center justify-between gap-3 rounded-xl bg-muted/30 ring-1 ring-border/40 px-3 py-2.5">
                        <span class="text-sm font-heading font-medium text-foreground">{getRoleDisplayName(roleSlug)}</span>
                        <span class="font-mono-accent text-[11px] text-muted-foreground">{getUsersWithRole(roleSlug)}</span>
                      </div>
                    {/each}
                    {#if visibleRoleSlugs.length > 5}
                      <p class="text-xs text-muted-foreground mt-1">+{visibleRoleSlugs.length - 5} more roles on this page.</p>
                    {/if}
                  </div>
                {:else}
                  <p class="text-xs text-muted-foreground mt-3">No roles assigned on this page.</p>
                {/if}
              </div>
            </div>
          </aside>

          <div class="lg:col-span-8">
            <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
              <div class="flex items-start justify-between gap-4 border-b border-border/50 p-5 sm:p-6">
                <div>
                  <p class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Directory</p>
                  <h2 class="text-xl font-heading font-semibold tracking-tight text-foreground">Team members</h2>
                  <p class="text-sm text-muted-foreground mt-1">Review identities, roles, and account access.</p>
                </div>
                <div class="hidden sm:flex items-center gap-2 rounded-full bg-muted/40 ring-1 ring-border/40 px-3 py-1.5 font-mono-accent text-[11px] text-muted-foreground shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  {users.length} visible
                </div>
              </div>

              <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 p-4 sm:p-5">
                {#each users as userItem, i}
                  <div class="group rounded-xl bg-background/70 ring-1 ring-border/50 p-4 flex flex-col gap-4 hover:ring-primary/30 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),0_8px_28px_-6px_rgba(16,185,129,0.12)] transition-all duration-300">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-center gap-3 min-w-0">
                        <span class="font-mono-accent text-[11px] text-muted-foreground/50 w-5 shrink-0 hidden sm:block">{String(i + 1).padStart(2, '0')}</span>
                        <div class="w-11 h-11 rounded-full bg-gradient-to-br from-muted to-muted/60 ring-1 ring-border/40 flex items-center justify-center shrink-0 overflow-hidden">
                          {#if userItem.avatar}
                            <img src={userItem.avatar} alt={userItem.name || 'User avatar'} class="size-full object-cover" />
                          {:else}
                            <span class="text-sm font-heading font-medium text-foreground">{getInitials(userItem.name)}</span>
                          {/if}
                        </div>
                        <div class="min-w-0">
                          <h3 class="text-sm font-heading font-semibold tracking-tight text-foreground truncate">{userItem.name}</h3>
                          <p class="text-xs text-muted-foreground truncate font-mono-accent mt-0.5">{userItem.email || '—'}</p>
                        </div>
                      </div>
                      {#if userItem.roles?.includes('admin')}
                        <span class="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-heading font-medium text-primary ring-1 ring-primary/20 shrink-0">Admin</span>
                      {/if}
                    </div>

                    <div class="min-h-[2rem] flex flex-wrap items-start gap-1.5">
                      {#each (userItem.roles || []) as roleSlug}
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-heading font-medium capitalize {roleSlug === 'admin' ? 'bg-primary/10 ring-1 ring-primary/20 text-primary' : 'bg-muted ring-1 ring-border/50 text-muted-foreground'}">
                          {getRoleDisplayName(roleSlug)}
                        </span>
                      {/each}
                      {#if !userItem.roles?.length}
                        <span class="text-xs text-muted-foreground">No roles assigned</span>
                      {/if}
                    </div>

                    <div class="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                      <span class="text-xs text-muted-foreground">{userItem.roles?.length ?? 0} {(userItem.roles?.length ?? 0) === 1 ? 'role' : 'roles'} assigned</span>
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
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <div>
              <Pagination meta={paginationMeta} />
            </div>
          </div>
        </div>
      {:else}
        <div class="rounded-2xl bg-card ring-1 ring-border/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center py-20 px-8 text-center">
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
