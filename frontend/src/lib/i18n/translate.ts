import type { Locale } from './config';
import { messages } from './messages';

export type TranslationValues = Record<string, string | number>;

export type Translate = (key: string, values?: TranslationValues) => string;

/**
 * Translations are keyed by their French source text. This keeps the French
 * copy as the single source of truth and lets untranslated strings fall back
 * gracefully instead of showing a raw key.
 */
export function translate(locale: Locale, key: string, values?: TranslationValues): string {
  const template = messages[locale]?.[key] ?? messages.fr[key] ?? key;

  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

export function translateCount(
  locale: Locale,
  count: number,
  singularKey: string,
  pluralKey: string,
  values?: TranslationValues,
): string {
  return translate(locale, count === 1 ? singularKey : pluralKey, { count, ...values });
}
