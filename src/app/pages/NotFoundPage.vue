<template>
  <main class="flex min-h-[70vh] items-center justify-center px-6 py-16 sm:px-10">
    <section class="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-soft sm:p-12" data-testid="not-found-page">
      <p class="font-heading text-xs uppercase tracking-[0.25em] text-primary">404</p>
      <h1 class="mt-4 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Page not found</h1>
      <p class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
        The browser route you requested does not exist in this application.
      </p>
      <RouterLink to="/" class="mt-8 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
        Return home
      </RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>
