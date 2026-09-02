<script setup lang="ts">
import { ref } from 'vue';
import { createAuthClient } from '../client';

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref('');

const authClient = createAuthClient();

async function submitLogin(): Promise<void> {
  errorMessage.value = '';
  isSubmitting.value = true;

  try {
    const response = await authClient.login({
      email: email.value,
      password: password.value,
    });

    if (!response.success) {
      errorMessage.value = response.message;
      return;
    }

    window.location.assign('/dashboard');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to sign in';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-12 text-foreground">
    <section class="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-soft">
      <div class="mb-8">
        <a href="/" class="font-heading text-lg font-semibold tracking-tight">Nara</a>
        <h1 class="mt-8 font-heading text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p class="mt-2 text-sm leading-relaxed text-muted-foreground">Sign in to continue to your workspace.</p>
      </div>

      <form class="space-y-5" @submit.prevent="submitLogin">
        <label class="block text-sm font-medium" for="email">
          Email
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            required
            class="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label class="block text-sm font-medium" for="password">
          Password
          <span class="relative mt-2 block">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              name="password"
              autocomplete="current-password"
              required
              class="block w-full rounded-md border border-input bg-background px-3 py-2.5 pr-24 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? 'Hide' : 'Show' }}
            </button>
          </span>
        </label>

        <p v-if="errorMessage" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 font-heading text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ isSubmitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-muted-foreground">
        New to Nara?
        <a href="/register" class="text-primary transition-opacity hover:opacity-80">Create an account</a>
      </p>
    </section>
  </main>
</template>
