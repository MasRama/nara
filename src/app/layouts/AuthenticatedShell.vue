<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthSession } from '../../features/auth/web';
import { navigationLinks } from '../navigation';
import SiteHeader from './SiteHeader.vue';

const authSession = useAuthSession();
const router = useRouter();
const isLoggingOut = ref(false);
const logoutError = ref('');
const user = computed(() => authSession.user.value);
const links = computed(() => navigationLinks(router.options.routes, authSession.allows));
const initials = computed(() => {
  const name = user.value?.name.trim() ?? '';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'NA';
});

async function logout(): Promise<void> {
  if (isLoggingOut.value) return;

  isLoggingOut.value = true;
  logoutError.value = '';
  try {
    const response = await authSession.logout();
    if (!response.success) {
      logoutError.value = response.message;
      return;
    }
    await router.replace({ name: 'login' });
  } catch (error) {
    console.error(error);
    logoutError.value = 'Unable to sign out';
  } finally {
    isLoggingOut.value = false;
  }
}
</script>

<template>
  <div class="min-h-[100dvh] bg-background font-body text-foreground antialiased selection:bg-primary/20 selection:text-primary">
    <SiteHeader nav-label="Application navigation">
      <template v-if="authSession.isAuthenticated.value" #nav>
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="site-header-link" active-class="site-header-link--active">
          {{ link.label }}
        </RouterLink>
      </template>
      <template #actions>
        <RouterLink to="/profile" class="site-header-avatar" :aria-label="`Open profile for ${user?.name ?? 'your account'}`">
          <img v-if="user?.avatar" :src="user.avatar" :alt="`${user.name} avatar`" />
          <span v-else>{{ initials }}</span>
        </RouterLink>
        <button type="button" :disabled="isLoggingOut" class="site-header-link" @click="logout">
          {{ isLoggingOut ? 'Signing out…' : 'Sign out' }}
        </button>
      </template>
      <p v-if="logoutError" role="alert" class="mx-auto max-w-[1112px] px-4 pt-3 text-sm text-destructive">
        {{ logoutError }}
      </p>
    </SiteHeader>

    <slot />
  </div>
</template>
