<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthSession } from '../../features/auth/web';

const authSession = useAuthSession();
const user = authSession.user;
const firstName = computed(() => user.value?.name.split(' ')[0] || 'there');
</script>

<template>
  <main class="relative overflow-hidden px-6 py-12 sm:px-10 lg:px-16 lg:py-16">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1px)] text-foreground opacity-[0.03] [background-size:22px_22px] dark:opacity-[0.05]"></div>

    <section class="relative mx-auto max-w-[1100px]">
      <div class="flex flex-col gap-8">
        <div>
          <p class="font-heading text-xs uppercase tracking-[0.25em] text-primary">Personal workspace</p>
          <h1 class="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Welcome, {{ user?.name }}.</h1>
          <p class="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Good to see you, {{ firstName }}. Your account, profile, and security settings are ready from one place.
          </p>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <article class="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p class="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Signed in as</p>
            <h2 class="mt-4 truncate font-heading text-xl font-semibold tracking-tight">{{ user?.name }}</h2>
            <p class="mt-1 truncate text-sm text-muted-foreground">{{ user?.email }}</p>
          </article>

          <article class="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p class="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Session</p>
            <p class="mt-4 font-heading text-xl font-semibold tracking-tight text-primary">Active</p>
            <p class="mt-1 text-sm text-muted-foreground">Protected application access</p>
          </article>

          <article class="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p class="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Access</p>
            <p class="mt-4 font-heading text-xl font-semibold tracking-tight">Personal account</p>
            <p class="mt-1 text-sm text-muted-foreground">Only available to your session</p>
          </article>
        </div>

        <section class="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8" aria-labelledby="dashboard-actions-title">
          <div class="flex flex-col gap-2">
            <p class="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Shortcuts</p>
            <h2 id="dashboard-actions-title" class="font-heading text-2xl font-semibold tracking-tight">Account actions</h2>
            <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Update your identity or keep your sign-in credentials current without leaving the application.
            </p>
          </div>

          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <RouterLink
              to="/profile"
              class="group rounded-xl border border-border bg-background/60 p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <span class="font-heading text-base font-medium group-hover:text-primary">Edit profile</span>
              <span class="mt-2 block text-sm text-muted-foreground">Change your name, email, or avatar.</span>
            </RouterLink>
            <RouterLink
              to="/profile#security"
              class="group rounded-xl border border-border bg-background/60 p-5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <span class="font-heading text-base font-medium group-hover:text-primary">Change password</span>
              <span class="mt-2 block text-sm text-muted-foreground">Protect your account with a new password.</span>
            </RouterLink>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
