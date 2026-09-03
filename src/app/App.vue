<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';
import { useAuthSession } from '../features/auth/web';
import AuthenticatedShell from './layouts/AuthenticatedShell.vue';

const route = useRoute();
void useAuthSession().load();
</script>

<template>
  <RouterView v-slot="{ Component }">
    <AuthenticatedShell v-if="route.meta.requiresAuth">
      <component :is="Component" />
    </AuthenticatedShell>
    <component v-else :is="Component" />
  </RouterView>
</template>
