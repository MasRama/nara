<script>
  import { fly } from 'svelte/transition';
  import { page, router } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import axios from 'axios';
  import { api, Toast } from '../Components/helper';

  export let users = [];
  export let search = '';
  export let filter = 'all';
  export let pageCurrent;

  const currentUser = $page.props.user;

  let showUserModal = false;
  let isSubmitting = false;
  let mode = 'create';
  let form = {
    id: null,
    name: '',
    email: '',
    phone: '',
    is_admin: false,
    is_verified: false,
    password: ''
  };

  function resetForm() {
    form = {
      id: null,
      name: '',
      email: '',
      phone: '',
      is_admin: false,
      is_verified: false,
      password: ''
    };
  }

  function openCreateUser() {
    mode = 'create';
    resetForm();
    showUserModal = true;
  }

  function openEditUser(userItem) {
    mode = 'edit';
    form = {
      id: userItem.id,
      name: userItem.name || '',
      email: userItem.email || '',
      phone: userItem.phone || '',
      is_admin: !!userItem.is_admin,
      is_verified: !!userItem.is_verified,
      password: ''
    };
    showUserModal = true;
  }

  function closeUserModal() {
    showUserModal = false;
    resetForm();
  }

  async function submitUserForm() {
    if (!form.name || !form.email) {
      Toast('Nama dan email wajib diisi', 'error');
      return;
    }

    isSubmitting = true;

    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      is_admin: form.is_admin,
      is_verified: form.is_verified,
      password: form.password || undefined
    };

    const result = mode === 'create'
      ? await api(() => axios.post('/users', payload))
      : await api(() => axios.put(`/users/${form.id}`, payload));

    if (result.success) {
      closeUserModal();
      router.visit('/dashboard', { preserveScroll: true, preserveState: true });
    }

    isSubmitting = false;
  }

  async function deleteUser(id) {
    if (!confirm('Yakin ingin menghapus user ini?')) {
      return;
    }

    isSubmitting = true;

    const result = await api(() => axios.delete('/users', { data: { ids: [id] } }));

    if (result.success) {
      router.visit('/dashboard', { preserveScroll: true, preserveState: true });
    }

    isSubmitting = false;
  }
</script>

<Header group="dashboard" />

<section class="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
    <div class="grid gap-10 lg:grid-cols-[3fr,2fr] items-start">
      <div in:fly={{ x: -20, duration: 600 }}>
        <p class="text-xs tracking-[0.35em] uppercase text-slate-400 mb-4">
          Dashboard
        </p>
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.25] mb-4">
          Selamat datang kembali,
          <span
            class="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400"
          >
            {$page.props.user?.name || 'Nara user'}
          </span>
        </h1>
        <p class="text-base sm:text-lg text-slate-300/90 max-w-xl mb-8">
          Ini adalah ringkasan singkat aktivitas dan data akun kamu. Desain dan nuansanya
          dibuat senada dengan landing page supaya terasa satu produk yang utuh.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-xs text-slate-300/90">
          <div class="rounded-2xl bg-slate-900/80 border border-slate-800 px-4 py-3">
            <p class="text-[11px] tracking-[0.18em] uppercase text-slate-500 mb-1">Users</p>
            <p class="text-lg font-semibold text-slate-50">{users?.length ?? 0}</p>
          </div>
          <div class="rounded-2xl bg-slate-900/80 border border-slate-800 px-4 py-3">
            <p class="text-[11px] tracking-[0.18em] uppercase text-slate-500 mb-1">Filter</p>
            <p class="text-sm font-medium capitalize">{filter}</p>
          </div>
          <div class="rounded-2xl bg-slate-900/80 border border-slate-800 px-4 py-3">
            <p class="text-[11px] tracking-[0.18em] uppercase text-slate-500 mb-1">Halaman</p>
            <p class="text-sm font-medium">{pageCurrent || 1}</p>
          </div>
        </div>
      </div>

      <div class="relative" in:fly={{ x: 20, duration: 600, delay: 80 }}>
        <div class="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/10 to-transparent blur-2xl"></div>
        <div class="relative rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-6 sm:p-7 shadow-[0_24px_80px_rgba(15,23,42,0.8)]">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-medium tracking-[0.18em] uppercase text-slate-500">Account snapshot</span>
            <span class="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 px-3 py-1 text-[10px] font-medium text-emerald-200">
              ● Active
            </span>
          </div>

          <div class="space-y-4 text-xs text-slate-200/90">
            <div class="flex items-center justify-between rounded-2xl bg-slate-900/80 px-4 py-3 border border-slate-800">
              <div>
                <p class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Email</p>
                <p class="text-sm font-medium">{$page.props.user?.email}</p>
              </div>
              <span class="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] text-emerald-300">
                {($page.props.user?.is_verified ? 'verified' : 'unverified')}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-2xl bg-slate-900/70 border border-slate-800 px-3 py-3">
                <p class="text-[11px] text-slate-500 mb-1">Status</p>
                <p class="text-sm font-semibold text-slate-50">{($page.props.user?.is_admin ? 'Admin' : 'User')}</p>
              </div>
              <div class="rounded-2xl bg-slate-900/70 border border-slate-800 px-3 py-3">
                <p class="text-[11px] text-slate-500 mb-1">Search</p>
                <p class="text-sm font-semibold text-slate-50 truncate">{search || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
