import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ————————————————————————————————————————————————
   Ornements — the reusable geometric vocabulary of the
   storefront. Everything is CSS or inline SVG, never a
   decorative bitmap.
   ———————————————————————————————————————————————— */

export function ZelligeStar({
  className,
  strokeWidth = 1.1,
  style,
}: {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn('h-4 w-4', className)}
      style={style}
    >
      <path
        d="M24 2.5 28.6 12.2 38.7 7.6 34.1 17.7 43.8 22.3 34.1 26.9 38.7 37 28.6 32.4 24 42.1 19.4 32.4 9.3 37 13.9 26.9 4.2 22.3 13.9 17.7 9.3 7.6 19.4 12.2Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path
        d="M24 13.4 33.5 22.3 24 31.2 14.5 22.3Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        opacity=".55"
      />
      <circle cx="24" cy="22.3" r="1.3" fill="currentColor" opacity=".8" />
    </svg>
  );
}

export function ZelligeDiamond({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={cn('h-1.5 w-1.5', className)}>
      <path d="M6 0 12 6 6 12 0 6Z" fill="currentColor" />
    </svg>
  );
}

export function ZelligeField({
  className,
  opacity = 0.07,
  size = 'normal',
}: {
  className?: string;
  opacity?: number;
  size?: 'normal' | 'sm';
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 zellige-mask',
        size === 'sm' && 'zellige-mask-sm',
        className,
      )}
      style={{ opacity }}
    />
  );
}

export function ZelligeBand({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('relative h-2.5 w-full overflow-hidden', className)}>
      <div className="zellige-mask zellige-mask-sm absolute inset-0" />
    </div>
  );
}

export function ZelligeDivider({
  className,
  tone = 'brass',
}: {
  className?: string;
  tone?: 'brass' | 'sea' | 'ivory';
}) {
  const color =
    tone === 'ivory' ? 'text-ivory/35' : tone === 'sea' ? 'text-sea/25' : 'text-brass/70';
  return (
    <div className={cn('flex items-center gap-3', color, className)} aria-hidden="true">
      <span className="h-px flex-1 bg-current opacity-45" />
      <ZelligeDiamond className="h-1 w-1 opacity-80" />
      <ZelligeStar className="h-3.5 w-3.5" strokeWidth={1} />
      <ZelligeDiamond className="h-1 w-1 opacity-80" />
      <span className="h-px flex-1 bg-current opacity-45" />
    </div>
  );
}

/**
 * A Moorish arch mask. `id` must be unique on the page.
 * The frame is rendered as an outer brass hairline and an inner clipped panel.
 */
export function ArchFrame({
  id,
  children,
  className,
  frameClassName,
  padding = 'p-[6px]',
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  frameClassName?: string;
  padding?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={id} clipPathUnits="objectBoundingBox">
            <path d="M0,1 L0,0.48 C0,0.28 0.13,0.14 0.32,0.07 C0.4,0.04 0.46,0.02 0.5,0 C0.54,0.02 0.6,0.04 0.68,0.07 C0.87,0.14 1,0.28 1,0.48 L1,1 Z" />
          </clipPath>
        </defs>
      </svg>
      <div
        className={cn(
          'relative h-full w-full overflow-hidden bg-brass/55',
          padding,
          frameClassName,
        )}
        style={{ clipPath: `url(#${id})` }}
      >
        <div
          className="relative h-full w-full overflow-hidden bg-sea"
          style={{ clipPath: `url(#${id})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  arabic,
  description,
  href,
  action = 'Découvrir',
  tone = 'light',
  align = 'left',
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  arabic?: string;
  description?: string;
  href?: string;
  action?: string;
  tone?: 'light' | 'dark';
  align?: 'left' | 'center';
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <div
      className={cn(
        'flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center sm:text-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        <div
          className={cn(
            'flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-label',
            dark ? 'text-brass-light' : 'text-clay',
            align === 'center' && 'justify-center',
          )}
        >
          <ZelligeStar className="h-3 w-3" />
          <span>{eyebrow}</span>
          {arabic && (
            <span
              className={cn(
                'font-arabic text-[13px] normal-case tracking-normal',
                dark ? 'text-ivory/55' : 'text-muted',
              )}
              dir="rtl"
            >
              {arabic}
            </span>
          )}
        </div>
        <h2
          className={cn(
            'mt-3 text-[2rem] leading-[1.08] tracking-[-0.02em] sm:text-[2.65rem] lg:text-[3rem]',
            dark ? 'text-ivory' : 'text-ink',
          )}
        >
          {title}
        </h2>
        {description && (
          <p
            className={cn(
              'mt-3 max-w-xl text-[13.5px] leading-relaxed',
              dark ? 'text-ivory/62' : 'text-muted',
              align === 'center' && 'mx-auto',
            )}
          >
            {description}
          </p>
        )}
      </div>

      {href && (
        <Link
          href={href}
          className={cn(
            'group inline-flex shrink-0 items-center gap-2 border-b pb-1 text-[11px] font-semibold uppercase tracking-label transition-colors',
            dark
              ? 'border-ivory/25 text-ivory hover:border-brass-light hover:text-brass-light'
              : 'border-ink/20 text-ink hover:border-clay hover:text-clay',
          )}
        >
          {action}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
