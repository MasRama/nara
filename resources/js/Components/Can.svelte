<script lang="ts">
  import { page } from '@inertiajs/svelte';

  // Props
  export let permission: string = '';
  export let role: string = '';

  // Get user from page props
  $: user = $page.props.user as { roles?: string[]; permissions?: string[] } | null | undefined;
  $: userRoles = user?.roles || [];
  $: userPermissions = user?.permissions || [];

  // Check access
  $: hasAccess = permission
    ? userPermissions.includes(permission)
    : role
      ? userRoles.includes(role)
      : false;
</script>

{#if hasAccess}
  <slot />
{/if}
