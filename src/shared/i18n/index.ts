import { computed, readonly, ref, shallowRef, type WritableComputedRef } from 'vue';

/**
 * Browser-safe, business-neutral translation runtime. Each Feature owns its
 * dictionaries (`web/locales/en.ts` is the source of truth, other locales
 * must match it key for key) and turns them into a translator with
 * `defineMessages`. English ships with the bundle; other locales load on
 * demand, and `setLocale` waits for every registered dictionary before
 * switching so the interface never shows a mix of languages.
 *
 * API messages stay English; the interface translates by error `code`.
 */
export const LOCALES = ['en', 'id'] as const;
export type Locale = (typeof LOCALES)[number];
type OtherLocale = Exclude<Locale, 'en'>;

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', id: 'Bahasa Indonesia' };

/** A message that changes with a `count` parameter, chosen with `Intl.PluralRules`. */
export interface PluralMessage {
  one: string;
  other: string;
}

export type Dictionary = Record<string, string | PluralMessage>;

/** Another locale's dictionary: the same keys and message forms as English. */
export type Translation<En extends Dictionary> = {
  [K in keyof En]: En[K] extends string ? string : PluralMessage;
};

type Placeholders<S> = S extends `${string}{${infer Name}}${infer Rest}` ? Name | Placeholders<Rest> : never;
type ParamsOf<V> = V extends string ? Placeholders<V> : V extends PluralMessage ? Placeholders<V['one'] | V['other']> | 'count' : never;
type Args<V> = [ParamsOf<V>] extends [never] ? [] : [params: Record<ParamsOf<V>, string | number>];

/** The parts of a Zod issue the interface needs to describe it. */
export interface ValidationIssue {
  code: string;
  path: PropertyKey[];
  message: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  origin?: string;
  format?: string;
}

export interface Translator<En extends Dictionary> {
  /** The message for `key` in the current locale, with `{name}` placeholders filled in. */
  t<K extends keyof En & string>(key: K, ...args: Args<En[K]>): string;
  /** The message for a key built at runtime (no placeholders), or `undefined` when the dictionary lacks it. */
  find(key: string): string | undefined;
  /**
   * A validation issue in the current locale. English keeps the contract's
   * own message; other locales describe the issue from its code and the
   * field label found at `field.<name>`.
   */
  issue(issue: ValidationIssue): string;
  /**
   * An API refusal in the current locale. English shows the API's own message;
   * other locales translate by `code` at `errors.<code>` and keep the API
   * message for codes the dictionary does not know.
   */
  error(response: { code?: string; message: string }): string;
}

const STORAGE_KEY = 'nara-locale';

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

function detectLocale(): Locale {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
  const preferred = globalThis.navigator?.languages ?? [];
  for (const language of preferred) {
    const base = language.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

const current = ref<Locale>(detectLocale());
/** Bumped when a dictionary finishes loading, so rendered messages update. */
const revision = ref(0);
const loaders = new Set<(locale: Locale) => Promise<void>>();

export const locale = readonly(current);

function applyDocumentLanguage(value: Locale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = value;
}

/** Loads every registered dictionary for `next`, then switches the interface to it. */
export async function setLocale(next: Locale): Promise<void> {
  await Promise.all([...loaders].map((load) => load(next)));
  current.value = next;
  applyDocumentLanguage(next);
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next);
  } catch {
    // The choice still applies for this page view.
  }
}

/** Call once before mounting: loads the detected locale's dictionaries. */
export function initializeLocale(): Promise<void> {
  return setLocale(current.value).catch((error: unknown) => {
    console.error(`Could not load the "${current.value}" dictionaries; showing English instead.`, error);
    return setLocale('en');
  });
}

function interpolate(template: string, params: Record<string, string | number> | undefined): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

const ISSUE_TEMPLATES: Record<OtherLocale, Record<string, string>> = {
  id: {
    required: '{field} wajib diisi',
    too_small_string: '{field} minimal {minimum} karakter',
    too_small_array: 'Pilih minimal {minimum} {field}',
    too_small: '{field} minimal {minimum}',
    too_big_string: '{field} maksimal {maximum} karakter',
    too_big_array: 'Pilih maksimal {maximum} {field}',
    too_big: '{field} maksimal {maximum}',
    invalid_format_email: '{field} harus berupa alamat email yang valid',
    invalid_format: 'Format {field} tidak valid',
    invalid: '{field} tidak valid',
  },
};

