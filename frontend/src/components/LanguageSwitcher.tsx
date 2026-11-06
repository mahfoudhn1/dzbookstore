'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { LOCALES, LOCALE_META, type Locale } from '@/lib/i18n/config';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({
  className,
  placement = 'down',
  compact = false,
}: {
  className?: string;
  placement?: 'down' | 'up';
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = LOCALE_META[locale];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const choose = (next: Locale) => {
    setLocale(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t('Changer de langue')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex h-9 items-center gap-1.5 text-ink-soft transition-colors hover:text-clay',
          compact ? 'w-9 justify-center' : 'px-1.5',
        )}
      >
        <Languages className="h-[17px] w-[17px]" />
        {!compact && (
          <span className="text-[9px] font-bold uppercase tracking-[0.1em]">{current.short}</span>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('Langue de l’interface')}
          className={cn(
            'absolute z-[90] w-48 border border-line bg-parchment p-1 shadow-[0_24px_60px_-28px_rgba(10,38,50,0.5)]',
            placement === 'up' ? 'bottom-[calc(100%+12px)]' : 'top-[calc(100%+12px)]',
            'right-0',
          )}
        >
          {LOCALES.map((item) => {
            const meta = LOCALE_META[item];
            const active = item === locale;
            return (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => choose(item)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[11.5px] transition-colors',
                  active ? 'bg-sea/[0.06] font-semibold text-sea' : 'text-ink-soft hover:bg-ivory-deep',
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted">
                    {meta.short}
                  </span>
                  <span dir={meta.dir}>{meta.label}</span>
                </span>
                {active && <Check className="h-3.5 w-3.5 text-clay" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
