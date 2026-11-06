import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Work } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value?: number | null, locale?: string) {
  if (value === undefined || value === null) return '—';
  if (locale === 'ar') {
    return `${Math.round(value).toLocaleString('ar-DZ')} د.ج`;
  }
  return `${Math.round(value).toLocaleString('fr-DZ')} DA`;
}

export function formatNumber(value: number, locale?: string) {
  if (locale === 'ar') {
    return value.toLocaleString('ar-DZ');
  }
  return value.toLocaleString('fr-DZ');
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function authorNames(
  work: Work,
  localeOrT?: string | ((key: string) => string),
  tFunc?: (key: string) => string,
) {
  const locale = typeof localeOrT === 'string' ? localeOrT : undefined;
  const t = typeof localeOrT === 'function' ? localeOrT : tFunc;
  const fallback = t
    ? t('Auteur inconnu')
    : locale === 'ar'
      ? 'مؤلف غير معروف'
      : locale === 'en'
        ? 'Unknown author'
        : 'Auteur inconnu';

  if (!work.authors || work.authors.length === 0) return fallback;
  return (
    work.authors
      .map((author) => (locale === 'ar' && author.name_ar ? author.name_ar : author.name))
      .join(', ') || fallback
  );
}

export function getLocalizedCategory(
  category?: { name_fr?: string; name_ar?: string; name_en?: string } | null,
  locale?: string,
): string {
  if (!category) return '';
  if (locale === 'ar') {
    return category.name_ar || category.name_fr || '';
  }
  if (locale === 'en') {
    return category.name_en || category.name_fr || '';
  }
  return category.name_fr || category.name_en || category.name_ar || '';
}

export function getLocalizedWilaya(
  wilaya?: {
    id?: number;
    code?: string;
    name_fr?: string;
    name_ar?: string;
    name_en?: string;
    wilaya_name_fr?: string;
    wilaya_name_ar?: string;
    wilaya_name_en?: string;
    seller_wilaya_name?: string;
    seller_wilaya_name_ar?: string;
    seller_wilaya_name_en?: string;
  } | null,
  locale?: string,
): string {
  if (!wilaya) return '';
  const fr = wilaya.name_fr || wilaya.wilaya_name_fr || wilaya.seller_wilaya_name || '';
  const ar = wilaya.name_ar || wilaya.wilaya_name_ar || wilaya.seller_wilaya_name_ar || '';
  const en =
    wilaya.name_en ||
    wilaya.wilaya_name_en ||
    wilaya.seller_wilaya_name_en ||
    (wilaya.code === '16' ? 'Algiers' : fr);

  if (locale === 'ar') return ar || fr;
  if (locale === 'en') return en || fr;
  return fr || en || ar;
}

/**
 * The API can contain two work records for the same title (one imported from
 * a bookstore feed, one canonical). Keep the richest record for display.
 */
export function dedupeWorks(works: Work[]) {
  const seen = new Map<string, Work>();
  for (const work of works) {
    const key = `${work.title.toLowerCase().trim()}::${work.authors?.[0]?.id ?? 'x'}`;
    const current = seen.get(key);
    if (!current) {
      seen.set(key, work);
      continue;
    }
    const score = (w: Work) =>
      (w.cover_image ? 4 : 0) +
      (w.synopsis?.length ?? 0) / 500 +
      (w.offers_count ?? 0) +
      (w.categories?.length ?? 0);
    if (score(work) > score(current)) seen.set(key, work);
  }
  return Array.from(seen.values());
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count > 1 ? plural : singular;
}

export const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Neuf',
  LIKE_NEW: 'Comme neuf',
  VERY_GOOD: 'Très bon état',
  GOOD: 'Bon état',
  ACCEPTABLE: 'État acceptable',
};

export function normalizeCondition(condition: string) {
  return CONDITION_LABELS[condition] ?? condition;
}

export function getLocalizedCondition(
  condition?: string | null,
  locale?: string,
  t?: (key: string) => string,
): string {
  if (!condition) return '';
  const code = condition.toUpperCase();
  const fr = CONDITION_LABELS[code] || condition;
  if (t) return t(fr);
  if (locale === 'ar') {
    switch (code) {
      case 'NEW':
        return 'جديد';
      case 'LIKE_NEW':
        return 'شبه جديد';
      case 'VERY_GOOD':
        return 'حالة جيدة جداً';
      case 'GOOD':
        return 'حالة جيدة';
      case 'ACCEPTABLE':
        return 'حالة مقبولة';
      default:
        return fr;
    }
  }
  if (locale === 'en') {
    switch (code) {
      case 'NEW':
        return 'Brand New';
      case 'LIKE_NEW':
        return 'Like New';
      case 'VERY_GOOD':
        return 'Very Good';
      case 'GOOD':
        return 'Good';
      case 'ACCEPTABLE':
        return 'Acceptable';
      default:
        return fr;
    }
  }
  return fr;
}

export function getLocalizedFormat(
  format?: string | null,
  locale?: string,
  t?: (key: string) => string,
): string {
  if (!format) return '';
  if (t) return t(format);
  if (locale === 'ar') {
    switch (format.toLowerCase()) {
      case 'poche':
        return 'كتاب جيب';
      case 'broché':
      case 'broche':
        return 'غلاف ورقي';
      case 'grand format':
        return 'حجم كبير';
      case 'relié':
      case 'relie':
        return 'مجلد كلاسيكي';
      default:
        return format;
    }
  }
  if (locale === 'en') {
    switch (format.toLowerCase()) {
      case 'poche':
        return 'Pocket';
      case 'broché':
      case 'broche':
        return 'Paperback';
      case 'grand format':
        return 'Trade Paperback';
      case 'relié':
      case 'relie':
        return 'Hardcover';
      default:
        return format;
    }
  }
  return format;
}

export function conditionTone(condition: string) {
  switch (condition) {
    case 'NEW':
      return 'bg-emerald-dz/10 text-emerald-deep border-emerald-dz/20';
    case 'LIKE_NEW':
      return 'bg-sea/8 text-sea border-sea/15';
    case 'VERY_GOOD':
      return 'bg-brass/10 text-[#7a5a24] border-brass/25';
    case 'GOOD':
      return 'bg-sand/40 text-[#6a552e] border-sand-deep/40';
    default:
      return 'bg-ivory-deep text-muted border-line';
  }
}

export function monthYear(date?: string) {
  if (!date) return '';
  return new Intl.DateTimeFormat('fr-DZ', { month: 'long', year: 'numeric' }).format(new Date(date));
}
