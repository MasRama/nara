<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthSession } from '../../features/auth/web';

const authSession = useAuthSession();
const user = authSession.user;
const router = useRouter();
const isLoggingOut = ref(false);
const logoutError = ref('');

async function logout(): Promise<void> {
  if (isLoggingOut.value) return;

  logoutError.value = '';
  isLoggingOut.value = true;
  try {
    const response = await authSession.logout();
    if (!response.success) {
      logoutError.value = response.message;
      return;
    }

    await router.replace({ name: 'login' });
  } catch (error) {
    logoutError.value = error instanceof Error ? error.message : 'Unable to sign out';
  } finally {
    isLoggingOut.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-12 text-foreground">
    <section class="w-full max-w-lg rounded-lg border border-border bg-card p-8 shadow-soft">
      <nav class="flex items-center justify-between text-sm">
        <RouterLink to="/" class="font-heading text-lg font-semibold tracking-tight">Nara</RouterLink>
        <button
          type="button"
          :disabled="isLoggingOut"
          class="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          @click="logout"
        >
          {{ isLoggingOut ? 'Signing out…' : 'Sign out' }}
        </button>
      </nav>

      <div class="mt-16">
        <p class="font-heading text-xs uppercase tracking-[0.25em] text-primary">Authenticated</p>
        <h1 class="mt-4 font-heading text-4xl font-semibold tracking-tight">Welcome, {{ user?.name }}.</h1>
        <p class="mt-4 leading-relaxed text-muted-foreground">
          Your session is active. The full application workspace will be composed here by the next feature task.
        </p>
        <p class="mt-2 text-sm text-muted-foreground">{{ user?.email }}</p>

        <p v-if="logoutError" role="alert" class="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {{ logoutError }}
        </p>
      </div>
    </section>
  </main>
</template>
