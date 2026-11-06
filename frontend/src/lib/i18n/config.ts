export const LOCALES = ['fr', 'ar', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

export const LOCALE_COOKIE = 'bookstoredz.locale';

export const LOCALE_META: Record<
  Locale,
  { label: string; short: string; dir: 'ltr' | 'rtl'; htmlLang: string }
> = {
  fr: { label: 'Français', short: 'FR', dir: 'ltr', htmlLang: 'fr' },
  ar: { label: 'العربية', short: 'AR', dir: 'rtl', htmlLang: 'ar' },
  en: { label: 'English', short: 'EN', dir: 'ltr', htmlLang: 'en' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function localeDir(locale: Locale): 'ltr' | 'rtl' {
  return LOCALE_META[locale].dir;
}
