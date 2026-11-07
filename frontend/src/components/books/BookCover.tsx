'use client';

import React from 'react';
import { cn, getMediaUrl } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { ZelligeField, ZelligeStar } from '@/components/ui/Ornaments';

const PALETTES = [
  { bg: '#0e3444', text: '#f7f2e7', accent: '#c9a063', line: 'rgba(247,242,231,.30)', motif: 'star' },
  { bg: '#a94b2b', text: '#f7f2e7', accent: '#e3d3b8', line: 'rgba(247,242,231,.32)', motif: 'arch' },
  { bg: '#1f5745', text: '#f7f2e7', accent: '#c9a063', line: 'rgba(247,242,231,.28)', motif: 'diamond' },
  { bg: '#d9c5a4', text: '#0e3444', accent: '#93401f', line: 'rgba(14,52,68,.25)', motif: 'star' },
  { bg: '#1b2225', text: '#f7f2e7', accent: '#c9a063', line: 'rgba(247,242,231,.26)', motif: 'grid' },
  { bg: '#efe4d0', text: '#201e19', accent: '#b4512f', line: 'rgba(32,30,25,.22)', motif: 'arch' },
];

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function CoverMotif({
  kind,
  color,
  className,
}: {
  kind: string;
  color: string;
  className?: string;
}) {
  if (kind === 'arch') {
    return (
      <svg viewBox="0 0 100 130" fill="none" aria-hidden className={className}>
        <path
          d="M15 122V57c0-19 15.7-34 35-34s35 15 35 34v65"
          stroke={color}
          strokeWidth=".7"
        />
        <path d="M23 122V58c0-15 12-27 27-27s27 12 27 27v64" stroke={color} strokeWidth=".35" />
        <circle cx="50" cy="57" r="1.6" fill={color} />
      </svg>
    );
  }
  if (kind === 'diamond') {
    return (
      <svg viewBox="0 0 100 100" fill="none" aria-hidden className={className}>
        <path d="M50 5 95 50 50 95 5 50Z" stroke={color} strokeWidth=".6" />
        <path d="M50 18 82 50 50 82 18 50Z" stroke={color} strokeWidth=".35" />
        <path d="M50 31 69 50 50 69 31 50Z" stroke={color} strokeWidth=".3" />
      </svg>
    );
  }
  if (kind === 'grid') {
    return (
      <svg viewBox="0 0 100 100" fill="none" aria-hidden className={className}>
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <path
              key={`${row}-${col}`}
              d={`M${20 + col * 20} ${10 + row * 20} l7 7 -7 7 -7 -7Z`}
              stroke={color}
              strokeWidth=".35"
            />
          )),
        )}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden className={className}>
      <path
        d="M50 4 58 24 78 12 70 32 92 40 72 50 84 69 63 62 55 84 45 67 27 80 32 58 10 50 30 40 20 20 41 28Z"
        stroke={color}
        strokeWidth=".55"
      />
      <path d="M50 25 69 50 50 75 31 50Z" stroke={color} strokeWidth=".35" />
    </svg>
  );
}

/**
 * The seed catalogue uses landscape stock photography as cover placeholders.
 * For those records (and for records without an image) we draw an editorial
 * cover from the title, author and Arabic title. Real cover URLs are used as-is.
 */
