<script lang="ts">
  import { inertia, router } from '@inertiajs/svelte'
  import axios from 'axios'
  import { api } from '$lib/api'
  import { Toast } from '$lib/toast'
  import DarkModeToggle from '../../Components/DarkModeToggle.svelte'
  import { fly, fade } from 'svelte/transition'
  import { ArrowRight, ArrowUpRight, Eye, EyeOff } from '@lucide/svelte'

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

<div class="min-h-[100dvh] bg-background text-foreground font-body antialiased selection:bg-primary/20 selection:text-primary grid grid-cols-1 lg:grid-cols-2">

  <!-- ───────────── LEFT: editorial image panel ───────────── -->
  <aside class="relative hidden lg:block overflow-hidden bg-muted">
    <img
      src="https://picsum.photos/seed/nara-return-quiet/1400/1800"
      alt="A quiet return"
      loading="eager"
      class="absolute inset-0 w-full h-full object-cover grayscale contrast-110 brightness-90"
    />
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30"></div>

    <div class="relative z-10 h-full flex flex-col justify-between p-12 xl:p-16">
      <a href="/" use:inertia class="flex items-center gap-2 group w-fit">
        <span class="inline-block w-2.5 h-2.5 rounded-full bg-primary transition-transform duration-300 group-hover:scale-125"></span>
        <span class="font-heading font-semibold tracking-tight text-lg text-white">Nara</span>
      </a>

      <div class="max-w-[28ch]">
        <p class="font-heading text-[11px] uppercase tracking-[0.25em] text-white/60 mb-5">No. 02 &nbsp;/&nbsp; The return</p>
        <p class="font-heading font-medium tracking-[-0.02em] leading-[1.1] text-[clamp(1.75rem,3vw,2.5rem)] text-white">
          Pick up where the machine left off.
        </p>
      </div>
    </div>
  </aside>

  <!-- ───────────── RIGHT: form panel ───────────── -->
  <main class="relative flex flex-col min-h-[100dvh]">
    <div class="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-foreground"></div>

    <!-- top bar -->
    <nav class="relative z-10 flex items-center justify-between h-16 px-6 sm:px-10 lg:px-12 shrink-0">
      <a href="/" use:inertia class="flex items-center gap-2 group lg:hidden">
        <span class="inline-block w-2.5 h-2.5 rounded-full bg-primary transition-transform duration-300 group-hover:scale-125"></span>
        <span class="font-heading font-semibold tracking-tight text-lg">Nara</span>
      </a>
      <span class="hidden lg:block"></span>
      <div class="flex items-center gap-4">
        <a href="/" use:inertia class="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 group">
          Home
          <ArrowUpRight class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
        <span class="w-px h-4 bg-border"></span>
        <DarkModeToggle />
      </div>
    </nav>

    <!-- form body -->
    <div class="relative z-10 flex-1 flex items-center px-6 sm:px-10 lg:px-12 py-10">
      <div class="w-full max-w-[400px] mx-auto" in:fly={{ y: 20, duration: 800, delay: 100 }}>

        <div class="mb-10">
          <p in:fade={{ duration: 600 }} class="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground mb-4">
            Welcome back
          </p>
          <h1 class="font-heading font-semibold tracking-[-0.03em] leading-[1] text-[clamp(2.5rem,6vw,3.5rem)] text-foreground">
            Sign in<br />
            <span class="italic font-medium text-primary leading-[1.05] pb-1">quietly.</span>
          </h1>
        </div>

        {#if error}
          <div in:fade={{ duration: 200 }} role="alert" class="mb-6 rounded-sm border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        {/if}

        <!-- Google OAuth -->
        <a
          href="/google/redirect"
          class="group w-full flex items-center justify-center gap-3 px-5 py-3.5 border border-border bg-card hover:border-foreground/30 hover:bg-muted/40 rounded-sm transition-all duration-300 cursor-pointer mb-5"
        >
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span class="font-body text-sm text-foreground">Continue with Google</span>
        </a>

        <!-- divider -->
        <div class="relative py-1 mb-5">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-border"></div>
          </div>
          <div class="relative flex justify-center">
            <span class="bg-background px-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-heading">or via email</span>
          </div>
        </div>

        <!-- form -->
        <form class="flex flex-col gap-5" onsubmit={(e) => { e.preventDefault(); submitForm() }}>
          <div class="flex flex-col gap-2">
            <Label for="email" class="text-xs uppercase tracking-widest font-heading text-muted-foreground">Email</Label>
            <Input bind:value={form.email} required type="text" name="email" id="email" placeholder="you@example.com" class="rounded-sm h-11" />
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <Label for="password" class="text-xs uppercase tracking-widest font-heading text-muted-foreground">Password</Label>
              <a href="/forgot-password" use:inertia class="text-xs text-muted-foreground hover:text-primary transition-colors">
                Forgot?
              </a>
            </div>
            <div class="relative">
              <Input bind:value={form.password} required type={showPassword ? 'text' : 'password'} name="password" id="password" placeholder="••••••••" class="pr-10 rounded-sm h-11" />
              <button type="button" onclick={() => (showPassword = !showPassword)} class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {#if showPassword}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={isLoading} size="lg" class="w-full rounded-sm h-12 normal-case tracking-normal font-heading font-medium text-sm mt-2">
            {#if isLoading}
              Signing in...
            {:else}
              Sign in
              <ArrowRight class="w-4 h-4" />
            {/if}
          </Button>

          <p class="text-center text-muted-foreground text-sm pt-2">
            No account yet?
            <a href="/register" use:inertia class="text-foreground hover:text-primary transition-colors underline underline-offset-4 decoration-border">Begin</a>
          </p>
        </form>
      </div>
    </div>

    <!-- footer -->
    <footer class="relative z-10 shrink-0 px-6 sm:px-10 lg:px-12 py-6 flex justify-between items-center text-xs text-muted-foreground">
      <span>&copy; {new Date().getFullYear()} Nara</span>
      <span class="font-heading uppercase tracking-[0.2em]">A foundation for building with AI</span>
    </footer>
  </main>
</div>
