<script lang="ts">
  import { fly } from 'svelte/transition';
  import axios from "axios";
  import Header from "../Components/Header.svelte";
  import { api, Toast } from "../Components/helper";

  interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    is_admin: boolean;
    is_verified: boolean;
  }

  export let user: User;

  let current_password: string = '';
  let new_password: string = '';
  let confirm_password: string = '';
  let isLoading: boolean = false;
  let previewUrl: string | null = user.avatar || null;

  function handleAvatarChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      isLoading = true;
      axios
        .post("/assets/avatar", formData)
        .then((response) => {
          setTimeout(() => {
            isLoading = false;
            previewUrl = response.data + "?v=" + Date.now();
          }, 500);
          user.avatar = response.data + "?v=" + Date.now();
          Toast("Avatar berhasil diupload", "success");
        })
        .catch(() => {
          isLoading = false;
          Toast("Gagal mengupload avatar", "error");
        });
    }
  }

  async function changeProfile(): Promise<void> {
    isLoading = true;
    await api(() => axios.post("/change-profile", user));
    isLoading = false;
  }

  async function changePassword(): Promise<void> {
    if (new_password != confirm_password) {
      Toast("Password tidak cocok", "error");
      return;
    }

    if (!current_password || !new_password || !confirm_password) {
      Toast("Mohon isi semua field", "error");
      return;
    }

    isLoading = true;
    const result = await api(() => axios.post("/change-password", {
      current_password,
      new_password,
    }));

    if (result.success) {
      current_password = "";
      new_password = "";
      confirm_password = "";
    }
    isLoading = false;
  }
</script>

<Header group="profile" />

