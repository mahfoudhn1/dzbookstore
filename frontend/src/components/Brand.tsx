import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 44"
      role="img"
      aria-label="Bookstore.dz"
      className={cn('h-10 w-10', className)}
    >
      <rect x="1" y="1" width="42" height="42" fill="currentColor" opacity=".06" />
      <rect x="1" y="1" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="1" opacity=".45" />
      {/* Moorish arch */}
      <path
        d="M12 34V21c0-6.4 4.6-11 10-11s10 4.6 10 11v13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Open book */}
      <path
        d="M16.5 25.5c2.2-1.4 4.1-1.6 5.5-.6 1.4-1 3.3-.8 5.5.6v6c-2.2-1.2-4.1-1.3-5.5-.2-1.4-1.1-3.3-1-5.5.2v-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path d="M22 25.1v5.8" stroke="currentColor" strokeWidth="1.15" />
      {/* Eight-point star at the crown */}
      <path
        d="M22 4.6 23.3 7 26 7.6 24 9.5 24.5 12.2 22 11 19.5 12.2 20 9.5 18 7.6 20.7 7Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Wordmark({
  tone = 'dark',
  compact = false,
  className,
}: {
  tone?: 'dark' | 'light';
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link href="/" className={cn('group flex items-center gap-3', className)} aria-label="Bookstore.dz, accueil">
      <span
        className={cn(
          'flex shrink-0 items-center justify-center transition-transform duration-300 group-hover:-translate-y-0.5',
          tone === 'dark' ? 'text-sea' : 'text-brass-light',
          compact ? 'h-9 w-9' : 'h-10 w-10',
        )}
      >
        <BrandMark className={compact ? 'h-9 w-9' : 'h-10 w-10'} />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display tracking-[-0.035em]',
            compact ? 'text-[1.35rem]' : 'text-[1.55rem]',
            tone === 'dark' ? 'text-ink' : 'text-ivory',
          )}
        >
          Bookstore
          <span className={cn('font-sans text-[0.62em] font-bold tracking-normal', tone === 'dark' ? 'text-clay' : 'text-brass-light')}>
            .dz
          </span>
        </span>
        <span
          className={cn(
            'mt-1 font-kufi text-[8.5px] tracking-[0.18em]',
            tone === 'dark' ? 'text-muted' : 'text-ivory/50',
          )}
          dir="rtl"
        >
          المكتبة المفتوحة
        </span>
      </span>
    </Link>
  );
}
