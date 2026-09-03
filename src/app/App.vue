<script setup lang="ts">
import { RouterView } from 'vue-router';
import { useAuthSession } from '../features/auth/web';

void useAuthSession().load();
</script>

<template>
  <RouterView />
</template>
