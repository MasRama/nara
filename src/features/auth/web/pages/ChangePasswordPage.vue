<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { changePasswordInputSchema } from '../../contract';
import { createAuthClient } from '../client';
import { useAuthSession } from '../session';

type FieldErrors = Record<string, string[]>;

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const isSubmitting = ref(false);
const formError = ref('');
const fieldErrors = ref<FieldErrors>({});

const authClient = createAuthClient();
const authSession = useAuthSession();
const router = useRouter();

function mapIssues(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): FieldErrors {
  const mapped: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_root';
    mapped[key] ??= [];
    mapped[key].push(issue.message);
  }
  return mapped;
}

async function submit(): Promise<void> {
  if (isSubmitting.value) return;
  formError.value = '';
  fieldErrors.value = {};

  const parsed = changePasswordInputSchema.safeParse({
    current_password: currentPassword.value,
    new_password: newPassword.value,
  });
  if (!parsed.success) {
    fieldErrors.value = mapIssues(parsed.error.issues);
    formError.value = 'Please correct the highlighted fields.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    fieldErrors.value.confirmPassword = ['Passwords do not match'];
    formError.value = 'Please correct the highlighted fields.';
    return;
  }

  isSubmitting.value = true;
  try {
    const response = await authClient.changePassword(parsed.data);
    if (!response.success) {
      fieldErrors.value = response.errors ?? {};
      formError.value = response.message;
      return;
    }
    await authSession.refresh();
    await router.replace({ name: 'dashboard' });
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Unable to change your password';
  } finally {
    isSubmitting.value = false;
  }
}

async function logout(): Promise<void> {
  await authSession.logout();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <main class="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-12 text-foreground">
    <section class="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-soft">
      <p class="font-heading text-xs uppercase tracking-[0.25em] text-primary">Security</p>
      <h1 class="mt-3 font-heading text-3xl font-semibold tracking-tight">Change your password</h1>
      <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
        This account is using a temporary password. Choose a new password before continuing.
      </p>

      <form class="mt-8 space-y-5" @submit.prevent="submit">
        <label class="block text-sm font-medium" for="current-password">
          Current password
          <span class="relative mt-2 block">
            <input
              id="current-password"
              v-model="currentPassword"
              :type="showCurrentPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              :aria-invalid="Boolean(fieldErrors.current_password)"
              class="block w-full rounded-md border border-input bg-background px-3 py-2.5 pr-20 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button type="button" class="absolute inset-y-0 right-0 px-3 text-xs text-muted-foreground hover:text-foreground" @click="showCurrentPassword = !showCurrentPassword">
              {{ showCurrentPassword ? 'Hide' : 'Show' }}
            </button>
          </span>
          <span v-if="fieldErrors.current_password" class="mt-1 block text-xs text-destructive">{{ fieldErrors.current_password[0] }}</span>
        </label>

        <label class="block text-sm font-medium" for="new-password">
          New password
          <span class="relative mt-2 block">
            <input
              id="new-password"
              v-model="newPassword"
              :type="showNewPassword ? 'text' : 'password'"
              autocomplete="new-password"
              required
              :aria-invalid="Boolean(fieldErrors.new_password)"
              class="block w-full rounded-md border border-input bg-background px-3 py-2.5 pr-20 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button type="button" class="absolute inset-y-0 right-0 px-3 text-xs text-muted-foreground hover:text-foreground" @click="showNewPassword = !showNewPassword">
              {{ showNewPassword ? 'Hide' : 'Show' }}
            </button>
          </span>
          <span v-if="fieldErrors.new_password" class="mt-1 block text-xs text-destructive">{{ fieldErrors.new_password[0] }}</span>
        </label>

        <label class="block text-sm font-medium" for="confirm-password">
          Confirm new password
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            required
            :aria-invalid="Boolean(fieldErrors.confirmPassword)"
            class="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span v-if="fieldErrors.confirmPassword" class="mt-1 block text-xs text-destructive">{{ fieldErrors.confirmPassword[0] }}</span>
        </label>

        <p v-if="formError" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{{ formError }}</p>

        <button type="submit" :disabled="isSubmitting" class="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 font-heading text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
          {{ isSubmitting ? 'Updating password…' : 'Update password' }}
        </button>
        <button type="button" class="inline-flex w-full items-center justify-center rounded-md border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground" @click="logout">
          Sign out instead
        </button>
      </form>
    </section>
  </main>
</template>