export function EditorialCover({
  title,
  author,
  arabicTitle,
  seed,
  publisher,
  className,
}: {
  title: string;
  author?: string;
  arabicTitle?: string;
  seed?: string;
  publisher?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const palette = PALETTES[hash(seed || title) % PALETTES.length];
  const longTitle = title.length > 24;
  return (
    <div
      className={cn('relative h-full w-full overflow-hidden', className)}
      style={{ backgroundColor: palette.bg, color: palette.text, containerType: 'inline-size' }}
    >
      <div aria-hidden className="absolute inset-0 zellige-mask zellige-mask-sm" style={{ color: palette.text, opacity: 0.08 }} />
      <CoverMotif
        kind={palette.motif}
        color={palette.accent}
        className="absolute left-1/2 top-1/2 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 opacity-35"
      />
      <div
        className="absolute inset-[5.5%] border"
        style={{ borderColor: palette.line }}
        aria-hidden
      />
      <div className="relative flex h-full flex-col justify-between p-[9%]">
        <div className="flex items-start justify-between gap-2">
          <span
            className="font-kufi uppercase"
            style={{ fontSize: 'clamp(0.24rem, 2.9cqw, 0.55rem)', letterSpacing: '0.16em', opacity: 0.72 }}
          >
            {t("Bookstore.dz")}{' '}</span>
          <ZelligeStar
            className="shrink-0"
            style={{ width: '5.5cqw', height: '5.5cqw', color: palette.accent }}
          />
        </div>

        <div className="my-auto py-[7%] text-center">
          <span
            className="font-kufi uppercase"
            style={{ fontSize: 'clamp(0.2rem, 2.4cqw, 0.48rem)', letterSpacing: '0.22em', opacity: 0.62 }}
          >
            {t("Édition catalogue")}{' '}</span>
          <div className="mx-auto my-[7%] h-px w-[22%]" style={{ backgroundColor: palette.accent, opacity: 0.75 }} />
          {arabicTitle && (
            <p
              className="font-arabic"
              style={{ fontSize: 'clamp(0.42rem, 6.2cqw, 1.18rem)', lineHeight: 1.5, opacity: 0.82 }}
              dir="rtl"
            >
              {arabicTitle}
            </p>
          )}
          <h3
            className="font-display font-normal"
            style={{
              fontSize: longTitle ? 'clamp(0.48rem, 7.2cqw, 1.85rem)' : 'clamp(0.52rem, 8.6cqw, 2.25rem)',
              lineHeight: 1.02,
              letterSpacing: '-0.025em',
              marginTop: '5%',
            }}
          >
            {title}
          </h3>
        </div>

        <div>
          <div className="mx-auto mb-[6%] h-px w-[34%]" style={{ backgroundColor: palette.line }} />
          {author && (
            <p
              className="truncate text-center font-sans uppercase"
              style={{ fontSize: 'clamp(0.2rem, 2.8cqw, 0.52rem)', letterSpacing: '0.14em', opacity: 0.7 }}
            >
              {author}
            </p>
          )}
          {publisher && (
            <p
              className="mt-[3%] truncate text-center font-sans uppercase"
              style={{ fontSize: 'clamp(0.18rem, 2.2cqw, 0.42rem)', letterSpacing: '0.12em', opacity: 0.45 }}
            >
              {publisher}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function BookCover({
  src,
  title,
  author,
  arabicTitle,
  publisher,
  className,
  imgClassName,
  eager = false,
  photo,
}: {
  src?: string | null;
  title: string;
  author?: string;
  arabicTitle?: string;
  publisher?: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  photo?: boolean;
}) {
  const resolvedSrc = getMediaUrl(src);
  // Treat the seeded Unsplash placeholders as editorial placeholders, not covers.
  const usePhoto = photo ?? Boolean(resolvedSrc && !resolvedSrc.includes('images.unsplash.com'));

  return (
    <figure
      className={cn(
        'group/cover relative aspect-[2/2.95] overflow-hidden bg-sea-deep shadow-cover',
        className,
      )}
    >
      {usePhoto && resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={`Couverture de ${title}`}
          loading={eager ? 'eager' : 'lazy'}
          className={cn(
            'h-full w-full object-cover transition-transform duration-700 ease-out group-hover/cover:scale-[1.035]',
            imgClassName,
          )}
        />
      ) : (
        <EditorialCover
          title={title}
          author={author}
          arabicTitle={arabicTitle}
          publisher={publisher}
          seed={title}
          className="transition-transform duration-700 ease-out group-hover/cover:scale-[1.015]"
        />
      )}

      {/* The physical object: a shadowed spine, a warm edge, a registration line. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[7px] bg-gradient-to-r from-black/35 via-black/12 to-transparent"
      />
      <div className="pointer-events-none absolute inset-0 border border-black/15" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/15 to-transparent opacity-40" />
    </figure>
  );
}
