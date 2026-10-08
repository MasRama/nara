<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { registerInputSchema, type RegisterInput } from '../../contract';
import { createAuthClient } from '../client';
import { useAuthSession } from '../session';
import AuthPageFrame from '../components/AuthPageFrame.vue';
import { useLocalFieldErrors, useLocalText, type LocalFieldErrors, type ValidationIssue } from '../../../../shared/i18n';
import { error as errorText, issue as issueText, t } from '../locales';

const name = ref('');
const email = ref('');
const password = ref('');
const passwordConfirmation = ref('');
const showPassword = ref(false);
const showConfirmation = ref(false);
const isSubmitting = ref(false);
const formError = useLocalText();
const fieldErrors = useLocalFieldErrors();

const authClient = createAuthClient();
const authSession = useAuthSession();
const route = useRoute();
const router = useRouter();

function mapIssues(issues: ValidationIssue[]): LocalFieldErrors {
  const mapped: LocalFieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_root';
    mapped[key] ??= [];
    mapped[key].push(() => issueText(issue));
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
    nextErrors.password_confirmation = [() => t('common.passwordsMismatch')];
  }

  fieldErrors.value = nextErrors;
  if (Object.keys(nextErrors).length > 0 || !parsed.success) {
    formError.value = () => t('common.correctFields');
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
      formError.value = () => errorText(response);
      fieldErrors.value = response.errors ?? {};
      return;
    }

    if (response.data?.user) {
      authSession.setAuthenticated(response.data.user);
    } else if (!(await authSession.refresh())) {
      formError.value = () => t('register.sessionFailed');
      return;
    }

    await router.replace(redirectTarget());
  } catch (error) {
    console.error(error);
    formError.value = () => t('register.failed');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <AuthPageFrame :heading="t('register.heading')" :highlight="t('register.highlight')">
      <form class="nara-auth-form" @submit.prevent="submitRegistration">
        <label class="nara-auth-field" for="name">
          {{ t('register.name') }}
          <input
            id="name"
            v-model="name"
            type="text"
            name="name"
            autocomplete="name"
            required
            :aria-invalid="Boolean(fieldErrors.name)"
            :aria-describedby="fieldErrors.name ? 'name-error' : undefined"
            :placeholder="t('register.namePlaceholder')"
            class="nara-auth-input"
          />
          <span v-if="fieldErrors.name" id="name-error" class="nara-auth-error">{{ fieldErrors.name[0] }}</span>
        </label>

        <label class="nara-auth-field" for="email">
          {{ t('common.email') }}
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            required
            :aria-invalid="Boolean(fieldErrors.email)"
            :aria-describedby="fieldErrors.email ? 'email-error' : undefined"
            :placeholder="t('common.emailPlaceholder')"
            class="nara-auth-input"
          />
          <span v-if="fieldErrors.email" id="email-error" class="nara-auth-error">{{ fieldErrors.email[0] }}</span>
        </label>

        <label class="nara-auth-field" for="password">
          {{ t('common.password') }}
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
            <button type="button" class="nara-auth-show" :aria-label="showPassword ? t('common.hidePassword') : t('common.showPassword')" @click="showPassword = !showPassword">{{ showPassword ? t('common.hide') : t('common.show') }}</button>
          </span>
          <span v-if="fieldErrors.password" id="password-error" class="nara-auth-error">{{ fieldErrors.password[0] }}</span>
        </label>

        <label class="nara-auth-field" for="password-confirmation">
          {{ t('register.confirmPassword') }}
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
            <button type="button" class="nara-auth-show" :aria-label="showConfirmation ? t('common.hideConfirmation') : t('common.showConfirmation')" @click="showConfirmation = !showConfirmation">{{ showConfirmation ? t('common.hide') : t('common.show') }}</button>
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
          {{ isSubmitting ? t('register.submitting') : t('register.submit') }}<span v-if="!isSubmitting" class="nara-auth-submit-arrow" aria-hidden="true">→</span>
        </button>
      </form>

      <p class="nara-auth-alt">
        {{ t('register.haveAccount') }}
        <RouterLink :to="{ name: 'login', query: route.query.redirect ? { redirect: route.query.redirect } : {} }">{{ t('register.signIn') }} <span aria-hidden="true">↗</span></RouterLink>
      </p>
  </AuthPageFrame>
</template>
