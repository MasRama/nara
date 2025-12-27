<script lang="ts">
  import { fly } from 'svelte/transition';
  import { page as inertiaPage } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import type { User } from '../types';

  export let users: User[] = [];
  export let search: string = '';
  export let filter: string = 'all';
  // Pagination meta from backend
  export let total: number = 0;
  export let page: number = 1;
  export let limit: number = 10;
  export let totalPages: number = 1;
  export let hasNext: boolean = false;
  export let hasPrev: boolean = false;

  const currentUser = $inertiaPage.props.user as User | undefined;
</script>

<Header group="dashboard" />

<section class="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-50">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
    <div class="grid gap-10 lg:grid-cols-[3fr,2fr] items-start">
      <div in:fly={{ x: -20, duration: 600 }}>
        <p class="text-xs tracking-[0.35em] uppercase text-slate-500 dark:text-slate-400 mb-4">
          Dashboard
        </p>
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.25] mb-4">
          Selamat datang kembali,
          <span
            class="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400"
          >
            {$inertiaPage.props.user?.name || 'Nara user'}
          </span>
        </h1>
        <p class="text-base sm:text-lg text-slate-600 dark:text-slate-300/90 max-w-xl mb-8">
          Ini adalah ringkasan singkat aktivitas dan data akun kamu. Desain dan nuansanya
          dibuat senada dengan landing page supaya terasa satu produk yang utuh.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-xs text-slate-600 dark:text-slate-300/90">
          <div class="rounded-2xl bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 px-4 py-3">
            <p class="text-[11px] tracking-[0.18em] uppercase text-slate-500 mb-1">Users</p>
            <p class="text-lg font-semibold text-slate-900 dark:text-slate-50">{users?.length ?? 0}</p>
          </div>
          <div class="rounded-2xl bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 px-4 py-3">
            <p class="text-[11px] tracking-[0.18em] uppercase text-slate-500 mb-1">Filter</p>
            <p class="text-sm font-medium capitalize">{filter}</p>
          </div>
          <div class="rounded-2xl bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 px-4 py-3">
            <p class="text-[11px] tracking-[0.18em] uppercase text-slate-500 mb-1">Halaman</p>
            <p class="text-sm font-medium">{page}</p>
          </div>
        </div>
      </div>

      <div class="relative" in:fly={{ x: 20, duration: 600, delay: 80 }}>
        <div class="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/10 to-transparent blur-2xl"></div>
        <div class="relative rounded-3xl border border-gray-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/70 backdrop-blur-xl p-6 sm:p-7 shadow-xl dark:shadow-[0_24px_80px_rgba(15,23,42,0.8)]">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-medium tracking-[0.18em] uppercase text-slate-500 dark:text-slate-500">Account snapshot</span>
            <span class="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 px-3 py-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-200">
              ● Active
            </span>
          </div>

          <div class="space-y-4 text-xs text-slate-700 dark:text-slate-200/90">
            <div class="flex items-center justify-between rounded-2xl bg-gray-50 dark:bg-slate-900/80 px-4 py-3 border border-gray-200 dark:border-slate-800">
              <div>
                <p class="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Email</p>
                <p class="text-sm font-medium">{$inertiaPage.props.user?.email}</p>
              </div>
              <span class="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] text-emerald-600 dark:text-emerald-300">
                {($inertiaPage.props.user?.is_verified ? 'verified' : 'unverified')}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-2xl bg-gray-50 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-800 px-3 py-3">
                <p class="text-[11px] text-slate-500 mb-1">Status</p>
                <p class="text-sm font-semibold text-slate-900 dark:text-slate-50">{($inertiaPage.props.user?.is_admin ? 'Admin' : 'User')}</p>
              </div>
              <div class="rounded-2xl bg-gray-50 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-800 px-3 py-3">
                <p class="text-[11px] text-slate-500 mb-1">Search</p>
                <p class="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">{search || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