<div class="min-h-screen bg-surface-light dark:bg-surface-dark text-slate-900 dark:text-slate-100 transition-colors duration-500 overflow-x-hidden selection:bg-primary-400 selection:text-black">
  
  <!-- Background Effects -->
  <div class="fixed inset-0 pointer-events-none z-0">
    <div class="absolute top-0 right-0 w-[600px] h-[600px] bg-info-500/5 rounded-full blur-3xl -mr-64 -mt-64"></div>
    <div class="absolute bottom-0 left-0 w-[800px] h-[800px] bg-primary-500/5 rounded-full blur-3xl -ml-96 -mb-96"></div>
  </div>

  <section class="relative px-6 sm:px-12 lg:px-24 pt-24 pb-20">
    <div class="max-w-[90rem] mx-auto">
      
      <!-- Hero Section -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 mb-20">
        
        <!-- Left: Giant Profile Card -->
        <div class="lg:col-span-5" in:fly={{ x: -50, duration: 800 }}>
          <p class="text-xs font-bold uppercase tracking-[0.3em] text-info-600 dark:text-info-400 mb-6">
            Account
          </p>
          <h1 class="text-[8vw] sm:text-[5vw] lg:text-[3.5vw] leading-[0.9] font-bold tracking-tighter mb-8">
            YOUR
            <span class="block text-transparent bg-clip-text bg-gradient-to-r from-info-500 to-primary-400">
              PROFILE
            </span>
          </h1>

          <!-- Profile Card -->
          <div class="relative">
            <div class="absolute -inset-1 bg-gradient-to-r from-info-500/20 to-primary-500/20 rounded-3xl blur-xl"></div>
            <div class="relative bg-surface-card-light dark:bg-surface-card-dark border border-slate-200 dark:border-white/5 rounded-3xl p-8 overflow-hidden">
              <!-- Decorative -->
              <div class="absolute top-0 right-0 p-32 bg-info-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
              
              <div class="relative z-10">
                <!-- Avatar Section -->
                <div class="flex items-center gap-6 mb-8">
                  <div class="relative group">
                    <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-info-500 to-primary-500 p-0.5">
                      <div class="w-full h-full rounded-2xl bg-surface-card-light dark:bg-surface-card-dark overflow-hidden flex items-center justify-center">
                        {#if previewUrl}
                          <img
                            src={previewUrl}
                            alt="Profile"
                            class="w-full h-full object-cover"
                          />
                        {:else}
                          <span class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-info-500 to-primary-500">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        {/if}
                      </div>
                    </div>
                    <label
                      class="absolute -bottom-2 -right-2 w-8 h-8 bg-slate-900 dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                    >
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="13" r="4" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <input
                        type="file"
                        accept="image/*"
                        on:change={handleAvatarChange}
                        class="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <h2 class="text-2xl font-bold tracking-tight mb-1">{user.name}</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                  </div>
                </div>

                <!-- Status Badges -->
                <div class="flex flex-wrap gap-2 mb-6">
                  <span class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full {user.is_admin 
                    ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 border border-accent-500/20' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'}">
                    {user.is_admin ? 'Administrator' : 'Standard User'}
                  </span>
                  <span class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full {user.is_verified 
                    ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20' 
                    : 'bg-warning-500/10 text-warning-600 dark:text-warning-400 border border-warning-500/20'}">
                    {user.is_verified ? 'Verified' : 'Unverified'}
                  </span>
                </div>

                <!-- Quick Info -->
                <div class="space-y-3">
                  <div class="flex items-center gap-3 text-sm">
                    <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="font-mono text-slate-600 dark:text-slate-300">{user.phone || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Security Note -->
          <div class="mt-6 p-4 border border-slate-200 dark:border-white/5 rounded-2xl">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div>
                <p class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Secure Storage</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Your data is encrypted and stored securely on Nara's backend infrastructure.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Forms -->
        <div class="lg:col-span-7 space-y-8" in:fly={{ x: 50, duration: 800, delay: 200 }}>
          
          <!-- Personal Info Form -->
          <div class="relative bg-surface-card-light dark:bg-surface-card-dark border border-slate-200 dark:border-white/5 hover:border-info-500/30 rounded-3xl p-8 transition-colors duration-500">
            <div class="flex items-center justify-between mb-8">
              <div>
                <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-info-600 dark:text-info-400">Settings</span>
                <h3 class="text-xl font-bold tracking-tight mt-1">Personal Information</h3>
              </div>
              <div class="w-10 h-10 rounded-full bg-info-500/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-info-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="7" r="4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>

            <form on:submit|preventDefault={changeProfile} class="space-y-6">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label for="name" class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                    Full Name
                  </label>
                  <input
                    bind:value={user.name}
                    type="text"
                    id="name"
                    class="w-full px-4 py-3 rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-700 text-sm focus:border-info-500 focus:ring-2 focus:ring-info-500/20 outline-none transition-all"
                    placeholder="Your full name"
                  />
                </div>

                <div class="space-y-2">
                  <label for="phone" class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                    Phone Number
                  </label>
                  <input
                    bind:value={user.phone}
                    type="text"
                    id="phone"
                    class="w-full px-4 py-3 rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-700 text-sm focus:border-info-500 focus:ring-2 focus:ring-info-500/20 outline-none transition-all"
                    placeholder="+62 xxx xxxx xxxx"
                  />
                </div>
              </div>

              <div class="space-y-2">
                <label for="email" class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Email Address
                </label>
                <input
                  bind:value={user.email}
                  type="email"
                  id="email"
                  class="w-full px-4 py-3 rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-700 text-sm focus:border-info-500 focus:ring-2 focus:ring-info-500/20 outline-none transition-all"
                  placeholder="you@example.com"
                />
              </div>

              <div class="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  class="group relative px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-wider rounded-full overflow-hidden hover:scale-105 transition-transform disabled:opacity-50"
                >
                  <span class="relative z-10 flex items-center gap-2">
                    {#if isLoading}
                      <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    {:else}
                      Save Changes
                    {/if}
                  </span>
                  <div class="absolute inset-0 bg-info-500 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
              </div>
            </form>
          </div>

          <!-- Password Form -->
          <div class="relative bg-surface-card-light dark:bg-surface-card-dark border border-slate-200 dark:border-white/5 hover:border-warning-500/30 rounded-3xl p-8 transition-colors duration-500">
            <div class="flex items-center justify-between mb-8">
              <div>
                <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-warning-600 dark:text-warning-400">Security</span>
                <h3 class="text-xl font-bold tracking-tight mt-1">Change Password</h3>
              </div>
              <div class="w-10 h-10 rounded-full bg-warning-500/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-warning-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>

            <form on:submit|preventDefault={changePassword} class="space-y-6">
              <div class="space-y-2">
                <label for="current_password" class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Current Password
                </label>
                <input
                  bind:value={current_password}
                  type="password"
                  id="current_password"
                  class="w-full px-4 py-3 rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-700 text-sm focus:border-warning-500 focus:ring-2 focus:ring-warning-500/20 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label for="new_password" class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                    New Password
                  </label>
                  <input
                    bind:value={new_password}
                    type="password"
                    id="new_password"
                    class="w-full px-4 py-3 rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-700 text-sm focus:border-warning-500 focus:ring-2 focus:ring-warning-500/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <div class="space-y-2">
                  <label for="confirm_password" class="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                    Confirm Password
                  </label>
                  <input
                    bind:value={confirm_password}
                    type="password"
                    id="confirm_password"
                    class="w-full px-4 py-3 rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-700 text-sm focus:border-warning-500 focus:ring-2 focus:ring-warning-500/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div class="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  class="px-6 py-3 text-xs font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 rounded-full hover:border-warning-500 hover:text-warning-500 transition-colors disabled:opacity-50"
                >
                  {#if isLoading}
                    <span class="flex items-center gap-2">
                      <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </span>
                  {:else}
                    Update Password
                  {/if}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>

    </div>
  </section>

</div>
