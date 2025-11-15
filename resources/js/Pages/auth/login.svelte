<script>
    import { inertia,router } from '@inertiajs/svelte' 
    import NaraIcon from '../../Components/NaraIcon.svelte'; 
  
    let form = {
      email: '',
      password: '',
      password_confirmation: '',
      terms: false,
    }
    export let error;
    function submitForm()
    {
      
      router.post("/login", {email:form.email,password:form.password})
    }

 
  </script>
  
  <section class="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
    <div class="flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-16 mx-auto min-h-screen">
        <div  class="flex items-center mb-2 text-2xl font-semibold text-slate-50">
            <NaraIcon></NaraIcon>
        </div>
        <div class="mb-6 text-sm text-slate-400">
            <a href="/" use:inertia class="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200">
                <span>←</span>
                <span>Kembali ke beranda</span>
            </a>
        </div>
        <div class="w-full max-w-md rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.8)] md:mt-0 sm:max-w-md xl:p-0">
            <div class="p-6 space-y-4 md:space-y-6 sm:p-8">
              
                {#if error}
                <div class="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50  dark:text-red-400 dark:bg-red-900" role="alert">
                   {error}
                </div>
                {/if}
             

            <!-- Google Login Button -->
<div class="flex flex-col space-y-4">
    <a href="/google/redirect" 
       class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
        <svg class="h-5 w-5 mr-2" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
    </a>
    <div class="relative">
	        <div class="flex items-center gap-3 text-xs text-slate-500">
	            <div class="flex-1 border-t border-gray-700/80"></div>
	            <span class="shrink-0">Or continue with</span>
	            <div class="flex-1 border-t border-gray-700/80"></div>
	        </div>
	    </div>
</div>

               
                <form class="space-y-4 md:space-y-6" on:submit|preventDefault={submitForm}>
                    <div>
                        <label for="email" class="block mb-2 text-sm font-medium text-slate-200">Email</label>
                        <input bind:value={form.email} required type="text" name="email" id="email" class="bg-slate-900/70 border border-slate-700 text-slate-50 sm:text-sm rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:outline-none block w-full py-2.5 px-3 placeholder-slate-500" placeholder="nara@ramaren.com" >
                     
                    </div>
                    <div>
                        <label for="password" class="block mb-2 text-sm font-medium text-slate-200">Password</label>
                        <input bind:value={form.password} required type="password" name="password" id="password" placeholder="••••••••" class="bg-slate-900/70 border border-slate-700 text-slate-50 sm:text-sm rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:outline-none block w-full py-2.5 px-3 placeholder-slate-500" >
                    </div>  
                    <div class="flex items-center justify-end">
                        <a href="/forgot-password" use:inertia class="text-sm font-medium text-emerald-400 hover:underline">Lupa Password?</a>
                    </div>
                    <button type="submit" class="w-full text-sm font-medium rounded-full px-5 py-2.5 text-slate-950 bg-emerald-400 hover:bg-emerald-300 focus:ring-4 focus:outline-none focus:ring-emerald-300">Login</button>
                    <p class="text-sm font-light text-slate-400">
                        Belum punya akun?   <a href="/register" use:inertia class="font-medium text-emerald-400 hover:underline">Buat disini</a>
                    </p>
                    
                </form>
            </div>
        </div>
    </div>
  </section>