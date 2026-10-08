import { defineMessages } from '../../shared/i18n';
import en from './en';

export const { t, error } = defineMessages(en, { id: () => import('./id') });
