import { defineMessages } from '../../../../shared/i18n';
import en from './en';

export const { t, find, issue, error } = defineMessages(en, { id: () => import('./id') });
