'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, ShieldCheck, Truck } from 'lucide-react';
import { Wordmark } from '@/components/Brand';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { ZelligeField, ZelligeStar } from '@/components/ui/Ornaments';

const BULLETS = [
  {
    icon: ShieldCheck,
    title: 'Librairies vérifiées',
    text: 'Chaque professionnel est contrôlé avant la mise en ligne de ses offres.',
  },
  {
    icon: Truck,
    title: 'Livraison dans les 58 wilayas',
    text: 'À domicile, en stop-desk ou retrait en librairie.',
  },
  {
    icon: MapPin,
    title: 'Le livre près de chez vous',
    text: 'Comparez les prix des libraires et des lecteurs de votre wilaya.',
  },
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="bg-ivory">
      <div className="mx-auto grid min-h-[calc(100vh-10rem)] max-w-[1240px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_500px] lg:items-center lg:gap-16 lg:px-10 lg:py-16">
        <aside className="relative hidden overflow-hidden border border-line bg-sea px-10 py-12 text-ivory lg:flex lg:min-h-[640px] lg:flex-col lg:justify-between">
          <ZelligeField className="text-brass-light" opacity={0.09} />
          <div className="relative">
            <Wordmark tone="light" />
            <p className="mt-10 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-label text-brass-light">
              <ZelligeStar className="h-3.5 w-3.5" />
              {eyebrow}
            </p>
            <h1 className="mt-4 max-w-md font-display text-[2.7rem] leading-[0.98] tracking-[-0.04em]">
              {title}
            </h1>
            <p className="mt-5 max-w-sm text-[12.5px] leading-relaxed text-ivory/65">
              {description}
            </p>
          </div>

          <ul className="relative mt-12 space-y-6 border-t border-ivory/15 pt-8">
            {BULLETS.map(({ icon: Icon, title: bulletTitle, text }) => (
              <li key={bulletTitle} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-ivory/20 text-brass-light">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-ivory">
                    {t(bulletTitle)}
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-ivory/55">
                    {t(text)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="relative mt-10 font-kufi text-[10px] tracking-[0.12em] text-brass-light/80" dir="rtl">
            الجزائر تقرأ
          </p>
        </aside>

        <div className="mx-auto w-full max-w-[500px]">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Wordmark compact />
            <Link
              href="/"
              className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-sea"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("Accueil")}{' '}</Link>
          </div>

          <div className="relative border border-line bg-parchment p-6 shadow-card sm:p-9">
            <ZelligeField className="text-brass" opacity={0.035} />
            <div className="relative">
              <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-label text-clay">
                <ZelligeStar className="h-3 w-3" />
                {eyebrow}
              </p>
              <h2 className="mt-3 font-display text-[2rem] leading-[1.02] tracking-[-0.03em] text-ink sm:text-[2.25rem]">
                {title}
              </h2>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">{description}</p>

              <div className="mt-7">{children}</div>

              {footer ? (
                <div className="mt-7 border-t border-line/80 pt-5 text-[11.5px] text-muted">
                  {footer}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between text-[9px] uppercase tracking-[0.12em] text-muted/70">
            <Link href="/" className="hover:text-sea">
              {t("Retour à la librairie")}{' '}</Link>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              {t("Connexion sécurisée")}{' '}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
