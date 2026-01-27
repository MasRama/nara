<script lang="ts">
  import { onMount } from 'svelte';
  import { inertia, router } from '@inertiajs/svelte'
  import { password_generator, Toast } from '../../components/helper';
  import NaraIcon from '../../components/NaraIcon.svelte';
  import { fade, fly } from 'svelte/transition';

  onMount(() => {
      // Logic for onMount if needed in future
  });

  interface RegisterForm {
    email: string;
    password: string;
    name: string;
    phone: string;
    password_confirmation: string;
  }

  let form: RegisterForm = {
    email: '',
    password: '',
    name: '',
    phone: '',
    password_confirmation: '', 
  }

  let { error }: { error?: string } = $props();

  $effect(() => {
    if (error) Toast(error, 'error');
  });

  function submitForm(): void {
    if (form.password != form.password_confirmation) {
      Toast("Password dan konfirmasi password harus sama", "error");
      return;
    }
 
    form.phone = form.phone.toString()
    router.post("/register", form as any)
  }

  function generatePassword(): void { 
    const retVal = password_generator(10); 
    form.password = retVal
    form.password_confirmation = retVal
  }
</script>

<div class="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-slate-100 flex overflow-hidden">
  
  <!-- Right Panel: Visual (Swapped for Register) -->
  <div class="hidden lg:flex w-1/2 bg-surface-card-dark relative overflow-hidden items-center justify-center order-2 lg:order-1">
      <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30"></div>
      
      <!-- Abstract blobs -->
      <div class="absolute top-0 left-0 w-[600px] h-[600px] bg-info-500/20 rounded-full blur-[120px] -translate-y-1/2 -translate-x-1/2"></div>
      <div class="absolute bottom-0 right-0 w-[600px] h-[600px] bg-primary-500/10 rounded-full blur-[120px] translate-y-1/2 translate-x-1/2"></div>

      <div class="relative z-10 max-w-lg text-center p-12">
          <h2 class="text-6xl font-bold tracking-tighter text-white mb-6 leading-[0.9]">
            JOIN THE <br/> 
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-info-400 to-accent-300">REVOLUTION</span>
          </h2>
          <p class="text-xl text-slate-400 font-serif italic">
            "Build what others can't. Ship when others don't."
          </p>

          <!-- Terminal Decoration -->
          <div class="mt-12 text-left bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-6 font-mono text-xs text-slate-300 shadow-2xl transform -rotate-2 hover:rotate-0 transition-transform duration-500">
             <div class="flex gap-2 mb-4">
               <div class="w-3 h-3 rounded-full bg-slate-700"></div>
               <div class="w-3 h-3 rounded-full bg-slate-700"></div>
               <div class="w-3 h-3 rounded-full bg-slate-700"></div>
             </div>
             <div class="space-y-2">
                <div><span class="text-primary-400">$</span> init user --new</div>
                <div class="text-slate-500">Creating workspace...</div>
                <div class="text-slate-500">Allocating resources...</div>
                <div><span class="text-info-400">✓</span> User created successfully.</div>
             </div>
          </div>
      </div>
  </div>

  <!-- Left Panel: Form -->
  <div class="w-full lg:w-1/2 flex flex-col justify-between p-8 lg:p-12 z-10 relative overflow-y-auto order-1 lg:order-2">
      <div>
          <a href="/" class="text-2xl font-bold tracking-tighter flex items-center gap-2 justify-end lg:justify-start">
              <NaraIcon />
              <span>NARA.</span>
          </a>
      </div>

      <div class="max-w-md w-full mx-auto mt-8 lg:mt-0" in:fly={{ y: 20, duration: 800 }}>
          <h1 class="text-4xl lg:text-5xl font-bold tracking-tight mb-2">Create Account.</h1>
          <p class="text-slate-500 dark:text-slate-400 mb-8 text-lg">Start building your legacy.</p>

          <!-- Google Signup Button -->
          <div class="flex flex-col space-y-4 mb-8">
              <a href="/google/redirect" 
                 class="group relative w-full flex items-center justify-center px-6 py-4 border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-300">
                  <svg class="h-5 w-5 mr-3 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span class="font-medium text-slate-700 dark:text-slate-200">Sign up with Google</span>
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

          <form class="space-y-4" on:submit|preventDefault={submitForm}>
              <div class="space-y-1">
                  <label for="name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Full Name</label>
                  <input bind:value={form.name} required type="text" name="name" id="name" 
                      class="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-info-500/50 focus:border-info-500 outline-none transition-all dark:text-white placeholder:text-slate-400" 
                      placeholder="Rama Ren" >
              </div>

              <div class="space-y-1">
                  <label for="email" class="block text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Email</label>
                  <input bind:value={form.email} required type="text" name="email" id="email" 
                      class="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-info-500/50 focus:border-info-500 outline-none transition-all dark:text-white placeholder:text-slate-400" 
                      placeholder="nara@example.com" >
              </div> 

              <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1">
                      <label for="password" class="block text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Password</label>
                      <input bind:value={form.password} required type="password" name="password" id="password" 
                          placeholder="••••••••" 
                          class="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-info-500/50 focus:border-info-500 outline-none transition-all dark:text-white placeholder:text-slate-400" >
                  </div>
                  <div class="space-y-1">
                      <label for="confirm-password" class="block text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Confirm</label>
                      <input bind:value={form.password_confirmation} type="password" name="confirm-password" id="confirm-password" 
                          placeholder="••••••••" 
                          class="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-info-500/50 focus:border-info-500 outline-none transition-all dark:text-white placeholder:text-slate-400" >
                  </div>
              </div>

              <div class="flex justify-end">
                <button type="button" on:click="{generatePassword}" class="text-xs font-mono text-info-400 hover:text-info-300 transition-colors flex items-center gap-1">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19H12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    GENERATE SECURE PASSWORD
                </button>
              </div>
           
              <button type="submit" 
                  class="group w-full relative overflow-hidden rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-lg py-4 transition-transform active:scale-[0.98] mt-4">
                  <span class="relative z-10">CREATE ACCOUNT</span>
                  <div class="absolute inset-0 bg-info-500 transform translate-y-full transition-transform duration-300 group-hover:translate-y-0"></div>
              </button>

              <p class="text-center text-slate-500 dark:text-slate-400 mt-6">
                  Already have an account? <a href="/login" use:inertia class="font-bold text-info-500 dark:text-info-400 hover:underline">Login</a>
              </p>
          </form>
      </div>

      <div class="text-xs text-slate-400 dark:text-slate-600 mt-8 lg:mt-0 text-right lg:text-left">
          © 2025 NARA INC.
      </div>
  </div>
</div>