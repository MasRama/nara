<script lang="ts">
  import { fly } from 'svelte/transition';
  import { page as inertiaPage, router } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import UserModal from '../Components/UserModal.svelte';
  import Pagination from '../Components/Pagination.svelte';
  import axios from 'axios';
  import { api, Toast } from '../Components/helper';
  import type { User, UserForm, PaginationMeta } from '../types';
  import { createEmptyUserForm, userToForm } from '../types';

  export let users: User[] = [];
  export let total: number = 0;
  export let page: number = 1;
  export let limit: number = 10;
  export let totalPages: number = 1;
  export let hasNext: boolean = false;
  export let hasPrev: boolean = false;
  export const search: string = '';
  export const filter: string = 'all';

  const currentUser = $inertiaPage.props.user as User | undefined;

  $: paginationMeta = { total, page, limit, totalPages, hasNext, hasPrev } as PaginationMeta;

  let showUserModal: boolean = false;
  let isSubmitting: boolean = false;
  let mode: 'create' | 'edit' = 'create';
  let form: UserForm = createEmptyUserForm();

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
      is_admin: formData.is_admin,
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

          {#if currentUser && currentUser.is_admin}
            <button
              class="group relative px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-wider rounded-full overflow-hidden hover:scale-105 transition-transform disabled:opacity-50"
              on:click={openCreateUser}
              disabled={isSubmitting}
            >
              <span class="relative z-10 flex items-center gap-2">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Add User
              </span>
              <div class="absolute inset-0 bg-primary-500 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            </button>
          {/if}
        </div>
      </div>

      <!-- Users Grid - Card Based -->
      <div class="mb-12" in:fly={{ y: 30, duration: 800, delay: 200 }}>
        {#if users && users.length}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each users as userItem, i}
              <div 
                class="group relative bg-surface-card-light dark:bg-surface-card-dark border border-slate-200 dark:border-white/5 hover:border-accent-500/50 dark:hover:border-accent-500/30 p-6 rounded-2xl transition-all duration-500 overflow-hidden"
                in:fly={{ y: 20, duration: 400, delay: i * 50 }}
              >
                <!-- Hover Glow -->
                <div class="absolute top-0 right-0 p-20 bg-accent-500/5 rounded-full blur-3xl -mr-10 -mt-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div class="relative z-10">
                  <!-- User Header -->
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center gap-3">
                      <!-- Avatar -->
                      <div class="w-12 h-12 rounded-full bg-gradient-to-br from-accent-500 to-accent-400 flex items-center justify-center text-white font-bold text-lg">
                        {userItem.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 class="font-bold text-lg tracking-tight">{userItem.name}</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400">{userItem.email}</p>
                      </div>
                    </div>
                    
                    <!-- Status Badge -->
                    <span class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full {userItem.is_verified 
                      ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20' 
                      : 'bg-warning-500/10 text-warning-600 dark:text-warning-400 border border-warning-500/20'}">
                      {userItem.is_verified ? 'Verified' : 'Pending'}
                    </span>
                  </div>

                  <!-- User Details -->
                  <div class="space-y-2 mb-4">
                    <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <span class="font-mono">{userItem.phone || '—'}</span>
                    </div>
                    <div class="flex items-center gap-2 text-xs">
                      <span class="inline-flex h-1.5 w-1.5 rounded-full {userItem.is_admin ? 'bg-accent-500' : 'bg-slate-400'}"></span>
                      <span class="text-slate-500 dark:text-slate-400">{userItem.is_admin ? 'Administrator' : 'Standard User'}</span>
                    </div>
                  </div>

                  <!-- Actions -->
                  {#if currentUser && currentUser.is_admin}
                    <div class="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-white/5">
                      <button
                        class="flex-1 px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 rounded-full hover:border-accent-500/50 hover:text-accent-500 transition-colors disabled:opacity-50"
                        on:click={() => openEditUser(userItem)}
                        disabled={isSubmitting}
                      >
                        Edit
                      </button>
                      <button
                        class="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-danger-500/20 text-danger-500 rounded-full hover:bg-danger-500 hover:text-white transition-colors disabled:opacity-50"
                        on:click={() => deleteUser(userItem.id)}
                        disabled={isSubmitting}
                      >
                        Delete
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <!-- Empty State -->
          <div class="text-center py-20 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
            <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <svg class="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="9" cy="7" r="4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3 class="text-xl font-bold mb-2">No Users Yet</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">Start by adding your first user to the system.</p>
            {#if currentUser && currentUser.is_admin}
              <button
                class="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-wider rounded-full hover:scale-105 transition-transform"
                on:click={openCreateUser}
              >
                Add First User
              </button>
            {/if}
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
