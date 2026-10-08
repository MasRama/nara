import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Runtime = typeof import('../index');

const en = {
  greeting: 'Hello {name}',
  items: { one: '{count} item', other: '{count} items' },
  'field.password': 'Password',
  'errors.INVALID_PASSWORD': 'That password is not right.',
} as const;
const id = {
  greeting: 'Halo {name}',
  items: { one: '{count} barang', other: '{count} barang' },
  'field.password': 'Kata sandi',
  'errors.INVALID_PASSWORD': 'Kata sandi salah.',
};

async function freshRuntime(): Promise<Runtime> {
  vi.resetModules();
  return import('../index');
}

describe('translation runtime', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fills placeholders and picks plural forms in English', async () => {
    const { defineMessages } = await freshRuntime();
    const { t } = defineMessages(en, { id: async () => ({ default: id }) });
    expect(t('greeting', { name: 'Ren' })).toBe('Hello Ren');
    expect(t('items', { count: 1 })).toBe('1 item');
    expect(t('items', { count: 3 })).toBe('3 items');
  });

  it('loads every dictionary before switching, then remembers the choice', async () => {
    const { defineMessages, locale, setLocale } = await freshRuntime();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { t } = defineMessages(en, { id: async () => (await gate, { default: id }) });

    const switching = setLocale('id');
    await Promise.resolve();
    expect(locale.value).toBe('en');
    expect(t('greeting', { name: 'Ren' })).toBe('Hello Ren');

    release();
    await switching;
    expect(locale.value).toBe('id');
    expect(t('greeting', { name: 'Ren' })).toBe('Halo Ren');
    expect(document.documentElement.lang).toBe('id');
    expect(localStorage.getItem('nara-locale')).toBe('id');

    const reloaded = await freshRuntime();
    expect(reloaded.locale.value).toBe('id');
  });

  it('starts in the browser language when it is supported', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['id-ID', 'en']);
    expect((await freshRuntime()).locale.value).toBe('id');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
    expect((await freshRuntime()).locale.value).toBe('en');
  });

  it('shows API refusals as sent in English, translates them by code otherwise, and keeps unknown codes as sent', async () => {
    const { defineMessages, setLocale } = await freshRuntime();
    const { error } = defineMessages(en, { id: async () => ({ default: id }) });
    expect(error({ code: 'INVALID_PASSWORD', message: 'Invalid password' })).toBe('Invalid password');
    await setLocale('id');
    expect(error({ code: 'INVALID_PASSWORD', message: 'Invalid password' })).toBe('Kata sandi salah.');
    expect(error({ code: 'SOMETHING_NEW', message: 'Server said so' })).toBe('Server said so');
    expect(error({ message: 'No code at all' })).toBe('No code at all');
  });

  it('keeps contract validation messages in English and describes them by code otherwise', async () => {
    const { defineMessages, setLocale } = await freshRuntime();
    const { issue } = defineMessages(en, { id: async () => ({ default: id }) });
    const tooShort = {
      code: 'too_small',
      origin: 'string',
      minimum: 8,
      path: ['password'],
      message: 'Password must be at least 8 characters',
    };
    expect(issue(tooShort)).toBe('Password must be at least 8 characters');

    await setLocale('id');
    expect(issue(tooShort)).toBe('Kata sandi minimal 8 karakter');
    expect(issue({ ...tooShort, minimum: 1 })).toBe('Kata sandi wajib diisi');
    expect(issue({ code: 'invalid_format', format: 'email', path: ['email'], message: 'Invalid email' })).toBe(
      'email harus berupa alamat email yang valid',
    );
  });

  it('formats dates in the current locale', async () => {
    const { formatDate, setLocale } = await freshRuntime();
    const day = new Date(2026, 0, 5);
    expect(formatDate(day, { month: 'long' })).toBe('January');
    await setLocale('id');
    expect(formatDate(day, { month: 'long' })).toBe('Januari');
  });
});
