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

<div class="min-h-screen bg-surface-light dark:bg-surface-dark text-slate-900 dark:text-slate-100 transition-colors duration-500 overflow-x-hidden selection:bg-primary-400 selection:text-black">
  
  <!-- Background Effects -->
  <div class="fixed inset-0 pointer-events-none z-0">
    <div class="absolute top-0 left-1/2 w-[1000px] h-[1000px] bg-accent-500/5 rounded-full blur-3xl -translate-x-1/2 -mt-[500px]"></div>
  </div>

  <section class="relative px-6 sm:px-12 lg:px-24 pt-24 pb-20">
    <div class="max-w-[90rem] mx-auto">
      
      <!-- Header Section -->
      <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16" in:fly={{ y: 50, duration: 800 }}>
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.3em] text-accent-600 dark:text-accent-400 mb-6">
            Management
          </p>
          <h1 class="text-[8vw] sm:text-[6vw] lg:text-[4vw] leading-[0.9] font-bold tracking-tighter mb-4">
            USERS
          </h1>
          <p class="text-lg text-slate-500 dark:text-slate-400 max-w-xl font-serif italic">
            "Control who enters. Manage who stays."
          </p>
        </div>

        <div class="flex items-center gap-6">
          <!-- Stats -->
          <div class="text-right">
            <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1">Total</p>
            <p class="text-3xl font-bold tracking-tight">{total}</p>
          </div>
          
          <div class="h-12 w-px bg-slate-200 dark:bg-slate-700"></div>

          {#if currentUser && currentUser.roles?.includes('admin')}
            <Button
              variant="default"
              class="rounded-full px-6 uppercase tracking-wider font-bold text-xs"
              onclick={openCreateUser}
              disabled={isSubmitting}
            >
              <Users class="mr-2 h-4 w-4" />
              Add User
            </Button>
          {/if}
        </div>
      </div>

      <!-- Users Grid - Card Based -->
      <div class="mb-12 bg-card rounded-2xl border" in:fly={{ y: 30, duration: 800, delay: 200 }}>
        {#if users && users.length}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each users as userItem}
                <TableRow>
                  <TableCell>
                    <div class="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{userItem.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div class="font-medium">{userItem.name}</div>
                        <div class="text-sm text-muted-foreground">{userItem.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {#if userItem.is_verified}
                      <Badge variant="default" class="bg-primary/10 text-primary hover:bg-primary/20">Verified</Badge>
                    {:else}
                      <Badge variant="secondary" class="bg-warning/10 text-warning hover:bg-warning/20">Pending</Badge>
                    {/if}
                  </TableCell>
                  <TableCell>
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-2 text-xs">
                        <span class="inline-flex h-1.5 w-1.5 rounded-full {userItem.roles?.includes('admin') ? 'bg-accent-500' : 'bg-slate-400'}"></span>
                        <span class="text-slate-500 dark:text-slate-400">{userItem.roles?.includes('admin') ? 'Administrator' : 'Standard User'}</span>
                      </div>
                      <div class="flex items-center gap-2 text-xs text-muted-foreground">
                        <span class="font-mono">{userItem.phone || '—'}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell class="text-right">
                    {#if currentUser && currentUser.roles?.includes('admin')}
                      <div class="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          class="rounded-full text-xs font-bold uppercase tracking-wider"
                          onclick={() => openEditUser(userItem)}
                          disabled={isSubmitting}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          class="rounded-full text-xs font-bold uppercase tracking-wider bg-danger/10 text-danger hover:bg-danger hover:text-white"
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
          <!-- Empty State -->
          <div class="p-8">
            <Alert class="flex flex-col items-center justify-center text-center py-12 border-dashed">
              <div class="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                <Users class="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 class="text-lg font-semibold mb-2">No Users Yet</h3>
              <AlertDescription class="mb-6">
                Start by adding your first user to the system.
              </AlertDescription>
              {#if currentUser && currentUser.roles?.includes('admin')}
                <Button
                  class="rounded-full uppercase tracking-wider font-bold text-xs"
                  onclick={openCreateUser}
                >
                  Add First User
                </Button>
              {/if}
            </Alert>
          </div>
        {/if}
      </div>

      <!-- Pagination -->
      <div in:fly={{ y: 20, duration: 600, delay: 400 }}>
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
