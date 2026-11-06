import type { Locale } from './config';
import en from './locales/en.json';
import ar from './locales/ar.json';

/**
 * Keys are the French source strings. Add translations for every user-facing
 * string here; anything missing falls back to French.
 */
export const messages: Record<Locale, Record<string, string>> = {
  fr: {},
  en: en as Record<string, string>,
  ar: ar as Record<string, string>,
};
