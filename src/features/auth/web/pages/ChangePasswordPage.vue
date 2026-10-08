<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { changePasswordInputSchema } from '../../contract';
import { createAuthClient } from '../client';
import { useAuthSession } from '../session';
import AuthPageFrame from '../components/AuthPageFrame.vue';
import { useLocalFieldErrors, useLocalText, type LocalFieldErrors, type ValidationIssue } from '../../../../shared/i18n';
import { error as errorText, issue as issueText, t } from '../locales';

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
const isSubmitting = ref(false);
const formError = useLocalText();
const fieldErrors = useLocalFieldErrors();

const authClient = createAuthClient();
const authSession = useAuthSession();
const router = useRouter();

function mapIssues(issues: ReadonlyArray<ValidationIssue>): LocalFieldErrors {
  const mapped: LocalFieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_root';
    mapped[key] ??= [];
    mapped[key].push(() => issueText(issue));
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
    formError.value = () => t('common.correctFields');
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    fieldErrors.value = { confirmPassword: [() => t('common.passwordsMismatch')] };
    formError.value = () => t('common.correctFields');
    return;
  }

  isSubmitting.value = true;
  try {
    const response = await authClient.changePassword(parsed.data);
    if (!response.success) {
      fieldErrors.value = response.errors ?? {};
      // This route's INVALID_PASSWORD names the current password, unlike Security's confirmation.
      formError.value = () => response.code === 'INVALID_PASSWORD' ? t('changePassword.invalidPassword') : errorText(response);
      return;
    }
    await authSession.refresh();
    await router.replace({ name: 'dashboard' });
  } catch (error) {
    console.error(error);
    formError.value = () => t('changePassword.failed');
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
  <AuthPageFrame :heading="t('changePassword.heading')" :highlight="t('changePassword.highlight')" :description="t('changePassword.description')" :locked="authSession.user.value?.mustChangePassword === true">
      <form class="nara-auth-form" @submit.prevent="submit">
        <label class="nara-auth-field" for="current-password">
          {{ t('changePassword.currentPassword') }}
          <span class="nara-auth-password-wrap">
            <input
              id="current-password"
              v-model="currentPassword"
              :type="showCurrentPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              :aria-invalid="Boolean(fieldErrors.current_password)"
              :aria-describedby="fieldErrors.current_password ? 'current-password-error' : undefined"
              class="nara-auth-input nara-auth-input-password"
            />
            <button type="button" class="nara-auth-show" :aria-label="showCurrentPassword ? t('changePassword.hideCurrent') : t('changePassword.showCurrent')" @click="showCurrentPassword = !showCurrentPassword">
              {{ showCurrentPassword ? t('common.hide') : t('common.show') }}
            </button>
          </span>
          <span v-if="fieldErrors.current_password" id="current-password-error" class="nara-auth-error">{{ fieldErrors.current_password[0] }}</span>
        </label>

        <label class="nara-auth-field" for="new-password">
          {{ t('changePassword.newPassword') }}
          <span class="nara-auth-password-wrap">
            <input
              id="new-password"
              v-model="newPassword"
              :type="showNewPassword ? 'text' : 'password'"
              autocomplete="new-password"
              required
              :aria-invalid="Boolean(fieldErrors.new_password)"
              :aria-describedby="fieldErrors.new_password ? 'new-password-error' : undefined"
              class="nara-auth-input nara-auth-input-password"
            />
            <button type="button" class="nara-auth-show" :aria-label="showNewPassword ? t('changePassword.hideNew') : t('changePassword.showNew')" @click="showNewPassword = !showNewPassword">
              {{ showNewPassword ? t('common.hide') : t('common.show') }}
            </button>
          </span>
          <span v-if="fieldErrors.new_password" id="new-password-error" class="nara-auth-error">{{ fieldErrors.new_password[0] }}</span>
        </label>

        <label class="nara-auth-field" for="confirm-password">
          {{ t('changePassword.confirmPassword') }}
          <span class="nara-auth-password-wrap">
            <input
              id="confirm-password"
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              autocomplete="new-password"
              required
              :aria-invalid="Boolean(fieldErrors.confirmPassword)"
              :aria-describedby="fieldErrors.confirmPassword ? 'confirm-password-error' : undefined"
              class="nara-auth-input nara-auth-input-password"
            />
            <button type="button" class="nara-auth-show" :aria-label="showConfirmPassword ? t('common.hideConfirmation') : t('common.showConfirmation')" @click="showConfirmPassword = !showConfirmPassword">
              {{ showConfirmPassword ? t('common.hide') : t('common.show') }}
            </button>
          </span>
          <span v-if="fieldErrors.confirmPassword" id="confirm-password-error" class="nara-auth-error">{{ fieldErrors.confirmPassword[0] }}</span>
        </label>

        <p v-if="formError" role="alert" class="nara-auth-alert">{{ formError }}</p>

        <button type="submit" :disabled="isSubmitting" class="nara-auth-submit">
          {{ isSubmitting ? t('changePassword.submitting') : t('changePassword.submit') }}<span v-if="!isSubmitting" class="nara-auth-submit-arrow" aria-hidden="true">→</span>
        </button>
        <button type="button" class="nara-auth-quiet-button" @click="logout">
          {{ t('changePassword.signOut') }}
        </button>
      </form>
  </AuthPageFrame>
</template>
