<script setup lang="ts">
import { computed } from 'vue';
import { usePage, Link } from '@inertiajs/vue3';
import Header from '../components/Header.vue';

interface User {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  is_verified: boolean;
}

const props = defineProps<{
  users?: User[];
  search?: string;
  filter?: string;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}>();

const pageData = usePage();
const currentUser = computed(() => pageData.props.user as User | undefined);

const hour = new Date().getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
</script>

<template>
  <Header group="dashboard" />

  <div class="min-h-screen bg-surface-light dark:bg-surface-dark text-slate-900 dark:text-slate-100 transition-colors duration-500 overflow-x-hidden selection:bg-primary-400 selection:text-black">

    <!-- Background Effects -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-500/5 rounded-full blur-3xl -mr-96 -mt-96"></div>
      <div class="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent-500/5 rounded-full blur-3xl -ml-64 -mb-64"></div>
    </div>

    <!-- Hero Section -->
    <section class="relative px-6 sm:px-12 lg:px-24 pt-24 pb-20">
      <div class="max-w-[90rem] mx-auto">

        <!-- Giant Welcome -->
        <div class="mb-16">
          <p class="text-xs font-bold uppercase tracking-[0.3em] text-primary-600 dark:text-primary-400 mb-6">
            {{ greeting }}
          </p>
          <h1 class="text-[8vw] sm:text-[6vw] lg:text-[5vw] leading-[0.9] font-bold tracking-tighter">
            Welcome back,
            <span class="block text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-info-300 dark:from-primary-400 dark:to-info-300">
              {{ currentUser?.name || 'Commander' }}
            </span>
          </h1>
        </div>

        <!-- Stats Grid - Radical Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">

          <!-- Card: Total Users -->
          <div class="group relative h-48 bg-surface-card-light dark:bg-surface-card-dark border border-slate-200 dark:border-white/5 hover:border-primary-500/50 dark:hover:border-primary-500/30 p-6 flex flex-col justify-between transition-all duration-500 overflow-hidden rounded-2xl">
            <div class="absolute top-0 right-0 p-24 bg-primary-500/5 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-primary-500/10 transition-colors duration-500"></div>

            <div class="relative z-10 flex justify-between items-start">
              <div class="p-2 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 group-hover:scale-110 transition-transform duration-300">
                <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="9" cy="7" r="4" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="text-[10px] font-mono opacity-40 uppercase">Users</span>
            </div>

            <div class="relative z-10">
              <p class="text-4xl font-bold tracking-tight mb-1">{{ total || users?.length || 0 }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">Total registered</p>
            </div>
          </div>

          <!-- Card: Current Page -->
          <div class="group relative h-48 bg-surface-card-light dark:bg-surface-card-dark border border-slate-200 dark:border-white/5 hover:border-accent-500/50 dark:hover:border-accent-500/30 p-6 flex flex-col justify-between transition-all duration-500 overflow-hidden rounded-2xl">
            <div class="absolute top-0 right-0 p-24 bg-accent-500/5 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-accent-500/10 transition-colors duration-500"></div>

            <div class="relative z-10 flex justify-between items-start">
              <div class="p-2 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 group-hover:scale-110 transition-transform duration-300">
                <svg class="w-5 h-5 text-accent-600 dark:text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
                  <polyline points="14 2 14 8 20 8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="text-[10px] font-mono opacity-40 uppercase">Page</span>
            </div>

            <div class="relative z-10">
              <p class="text-4xl font-bold tracking-tight mb-1">{{ props.page }}<span class="text-lg text-slate-400">/{{ totalPages }}</span></p>
              <p class="text-xs text-slate-500 dark:text-slate-400">Current view</p>
            </div>
          </div>

          <!-- Card: Filter Status -->
          <div class="group relative h-48 bg-surface-card-light dark:bg-surface-card-dark border border-slate-200 dark:border-white/5 hover:border-warning-500/50 dark:hover:border-warning-500/30 p-6 flex flex-col justify-between transition-all duration-500 overflow-hidden rounded-2xl">
            <div class="absolute top-0 right-0 p-24 bg-warning-500/5 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-warning-500/10 transition-colors duration-500"></div>

            <div class="relative z-10 flex justify-between items-start">
              <div class="p-2 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 group-hover:scale-110 transition-transform duration-300">
                <svg class="w-5 h-5 text-warning-600 dark:text-warning-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="text-[10px] font-mono opacity-40 uppercase">Filter</span>
            </div>

            <div class="relative z-10">
              <p class="text-2xl font-bold tracking-tight mb-1 capitalize">{{ filter }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">Active filter</p>
            </div>
          </div>

          <!-- Card: Account Status -->
          <div class="group relative h-48 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-6 flex flex-col justify-between transition-all duration-500 overflow-hidden rounded-2xl">
            <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>

            <div class="relative z-10 flex justify-between items-start">
              <div class="p-2 bg-white/10 dark:bg-black/5 rounded-lg border border-white/10 dark:border-black/5 group-hover:scale-110 transition-transform duration-300">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="text-[10px] font-mono opacity-60 uppercase">Status</span>
            </div>

            <div class="relative z-10">
              <p class="text-2xl font-bold tracking-tight mb-1">{{ currentUser?.is_admin ? 'Admin' : 'User' }}</p>
              <div class="flex items-center gap-2">
                <span class="inline-flex h-2 w-2 rounded-full bg-primary-400 animate-pulse"></span>
                <p class="text-xs opacity-80">{{ currentUser?.is_verified ? 'Verified' : 'Unverified' }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Account Details Section -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">

          <!-- Left: Quick Info -->
          <div class="lg:col-span-5">
            <span class="block text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-6">Account Details</span>

            <div class="space-y-4">
              <div class="group p-6 border border-slate-200 dark:border-white/5 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-300">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-2">Email Address</p>
                    <p class="text-lg font-medium">{{ currentUser?.email }}</p>
                  </div>
                  <span class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full" :class="currentUser?.is_verified ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'bg-warning-500/10 text-warning-600 dark:text-warning-400'">
                    {{ currentUser?.is_verified ? 'Verified' : 'Pending' }}
                  </span>
                </div>
              </div>

              <div class="group p-6 border border-slate-200 dark:border-white/5 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-300">
                <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-2">Search Query</p>
                <p class="text-lg font-medium font-mono">{{ search || '—' }}</p>
              </div>
            </div>
          </div>

          <!-- Right: Quick Actions -->
          <div class="lg:col-span-7">
            <span class="block text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-6">Quick Actions</span>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/users"
                class="group relative p-6 border border-slate-200 dark:border-white/5 rounded-2xl hover:border-primary-500/50 transition-all duration-300 overflow-hidden"
              >
                <div class="absolute inset-0 bg-primary-500/5 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                <div class="relative z-10">
                  <div class="flex items-center justify-between mb-4">
                    <div class="h-10 w-10 bg-primary-500/10 rounded-full flex items-center justify-center">
                      <svg class="w-5 h-5 text-primary-600 dark:text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="9" cy="7" r="4" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <svg class="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <h3 class="text-lg font-bold mb-1">Manage Users</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400">View and manage all registered users</p>
                </div>
              </Link>

              <Link
                href="/profile"
                class="group relative p-6 border border-slate-200 dark:border-white/5 rounded-2xl hover:border-accent-500/50 transition-all duration-300 overflow-hidden"
              >
                <div class="absolute inset-0 bg-accent-500/5 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                <div class="relative z-10">
                  <div class="flex items-center justify-between mb-4">
                    <div class="h-10 w-10 bg-accent-500/10 rounded-full flex items-center justify-center">
                      <svg class="w-5 h-5 text-accent-600 dark:text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="7" r="4" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <svg class="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <h3 class="text-lg font-bold mb-1">Edit Profile</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Update your account information</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </section>

  </div>
</template>
