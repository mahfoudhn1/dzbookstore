'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Store } from 'lucide-react';
import type { Work } from '@/lib/types';
import { authorNames, cn, formatPrice, getLocalizedCategory, pluralize } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { BookCover } from './BookCover';
import { ZelligeField } from '@/components/ui/Ornaments';

export function BookCard({
  work,
  className,
  compact = false,
  eager = false,
}: {
  work: Work;
  className?: string;
  compact?: boolean;
  eager?: boolean;
}) {
  const { t, locale } = useI18n();
  const author = authorNames(work, locale, t);
  const category = work.categories?.[0];
  const offerCount = work.offers_count ?? 0;

  return (
    <article className={cn('group flex flex-col', className)}>
      <Link
        href={`/books/${work.slug}`}
        className={cn(
          'relative block overflow-hidden border border-line/80 bg-ivory-deep/45 transition-colors duration-300 group-hover:border-sea/25',
          compact ? 'p-3' : 'p-4 sm:p-5',
        )}
      >
        <ZelligeField className="text-sea" opacity={0.045} />
        <BookCover
          src={work.cover_image}
          title={work.title}
          author={author}
          arabicTitle={work.original_title}
          eager={eager}
          className={cn(
            'transition-transform duration-500 ease-out group-hover:-translate-y-1.5',
            compact ? 'mx-auto w-[82%]' : 'mx-auto w-[86%]',
          )}
        />
        {offerCount > 0 && (
          <span className="absolute right-3 top-3 z-10 border border-ivory/20 bg-sea/90 px-2 py-1 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-ivory backdrop-blur-sm">
            {offerCount} {t(pluralize(offerCount, 'offre'))}
          </span>
        )}
        <span className="absolute bottom-3 right-3 z-10 flex h-7 w-7 translate-y-1 items-center justify-center bg-ivory text-sea opacity-0 shadow-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </Link>

      <div className="flex flex-1 flex-col px-0.5 pt-4">
        {category && (
          <p className="text-[8.5px] font-semibold uppercase tracking-label text-clay">
            {getLocalizedCategory(category, locale)}
          </p>
        )}
        <Link href={`/books/${work.slug}`} className="mt-1.5">
          <h3 className="font-display text-[1.15rem] leading-[1.12] tracking-[-0.015em] text-ink transition-colors group-hover:text-sea sm:text-[1.3rem]">
            {work.title}
          </h3>
        </Link>
        <p className="mt-1 truncate text-[11.5px] text-muted">{author}</p>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line/70 pt-3.5">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-label text-muted/75">{t("À partir de")}</p>
            <p className="mt-0.5 font-sans text-sm font-bold tracking-tight text-sea">
              {work.min_price ? formatPrice(work.min_price, locale) : t('Sur demande')}
            </p>
          </div>
          {(work.bookstores_count ?? 0) > 0 && (
            <span className="mb-0.5 inline-flex items-center gap-1 text-[9.5px] font-medium text-muted">
              <Store className="h-3 w-3 text-brass" />
              {work.bookstores_count} {t(pluralize(work.bookstores_count ?? 0, 'librairie'))}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
