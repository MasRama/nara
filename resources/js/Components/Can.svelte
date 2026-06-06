<script lang="ts">
  import { page } from '@inertiajs/svelte';
  import type { Snippet } from 'svelte';

  interface User {
    roles?: string[];
    permissions?: string[];
  }

  let {
    permission = '',
    role = '',
    children,
  }: {
    permission?: string;
    role?: string;
    children: Snippet;
  } = $props();

  let user = $derived($page.props.user as User | undefined);
  let userRoles = $derived(user?.roles || []);
  let userPermissions = $derived(user?.permissions || []);
  let isAdmin = $derived(userRoles.includes('admin'));

  // Admin bypasses all checks (consistent with backend requirePermission)
  let hasAccess = $derived(
    isAdmin
      ? true
      : permission
        ? userPermissions.includes(permission)
        : role
          ? userRoles.includes(role)
          : false
  );
</script>

{#if hasAccess}
  {@render children()}
{/if}
