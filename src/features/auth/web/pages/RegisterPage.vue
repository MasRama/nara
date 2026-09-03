<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { registerInputSchema, type RegisterInput } from '../../contract';
import { createAuthClient } from '../client';
import { useAuthSession } from '../session';

const name = ref('');
const email = ref('');
const password = ref('');
const passwordConfirmation = ref('');
const isSubmitting = ref(false);
const formError = ref('');
const fieldErrors = ref<Record<string, string[]>>({});

const authClient = createAuthClient();
const authSession = useAuthSession();
const route = useRoute();
const router = useRouter();

function mapIssues(issues: Array<{ path: PropertyKey[]; message: string }>): Record<string, string[]> {
  const mapped: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_root';
    mapped[key] ??= [];
    mapped[key].push(issue.message);
  }
  return mapped;
}

function redirectTarget(): string {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  return '/dashboard';
}

function validate(): RegisterInput | undefined {
  const parsed = registerInputSchema.safeParse({
    name: name.value,
    email: email.value,
    password: password.value,
  });
  const nextErrors = parsed.success ? {} : mapIssues(parsed.error.issues);

  if (password.value !== passwordConfirmation.value) {
    nextErrors.password_confirmation = ['Passwords do not match'];
  }

  fieldErrors.value = nextErrors;
  if (Object.keys(nextErrors).length > 0 || !parsed.success) {
    formError.value = 'Please correct the highlighted fields.';
    return undefined;
  }

  return parsed.data;
}

async function submitRegistration(): Promise<void> {
  if (isSubmitting.value) return;

  formError.value = '';
  fieldErrors.value = {};
  const input = validate();
  if (!input) return;

  isSubmitting.value = true;
  try {
    const response = await authClient.register(input);
    if (!response.success) {
      formError.value = response.message;
      fieldErrors.value = response.errors ?? {};
      return;
    }

    if (response.data?.user) {
      authSession.setAuthenticated(response.data.user);
    } else if (!(await authSession.refresh())) {
      formError.value = 'Registration succeeded, but the session could not be loaded.';
      return;
    }

    await router.replace(redirectTarget());
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Unable to create account';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-12 text-foreground">
    <section class="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-soft">
      <div class="mb-8">
        <RouterLink to="/" class="font-heading text-lg font-semibold tracking-tight">Nara</RouterLink>
        <h1 class="mt-8 font-heading text-3xl font-semibold tracking-tight">Create your account</h1>
        <p class="mt-2 text-sm leading-relaxed text-muted-foreground">Start building your workspace with Nara.</p>
      </div>

      <form class="space-y-5" @submit.prevent="submitRegistration">
        <label class="block text-sm font-medium" for="name">
          Name
          <input
            id="name"
            v-model="name"
            type="text"
            name="name"
            autocomplete="name"
            required
            :aria-invalid="Boolean(fieldErrors.name)"
            class="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span v-if="fieldErrors.name" class="mt-1 block text-xs text-destructive">{{ fieldErrors.name[0] }}</span>
        </label>

        <label class="block text-sm font-medium" for="email">
          Email
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            required
            :aria-invalid="Boolean(fieldErrors.email)"
            class="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span v-if="fieldErrors.email" class="mt-1 block text-xs text-destructive">{{ fieldErrors.email[0] }}</span>
        </label>

        <label class="block text-sm font-medium" for="password">
          Password
          <input
            id="password"
            v-model="password"
            type="password"
            name="password"
            autocomplete="new-password"
            required
            :aria-invalid="Boolean(fieldErrors.password)"
            class="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span v-if="fieldErrors.password" class="mt-1 block text-xs text-destructive">{{ fieldErrors.password[0] }}</span>
        </label>

        <label class="block text-sm font-medium" for="password-confirmation">
          Confirm password
          <input
            id="password-confirmation"
            v-model="passwordConfirmation"
            type="password"
            name="password_confirmation"
            autocomplete="new-password"
            required
            :aria-invalid="Boolean(fieldErrors.password_confirmation)"
            class="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span v-if="fieldErrors.password_confirmation" class="mt-1 block text-xs text-destructive">{{ fieldErrors.password_confirmation[0] }}</span>
        </label>

        <p v-if="formError" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {{ formError }}
        </p>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 font-heading text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ isSubmitting ? 'Creating account…' : 'Create account' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?
        <RouterLink to="/login" class="text-primary transition-opacity hover:opacity-80">Sign in</RouterLink>
      </p>
    </section>
  </main>
</template>
