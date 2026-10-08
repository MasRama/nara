<script setup lang="ts">
import { onUnmounted } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import AuthenticatedShell from './layouts/AuthenticatedShell.vue';
import { startLiveUpdates } from './live-updates';

const route = useRoute();
onUnmounted(startLiveUpdates(useRouter()));

function initializeTheme(): void {
  let savedTheme: string | null = null;
  try {
    savedTheme = window.localStorage.getItem('nara-theme');
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
  const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', savedTheme ? savedTheme === 'dark' : prefersDark);
}

initializeTheme();
</script>

<template>
  <RouterView v-slot="{ Component }">
    <AuthenticatedShell v-if="route.meta.requiresAuth && !route.meta.standaloneAuth">
      <component :is="Component" />
    </AuthenticatedShell>
    <component v-else :is="Component" />
  </RouterView>
</template>