function issueTemplate(locale: OtherLocale, issue: ValidationIssue): string {
  const templates = ISSUE_TEMPLATES[locale];
  if (issue.code === 'invalid_type') return templates.required!;
  if (issue.code === 'too_small' && issue.origin === 'string' && Number(issue.minimum) === 1) return templates.required!;
  if (issue.code === 'too_small' || issue.code === 'too_big' || issue.code === 'invalid_format') {
    const detail = issue.code === 'invalid_format' ? issue.format : issue.origin;
    return templates[`${issue.code}_${detail}`] ?? templates[issue.code]!;
  }
  return templates.invalid!;
}

export function defineMessages<const En extends Dictionary>(
  en: En,
  others: { [L in OtherLocale]: () => Promise<{ default: Translation<En> }> },
): Translator<En> {
  const loaded: Partial<Record<Locale, Dictionary>> = { en };

  const load = async (target: Locale) => {
    if (loaded[target]) return;
    loaded[target] = (await others[target as OtherLocale]()).default as Dictionary;
    revision.value += 1;
  };
  loaders.add(load);
  // A Feature registered after start-up still catches up with the current locale.
  if (current.value !== 'en') {
    void load(current.value).catch((error: unknown) => {
      console.error(`Could not load the "${current.value}" dictionary; this part of the interface stays in English.`, error);
    });
  }

  const dictionary = (): Dictionary => {
    void revision.value;
    return loaded[current.value] ?? en;
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const message = dictionary()[key] ?? en[key] ?? key;
    if (typeof message === 'string') return interpolate(message, params);
    const form = new Intl.PluralRules(current.value).select(Number(params?.count ?? 0)) === 'one' ? 'one' : 'other';
    return interpolate(message[form], params);
  };

  return {
    t: t as Translator<En>['t'],
    find: (key) => (Object.hasOwn(en, key) ? t(key) : undefined),
    error(response) {
      const key = `errors.${response.code}`;
      if (current.value === 'en' || !response.code || !Object.hasOwn(en, key)) return response.message;
      return t(key);
    },
    issue(issue) {
      const active = current.value;
      if (active === 'en') return issue.message;
      const name = String(issue.path[0] ?? '');
      const labelKey = `field.${name}`;
      const field = Object.hasOwn(en, labelKey) ? t(labelKey) : name;
      return interpolate(issueTemplate(active, issue), {
        field,
        minimum: String(issue.minimum ?? ''),
        maximum: String(issue.maximum ?? ''),
      });
    },
  };
}

/** Text resolved when it renders, so a message left on screen follows a locale switch. */
export type LocalText = () => string;

/**
 * Holds a message that stays on screen, such as an error or a notice. Assign
 * `() => t(...)` (or '' to clear); reading `.value` gives the text in the
 * current locale. A plain string is a type error, so text cannot freeze in
 * the locale it was produced in.
 */
export function useLocalText(): WritableComputedRef<string, LocalText | ''> {
  const source = shallowRef<LocalText | ''>('');
  return computed({
    get: () => (source.value ? source.value() : ''),
    set: (next) => {
      source.value = next;
    },
  });
}

/** Field errors whose interface-made entries re-render in the current locale; API entries stay as sent. */
export type LocalFieldErrors = Record<string, (string | LocalText)[]>;

/** Like `useLocalText`, for per-field errors: reading `.value` gives plain strings in the current locale. */
export function useLocalFieldErrors(): WritableComputedRef<Record<string, string[]>, LocalFieldErrors> {
  const source = shallowRef<LocalFieldErrors>({});
  return computed({
    get: () =>
      Object.fromEntries(
        Object.entries(source.value).map(([field, messages]) => [
          field,
          messages.map((message) => (typeof message === 'string' ? message : message())),
        ]),
      ),
    set: (next) => {
      source.value = next;
    },
  });
}

/** Dates and numbers in the current locale. */
export function formatDate(value: number | Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(current.value, options).format(value);
}

export function formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat(current.value, { numeric: 'auto' }).format(value, unit);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(current.value, options).format(value);
}
