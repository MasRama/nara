<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthSession } from '../../features/auth/web';
import { useLocalText } from '../../shared/i18n';
import { error as errorText, t } from '../locales';
import SiteHeader from './SiteHeader.vue';

const authSession = useAuthSession();
const router = useRouter();
const isLoggingOut = ref(false);
const logoutError = useLocalText();
const user = computed(() => authSession.user.value);
const canViewUsers = computed(() => authSession.can('users.view'));
const canViewRoles = computed(() => authSession.can('roles.view'));
const canViewActivity = computed(() => authSession.can('activity.view'));
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
      logoutError.value = () => errorText(response);
      return;
    }
    await router.replace({ name: 'login' });
  } catch (error) {
    console.error(error);
    logoutError.value = () => t('shell.signOutFailed');
  } finally {
    isLoggingOut.value = false;
  }
}
</script>

<template>
  <div class="min-h-[100dvh] bg-background font-body text-foreground antialiased selection:bg-primary/20 selection:text-primary">
    <SiteHeader :nav-label="t('shell.navLabel')">
      <template v-if="authSession.isAuthenticated.value" #nav>
        <RouterLink to="/dashboard" class="site-header-link" active-class="site-header-link--active">{{ t('shell.nav.dashboard') }}</RouterLink>
        <RouterLink v-if="canViewUsers" to="/users" class="site-header-link" active-class="site-header-link--active">{{ t('shell.nav.users') }}</RouterLink>
        <RouterLink v-if="canViewRoles" to="/roles" class="site-header-link" active-class="site-header-link--active">{{ t('shell.nav.roles') }}</RouterLink>
        <RouterLink v-if="canViewActivity" to="/activity" class="site-header-link" active-class="site-header-link--active">{{ t('shell.nav.activity') }}</RouterLink>
        <RouterLink to="/profile" class="site-header-link" active-class="site-header-link--active">{{ t('shell.nav.profile') }}</RouterLink>
        <RouterLink to="/security" class="site-header-link" active-class="site-header-link--active">{{ t('shell.nav.security') }}</RouterLink>
      </template>
      <template #actions>
        <RouterLink to="/profile" class="site-header-avatar" :aria-label="t('shell.openProfile', { name: user?.name ?? t('shell.yourAccount') })">
          <img v-if="user?.avatar" :src="user.avatar" :alt="t('shell.avatarAlt', { name: user.name })" />
          <span v-else>{{ initials }}</span>
        </RouterLink>
        <button type="button" :disabled="isLoggingOut" class="site-header-link" @click="logout">
          {{ isLoggingOut ? t('shell.signingOut') : t('shell.signOut') }}
        </button>
      </template>
      <p v-if="logoutError" role="alert" class="mx-auto max-w-[1112px] px-4 pt-3 text-sm text-destructive">
        {{ logoutError }}
      </p>
    </SiteHeader>

    <slot />
  </div>
</template>
