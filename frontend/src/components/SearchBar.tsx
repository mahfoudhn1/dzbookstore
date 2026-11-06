'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, MapPin, Search, X } from 'lucide-react';
import { WILAYAS } from '@/lib/wilayas';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { cn, getLocalizedWilaya } from '@/lib/utils';

export function SearchBar({
  variant = 'large',
  defaultValue = '',
  defaultWilaya = '',
  className,
  suggestions,
}: {
  variant?: 'large' | 'compact';
  defaultValue?: string;
  defaultWilaya?: string;
  className?: string;
  suggestions?: { label: string; href: string }[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [term, setTerm] = useState(defaultValue);
  const [wilaya, setWilaya] = useState(defaultWilaya);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (term.trim()) params.set('q', term.trim());
    if (wilaya) params.set('wilaya_id', wilaya);
    router.push(`/recherche${params.toString() ? `?${params.toString()}` : ''}`);
  };

  if (variant === 'compact') {
    return (
      <form onSubmit={handleSubmit} className={cn('relative', className)} role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/70" />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t("Titre, auteur, ISBN…")}
          aria-label={t("Rechercher dans le catalogue")}
          className="h-9 w-full border border-line bg-parchment/70 pl-9 pr-9 text-[12px] text-ink placeholder:text-muted/65 transition-colors focus:border-sea/50 focus:bg-parchment focus:outline-none"
        />
        <button
          type="submit"
          aria-label={t("Lancer la recherche")}
          className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-sea transition-colors hover:text-clay"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </form>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <form
        onSubmit={handleSubmit}
        role="search"
        className="group relative border border-line-dark bg-parchment p-1.5 shadow-[0_18px_50px_-34px_rgba(14,52,68,0.5)] transition-shadow focus-within:shadow-[0_22px_60px_-32px_rgba(14,52,68,0.55)]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center">
          <div className="relative flex min-w-0 flex-1 items-center">
            <Search className="pointer-events-none absolute left-4 h-4 w-4 text-sea/70" />
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={t("Un titre, un auteur, un ISBN…")}
              aria-label={t("Rechercher un livre, un auteur ou un ISBN")}
              className="h-12 w-full bg-transparent pl-11 pr-9 text-[14px] text-ink placeholder:text-muted/65 focus:outline-none sm:h-14"
            />
            {term && (
              <button
                type="button"
                onClick={() => setTerm('')}
                aria-label={t("Effacer la recherche")}
                className="absolute right-2 flex h-7 w-7 items-center justify-center text-muted/70 hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="relative flex items-center border-t border-line/80 sm:border-l sm:border-t-0">
            <MapPin className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-clay" />
            <select
              value={wilaya}
              onChange={(event) => setWilaya(event.target.value)}
              aria-label={t("Filtrer par wilaya")}
              className="h-11 w-full cursor-pointer appearance-none bg-transparent pl-8 pr-7 text-[11.5px] font-medium text-ink-soft focus:outline-none sm:h-14 sm:w-[168px]"
            >
              <option value="">{t("Toute l'Algérie")}</option>
              {WILAYAS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {getLocalizedWilaya(item, locale)}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 text-[8px] text-muted">▾</span>
          </div>

          <button
            type="submit"
            className="group/button flex h-11 shrink-0 items-center justify-center gap-2 bg-sea px-5 text-[10px] font-semibold uppercase tracking-label text-ivory transition-colors hover:bg-sea-deep sm:m-0.5 sm:h-[52px] sm:px-7"
          >
            {t("Rechercher")}{' '}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/button:translate-x-0.5" />
          </button>
        </div>
      </form>

      {suggestions && suggestions.length > 0 && (
        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10.5px] text-muted">
          <span className="uppercase tracking-label text-muted/60">{t("Essayez")}</span>
          {suggestions.map((suggestion) => (
            <Link
              key={suggestion.href}
              href={suggestion.href}
              className="border-b border-transparent pb-0.5 transition-colors hover:border-clay/40 hover:text-clay"
            >
              {suggestion.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
