import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, localeDir, type Locale } from './config';
import { translate, type Translate } from './translate';

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getT(): Promise<{
  locale: Locale;
  dir: 'ltr' | 'rtl';
  t: Translate;
}> {
  const locale = await getLocale();
  return {
    locale,
    dir: localeDir(locale),
    t: (key, values) => translate(locale, key, values),
  };
}
