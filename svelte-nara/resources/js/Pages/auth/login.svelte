<script lang="ts">
  import { onMount } from 'svelte';
  import { inertia, router } from '@inertiajs/svelte'
  import { Toast } from '../../Components/helper';
  import NaraIcon from '../../Components/NaraIcon.svelte';
  import { fade, fly } from 'svelte/transition';

  onMount(() => {
      // Logic for onMount if needed in future
  });

  interface LoginForm {
    email: string;
    password: string;
  }

  let form: LoginForm = {
    email: '',
    password: '',
  }

  let { error }: { error?: string } = $props();

  $effect(() => {
    if (error) Toast(error, 'error');
  });

  function submitForm(): void {
    router.post("/login", { email: form.email, password: form.password })
  }
</script>

<div class="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-slate-100 flex overflow-hidden">
  
  <!-- Left Panel: Form -->
  <div class="w-full lg:w-1/2 flex flex-col justify-between p-8 lg:p-12 z-10 relative">
      <div>
          <a href="/" class="text-2xl font-bold tracking-tighter flex items-center gap-2">
              <NaraIcon />
              <span>NARA.</span>
          </a>
      </div>

      <div class="max-w-md w-full mx-auto" in:fly={{ y: 20, duration: 800 }}>
          <h1 class="text-4xl lg:text-5xl font-bold tracking-tight mb-2">Welcome Back.</h1>
          <p class="text-slate-500 dark:text-slate-400 mb-10 text-lg">Enter your credentials to access the grid.</p>

          <!-- Google Login Button -->
          <div class="flex flex-col space-y-4 mb-8">
              <a href="/google/redirect" 
                 class="group relative w-full flex items-center justify-center px-6 py-4 border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-300">
                  <svg class="h-5 w-5 mr-3 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span class="font-medium text-slate-700 dark:text-slate-200">Continue with Google</span>
              </a>
              
              <div class="relative py-2">
                  <div class="absolute inset-0 flex items-center">
                      <div class="w-full border-t border-slate-200 dark:border-white/10"></div>
                  </div>
                  <div class="relative flex justify-center text-xs uppercase tracking-widest">
                      <span class="bg-white dark:bg-black px-4 text-slate-400">Or via email</span>
                  </div>
              </div>
          </div>

          <form class="space-y-5" on:submit|preventDefault={submitForm}>
              <div class="space-y-1">
                  <label for="email" class="block text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Email</label>
                  <input bind:value={form.email} required type="text" name="email" id="email" 
                      class="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-all dark:text-white placeholder:text-slate-400" 
                      placeholder="nara@example.com" >
              </div>
              
              <div class="space-y-1">
                  <label for="password" class="block text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Password</label>
                  <input bind:value={form.password} required type="password" name="password" id="password" 
                      placeholder="••••••••" 
                      class="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-all dark:text-white placeholder:text-slate-400" >
              </div>  

              <div class="flex items-center justify-end">
                  <a href="/forgot-password" use:inertia class="text-sm font-medium text-slate-500 hover:text-primary-500 transition-colors">Forgot password?</a>
              </div>

              <button type="submit" 
                  class="group w-full relative overflow-hidden rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-lg py-4 transition-transform active:scale-[0.98]">
                  <span class="relative z-10">LOGIN</span>
                  <div class="absolute inset-0 bg-primary-500 transform translate-y-full transition-transform duration-300 group-hover:translate-y-0"></div>
              </button>

              <p class="text-center text-slate-500 dark:text-slate-400 mt-6">
                  Don't have an account? <a href="/register" use:inertia class="font-bold text-primary-600 dark:text-primary-400 hover:underline">Sign up</a>
              </p>
          </form>
      </div>

      <div class="text-xs text-slate-400 dark:text-slate-600">
          © 2025 NARA INC.
      </div>
  </div>

  <!-- Right Panel: Visual -->
  <div class="hidden lg:flex w-1/2 bg-surface-card-dark relative overflow-hidden items-center justify-center">
      <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30"></div>
      
      <!-- Abstract blobs -->
      <div class="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-500/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
      <div class="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent-500/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>

      <div class="relative z-10 max-w-lg text-center p-12">
          <h2 class="text-6xl font-bold tracking-tighter text-white mb-6 leading-[0.9]">
            PURE <br/> 
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-info-300">VELOCITY</span>
          </h2>
          <p class="text-xl text-slate-400 font-serif italic">
            "The only thing faster than Nara is the thought of using it."
          </p>

          <!-- Code Snippet Decoration -->
          <div class="mt-12 text-left bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-6 font-mono text-xs text-slate-300 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
             <div class="flex gap-2 mb-4">
               <div class="w-3 h-3 rounded-full bg-red-500"></div>
               <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
               <div class="w-3 h-3 rounded-full bg-green-500"></div>
             </div>
             <div>
                <span class="text-purple-400">const</span> <span class="text-blue-400">future</span> = <span class="text-purple-400">await</span> nara.<span class="text-yellow-300">load</span>();<br/>
                <span class="text-slate-500">// Welcome to the new standard.</span>
             </div>
          </div>
      </div>
  </div>
</div>
