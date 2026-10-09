<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { registerInputSchema, type RegisterInput } from '../../contract';
import { createAuthClient } from '../client';
import { useAuthSession } from '../session';
import AuthPageFrame from '../components/AuthPageFrame.vue';

const name = ref('');
const email = ref('');
const password = ref('');
const passwordConfirmation = ref('');
const showPassword = ref(false);
const showConfirmation = ref(false);
const isSubmitting = ref(false);
const formError = ref('');
const fieldErrors = ref<Record<string, string[]>>({});

const authClient = createAuthClient();
const authSession = useAuthSession();
const route = useRoute();
const router = useRouter();

function mapIssues(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string[]> {
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
    console.error(error);
    formError.value = 'Unable to create account';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <AuthPageFrame heading="Create your" highlight="account.">
      <form class="nara-auth-form" @submit.prevent="submitRegistration">
        <label class="nara-auth-field" for="name">
          Name
          <input
            id="name"
            v-model="name"
            type="text"
            name="name"
            autocomplete="name"
            required
            :aria-invalid="Boolean(fieldErrors.name)"
            :aria-describedby="fieldErrors.name ? 'name-error' : undefined"
            placeholder="Your full name"
            class="nara-auth-input"
          />
          <span v-if="fieldErrors.name" id="name-error" class="nara-auth-error">{{ fieldErrors.name[0] }}</span>
        </label>

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
              autocomplete="new-password"
              required
              :aria-invalid="Boolean(fieldErrors.password)"
              :aria-describedby="fieldErrors.password ? 'password-error' : undefined"
              class="nara-auth-input nara-auth-input-password"
            />
            <button type="button" class="nara-auth-show" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword">{{ showPassword ? 'Hide' : 'Show' }}</button>
          </span>
          <span v-if="fieldErrors.password" id="password-error" class="nara-auth-error">{{ fieldErrors.password[0] }}</span>
        </label>

        <label class="nara-auth-field" for="password-confirmation">
          Confirm password
          <span class="nara-auth-password-wrap">
            <input
              id="password-confirmation"
              v-model="passwordConfirmation"
              :type="showConfirmation ? 'text' : 'password'"
              name="password_confirmation"
              autocomplete="new-password"
              required
              :aria-invalid="Boolean(fieldErrors.password_confirmation)"
              :aria-describedby="fieldErrors.password_confirmation ? 'password-confirmation-error' : undefined"
              class="nara-auth-input nara-auth-input-password"
            />
            <button type="button" class="nara-auth-show" :aria-label="showConfirmation ? 'Hide confirmation' : 'Show confirmation'" @click="showConfirmation = !showConfirmation">{{ showConfirmation ? 'Hide' : 'Show' }}</button>
          </span>
          <span v-if="fieldErrors.password_confirmation" id="password-confirmation-error" class="nara-auth-error">{{ fieldErrors.password_confirmation[0] }}</span>
        </label>

        <p v-if="formError" role="alert" class="nara-auth-alert">
          {{ formError }}
        </p>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="nara-auth-submit"
        >
          {{ isSubmitting ? 'Creating account…' : 'Create account' }}<span v-if="!isSubmitting" class="nara-auth-submit-arrow" aria-hidden="true">→</span>
        </button>
      </form>

      <p class="nara-auth-alt">
        Already have an account?
        <RouterLink :to="{ name: 'login', query: route.query.redirect ? { redirect: route.query.redirect } : {} }">Sign in <span aria-hidden="true">↗</span></RouterLink>
      </p>
  </AuthPageFrame>
</template>
