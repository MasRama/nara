<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthSession } from '../../features/auth/web';

const authSession = useAuthSession();
const router = useRouter();
const isLoggingOut = ref(false);
const logoutError = ref('');

const user = computed(() => authSession.user.value);
const canViewUsers = computed(() => authSession.can('users.view'));
const canViewRoles = computed(() => authSession.can('roles.view'));
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
    logoutError.value = error instanceof Error ? error.message : 'Unable to sign out';
  } finally {
    isLoggingOut.value = false;
  }
}
</script>

<template>
  <div class="min-h-[100dvh] bg-background font-body text-foreground antialiased selection:bg-primary/20 selection:text-primary">
    <header class="border-b border-border bg-background/95 backdrop-blur-md">
      <nav class="mx-auto flex min-h-16 max-w-[1400px] items-center justify-between gap-6 px-6 sm:px-10 lg:px-16" aria-label="Application navigation">
        <div class="flex min-w-0 items-center gap-8">
          <RouterLink to="/" class="group flex shrink-0 items-center gap-2" aria-label="Nara home">
            <span class="inline-block h-2.5 w-2.5 rounded-full bg-primary transition-transform duration-300 group-hover:scale-125"></span>
            <span class="font-heading text-lg font-semibold tracking-tight">Nara</span>
          </RouterLink>

          <div v-if="authSession.isAuthenticated.value" class="flex items-center gap-1">
            <RouterLink
              to="/dashboard"
              class="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              active-class="bg-muted text-foreground"
            >
              Dashboard
            </RouterLink>
            <RouterLink
              v-if="canViewUsers"
              to="/users"
              class="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              active-class="bg-muted text-foreground"
            >
              Users
            </RouterLink>
            <RouterLink
              v-if="canViewRoles"
              to="/roles"
              class="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              active-class="bg-muted text-foreground"
            >
              Roles
            </RouterLink>
            <RouterLink
              to="/profile"
              class="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              active-class="bg-muted text-foreground"
            >
              Profile
            </RouterLink>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-3">
          <RouterLink
            to="/profile"
            class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-medium transition-colors hover:border-primary/50"
            :aria-label="`Open profile for ${user?.name ?? 'your account'}`"
          >
            <img v-if="user?.avatar" :src="user.avatar" :alt="`${user.name} avatar`" class="h-full w-full object-cover" />
            <span v-else>{{ initials }}</span>
          </RouterLink>
          <button
            type="button"
            :disabled="isLoggingOut"
            class="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            @click="logout"
          >
            {{ isLoggingOut ? 'Signing out…' : 'Sign out' }}
          </button>
        </div>
      </nav>
      <p v-if="logoutError" role="alert" class="mx-auto max-w-[1400px] px-6 pb-3 text-sm text-destructive sm:px-10 lg:px-16">
        {{ logoutError }}
      </p>
    </header>

    <slot />
  </div>
</template>
