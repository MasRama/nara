<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { loginInputSchema, type LoginInput } from '../../contract';
import { createAuthClient } from '../client';
import { useAuthSession } from '../session';
import AuthPageFrame from '../components/AuthPageFrame.vue';

const email = ref('');
const password = ref('');
const showPassword = ref(false);
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

function validate(): LoginInput | undefined {
  const parsed = loginInputSchema.safeParse({
    email: email.value,
    password: password.value,
  });
  if (parsed.success) {
    fieldErrors.value = {};
    return parsed.data;
  }

  fieldErrors.value = mapIssues(parsed.error.issues);
  formError.value = 'Please correct the highlighted fields.';
  return undefined;
}

async function submitLogin(): Promise<void> {
  if (isSubmitting.value) return;

  formError.value = '';
  fieldErrors.value = {};
  const input = validate();
  if (!input) return;

  isSubmitting.value = true;
  try {
    const response = await authClient.login(input);
    if (!response.success) {
      formError.value = response.message;
      fieldErrors.value = response.errors ?? {};
      return;
    }

    if (!(await authSession.refresh())) {
      formError.value = 'Sign in succeeded, but the current session could not be loaded.';
      return;
    }

    await router.replace(redirectTarget());
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Unable to sign in';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <AuthPageFrame heading="Welcome" highlight="back.">
      <form class="nara-auth-form" @submit.prevent="submitLogin">
        <label class="nara-auth-field" for="email">
          Email
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            required
            :aria-invalid="Boolean(fieldErrors.email)"
            :aria-describedby="fieldErrors.email ? 'email-error' : undefined"
            placeholder="you@example.com"
            class="nara-auth-input"
          />
          <span v-if="fieldErrors.email" id="email-error" class="nara-auth-error">{{ fieldErrors.email[0] }}</span>
        </label>

        <label class="nara-auth-field" for="password">
          Password
          <span class="nara-auth-password-wrap">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              name="password"
              autocomplete="current-password"
              required
              :aria-invalid="Boolean(fieldErrors.password)"
              :aria-describedby="fieldErrors.password ? 'password-error' : undefined"
            class="nara-auth-input nara-auth-input-password"
            />
            <button
              type="button"
              class="nara-auth-show"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? 'Hide' : 'Show' }}
            </button>
          </span>
          <span v-if="fieldErrors.password" id="password-error" class="nara-auth-error">{{ fieldErrors.password[0] }}</span>
        </label>

        <p v-if="formError" role="alert" class="nara-auth-alert">
          {{ formError }}
        </p>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="nara-auth-submit"
        >
          {{ isSubmitting ? 'Signing in…' : 'Sign in' }}<span v-if="!isSubmitting" class="nara-auth-submit-arrow" aria-hidden="true">→</span>
        </button>
      </form>

      <p class="nara-auth-alt">
        New to Nara?
        <RouterLink :to="{ name: 'register', query: route.query.redirect ? { redirect: route.query.redirect } : {} }">Create an account <span aria-hidden="true">↗</span></RouterLink>
      </p>
  </AuthPageFrame>
</template>
