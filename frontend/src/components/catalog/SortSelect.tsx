'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';

const OPTIONS = [
  { value: 'pertinence', label: 'Pertinence' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'title', label: 'Titre A–Z' },
  { value: 'recent', label: 'Nouveautés' },
];

export function SortSelect({ value }: { value: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="relative">
      <select
        aria-label={t("Trier les résultats")}
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          if (event.target.value === 'pertinence') params.delete('sort');
          else params.set('sort', event.target.value);
          router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
        }}
        className="h-9 cursor-pointer appearance-none border border-line bg-parchment pl-3 pr-8 text-[10.5px] font-medium text-ink-soft focus:border-sea/50 focus:outline-none"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.label)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
    </div>
  );
}
