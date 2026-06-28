<script lang="ts">
  import { inertia, router } from '@inertiajs/svelte'
  import axios from 'axios'
  import { api } from '$lib/api'
  import { Toast } from '$lib/toast'
  import DarkModeToggle from '../../Components/DarkModeToggle.svelte'
  import { fly, fade } from 'svelte/transition'
  import { ArrowRight, Eye, EyeOff } from '@lucide/svelte'

  import Button from '../../Components/Button.svelte'
  import Input from '../../Components/Input.svelte'
  import Label from '../../Components/Label.svelte'

  interface LoginForm {
    email: string
    password: string
  }

  let form: LoginForm = $state({ email: '', password: '' })
  let showPassword = $state(false)
  let isLoading = $state(false)

  let { error }: { error?: string } = $props()

  $effect(() => {
    if (error) Toast(error, 'error')
  })

  async function submitForm(): Promise<void> {
    isLoading = true
    const result = await api(() => axios.post('/login', { email: form.email, password: form.password }))
    isLoading = false
    if (result.success) router.visit('/dashboard')
  }
</script>

<div class="relative min-h-[100dvh] bg-background text-foreground font-body antialiased selection:bg-primary/20 selection:text-primary overflow-hidden">

  <!-- ───────────── FULL-BLEED IMAGE BACKGROUND ───────────── -->
  <img
    src="/public/landing/login.webp"
    alt="A quiet return"
    class="absolute inset-0 w-full h-full object-cover grayscale contrast-110 brightness-[0.45]"
  />
  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/60"></div>
  <div class="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent"></div>

  <!-- ───────────── NAV (floating, like landing) ───────────── -->
  <nav class="relative z-20 flex items-center justify-between h-16 px-6 sm:px-10 lg:px-16">
    <a href="/" use:inertia class="flex items-center gap-2 group">
      <span class="inline-block w-2.5 h-2.5 rounded-full bg-primary transition-transform duration-300 group-hover:scale-125"></span>
      <span class="font-heading font-semibold tracking-tight text-lg text-white">Nara</span>
    </a>
    <div class="flex items-center gap-5 text-sm">
      <a href="/" use:inertia class="text-white/60 hover:text-white transition-colors">Home</a>
      <span class="w-px h-4 bg-white/20"></span>
      <DarkModeToggle />
    </div>
  </nav>

  <!-- ───────────── CONTENT: centered editorial, on image ───────────── -->
  <div class="relative z-10 flex flex-col items-center justify-center text-center min-h-[calc(100dvh-4rem)] px-6 sm:px-10 lg:px-16 pb-20">
    <div class="w-full max-w-[480px]" in:fly={{ y: 30, duration: 1000, delay: 100 }}>

      <p in:fade={{ duration: 700 }} class="font-heading text-xs uppercase tracking-[0.25em] text-white/50 mb-6">
        A foundation for building with AI
      </p>

      <h1 class="font-heading font-semibold tracking-[-0.03em] leading-[0.95] text-[clamp(3rem,8vw,6rem)] text-white" in:fly={{ y: 28, duration: 1000, delay: 150 }}>
        Sign in<br />
        <span class="italic font-medium text-primary leading-[1.05] pb-1">quietly.</span>
      </h1>

      <p in:fly={{ y: 22, duration: 1000, delay: 300 }} class="mt-6 text-lg text-white/60 leading-relaxed max-w-[44ch] mx-auto">
        Your sessions, your code, your machine. Pick up the thread.
      </p>

      {#if error}
        <div in:fade={{ duration: 200 }} role="alert" class="mt-8 rounded-xl border border-red-400/30 bg-red-500/10 backdrop-blur-sm px-4 py-3 text-sm text-red-200 text-left">
          {error}
        </div>
      {/if}

      <!-- form: glass inputs on image -->
      <form class="mt-10 flex flex-col gap-5 text-left" onsubmit={(e) => { e.preventDefault(); submitForm() }}>
        <div class="flex flex-col gap-2">
          <Label for="email" class="text-xs uppercase tracking-[0.2em] font-heading text-white/50">Email</Label>
          <Input bind:value={form.email} required type="text" name="email" id="email" placeholder="you@example.com" class="rounded-xl h-12 text-base text-white bg-white/5 border-white/15 backdrop-blur-md placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30" />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label for="password" class="text-xs uppercase tracking-[0.2em] font-heading text-white/50">Password</Label>
            <a href="/forgot-password" use:inertia class="text-xs text-white/40 hover:text-primary transition-colors">
              Forgot?
            </a>
          </div>
          <div class="relative">
            <Input bind:value={form.password} required type={showPassword ? 'text' : 'password'} name="password" id="password" placeholder="••••••••" class="pr-10 rounded-xl h-12 text-base text-white bg-white/5 border-white/15 backdrop-blur-md placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30" />
            <button type="button" onclick={() => (showPassword = !showPassword)} class="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {#if showPassword}
                <EyeOff class="w-4 h-4" />
              {:else}
                <Eye class="w-4 h-4" />
              {/if}
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-5 pt-3">
          <Button type="submit" disabled={isLoading} size="lg" class="rounded-xl px-7 h-12 text-sm normal-case tracking-normal font-heading font-medium">
            {#if isLoading}
              Signing in...
            {:else}
              Sign in
              <ArrowRight class="w-4 h-4" />
            {/if}
          </Button>
          <a href="/register" use:inertia class="text-sm text-white/50 hover:text-white transition-colors inline-flex items-center gap-1.5 group">
            No account?
            <span class="text-white underline underline-offset-4 decoration-white/30">Begin</span>
          </a>
        </div>
      </form>
    </div>
  </div>

  <!-- ───────────── FOOTER (on image) ───────────── -->
  <footer class="absolute bottom-0 inset-x-0 z-10 px-6 sm:px-10 lg:px-16 py-6 flex justify-between items-center text-xs text-white/40">
    <span>&copy; {new Date().getFullYear()} Nara</span>
    <span class="font-heading uppercase tracking-[0.2em]">A foundation for building with AI</span>
  </footer>
</div>
