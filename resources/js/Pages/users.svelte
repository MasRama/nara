<script lang="ts">
  import { fly } from 'svelte/transition';
  import { page as inertiaPage, router } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import UserModal from '../Components/UserModal.svelte';
  import Pagination from '../Components/Pagination.svelte';
  import axios from 'axios';
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import type { User, UserForm, PaginationMeta } from '../types';
  import { createEmptyUserForm, userToForm } from '../types';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import { Badge } from '$lib/components/ui/badge';
  import { Avatar, AvatarFallback } from '$lib/components/ui/avatar';
  import { Button } from '$lib/components/ui/button';
  import { Alert, AlertDescription } from '$lib/components/ui/alert';
  import { Users } from 'lucide-svelte';

  interface Props {
    users?: User[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
    search?: string;
    filter?: string;
  }

  let { 
    users = [], 
    total = 0, 
    page = 1, 
    limit = 10, 
    totalPages = 1, 
    hasNext = false, 
    hasPrev = false,
    search = '',
    filter = 'all'
  }: Props = $props();

  const currentUser = $inertiaPage.props.user as User | undefined;

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

  async function handleSubmit(event: CustomEvent<UserForm>): Promise<void> {
    const formData = event.detail;
    if (!formData.name || !formData.email) {
      Toast('Nama dan email wajib diisi', 'error');
      return;
    }

    isSubmitting = true;

    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      roles: formData.roles || ['user'],
      is_verified: formData.is_verified,
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
    if (!confirm('Yakin ingin menghapus user ini?')) {
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

<div class="min-h-screen bg-background text-foreground font-body transition-colors duration-500">

  <section class="relative px-6 sm:px-12 lg:px-24 pt-28 pb-16">
    <div class="max-w-[90rem] mx-auto">

      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10" in:fly={{ y: 20, duration: 800 }}>
        <div>
          <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-3">Management</span>
          <h1 class="text-4xl sm:text-5xl font-heading font-bold tracking-tighter" style="font-feature-settings: 'ss01'">Users</h1>
        </div>

        <div class="flex items-center gap-4">
          <div class="text-right">
            <p class="text-[10px] font-mono-accent uppercase tracking-widest text-muted-foreground mb-1">Total</p>
            <p class="text-3xl font-heading font-bold tracking-tighter">{total}</p>
          </div>

          <div class="h-10 w-px bg-border"></div>

          {#if currentUser && currentUser.roles?.includes('admin')}
            <Button
              class="rounded-full px-6 font-heading font-semibold text-sm"
              onclick={openCreateUser}
              disabled={isSubmitting}
            >
              Add User
            </Button>
          {/if}
        </div>
      </div>

      <div class="bg-card border border-border rounded-2xl overflow-hidden mb-8" in:fly={{ y: 20, duration: 800, delay: 150 }}>
        {#if users && users.length}
          <Table>
            <TableHeader>
              <TableRow class="border-border">
                <TableHead class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">User</TableHead>
                <TableHead class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">Status</TableHead>
                <TableHead class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground">Role</TableHead>
                <TableHead class="font-mono-accent text-[10px] uppercase tracking-widest text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each users as userItem}
                <TableRow class="border-border hover:bg-muted/30 transition-colors duration-150">
                  <TableCell>
                    <div class="flex items-center gap-3">
                      <Avatar class="w-8 h-8">
                        <AvatarFallback class="text-xs font-mono-accent bg-secondary text-foreground">
                          {userItem.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div class="text-sm font-heading font-semibold">{userItem.name}</div>
                        <div class="text-xs font-mono-accent text-muted-foreground">{userItem.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {#if userItem.is_verified}
                      <span class="font-mono-accent text-[10px] px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary">Verified</span>
                    {:else}
                      <span class="font-mono-accent text-[10px] px-2.5 py-1 bg-secondary rounded-full text-muted-foreground">Pending</span>
                    {/if}
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <span class="inline-flex h-1.5 w-1.5 rounded-full {userItem.roles?.includes('admin') ? 'bg-primary' : 'bg-border'}"></span>
                      <span class="text-xs font-mono-accent text-muted-foreground">{userItem.roles?.includes('admin') ? 'Admin' : 'User'}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-right">
                    {#if currentUser && currentUser.roles?.includes('admin')}
                      <div class="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          class="rounded-full text-xs font-heading font-medium px-4 hover:border-primary/40 hover:text-primary transition-colors duration-200"
                          onclick={() => openEditUser(userItem)}
                          disabled={isSubmitting}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          class="rounded-full text-xs font-heading font-medium px-4 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
                          onclick={() => deleteUser(userItem.id)}
                          disabled={isSubmitting}
                        >
                          Delete
                        </Button>
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
              <Users class="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 class="text-base font-heading font-semibold mb-2">No users yet</h3>
            <p class="text-sm text-muted-foreground font-body mb-6 max-w-xs">Start by adding your first user to the system.</p>
            {#if currentUser && currentUser.roles?.includes('admin')}
              <Button class="rounded-full px-6 font-heading font-semibold text-sm" onclick={openCreateUser}>
                Add First User
              </Button>
            {/if}
          </div>
        {/if}
      </div>

      <div in:fly={{ y: 10, duration: 600, delay: 300 }}>
        <Pagination meta={paginationMeta} />
      </div>

    </div>
  </section>

  <UserModal
    show={showUserModal}
    {mode}
    {form}
    {isSubmitting}
    on:close={closeUserModal}
    on:submit={handleSubmit}
  />
</div>
