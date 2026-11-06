'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { BrandMark } from '@/components/Brand';
import { NewsletterForm } from '@/components/NewsletterForm';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { ZelligeBand, ZelligeStar } from '@/components/ui/Ornaments';

const columns = [
  {
    title: 'Explorer',
    links: [
      ['Le catalogue', '/recherche'],
      ['Nouveautés', '/#nouveautes'],
      ['Librairies', '/libraries'],
      ['Livres d’occasion', '/secondhand'],
      ['Auteurs algériens', '/#auteurs'],
    ],
  },
  {
    title: 'La maison',
    links: [
      ['Notre manifeste', '/#manifeste'],
      ['Devenir libraire', '/dashboard/library'],
      ['Vendre un livre', '/sell'],
      ['Livraison & retrait', '/#livraison'],
      ['Aide & contact', '/#contact'],
    ],
  },
  {
    title: 'Le pays',
    links: [
      ['Alger (16)', '/recherche?wilaya_id=16'],
      ['Oran (31)', '/recherche?wilaya_id=31'],
      ['Constantine (25)', '/recherche?wilaya_id=25'],
      ['Tizi Ouzou (15)', '/recherche?wilaya_id=15'],
      ['Les 58 wilayas', '/recherche'],
    ],
  },
  {
    title: 'Contact',
    links: [
      ['Nous écrire', '/#contact'],
      ['Aide & FAQ', '/#contact'],
      ['Presse', '/#contact'],
      ['Partenariats', '/#contact'],
    ],
  },
];

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer id="contact" className="relative scroll-mt-28 overflow-hidden bg-sea-deep text-ivory">
      <div aria-hidden className="zellige-lattice absolute inset-0 text-ivory/[0.035]" />
      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        {/* Newsletter / manifesto band */}
        <div className="grid gap-10 border-b border-ivory/12 py-14 lg:grid-cols-[1fr_auto] lg:items-end lg:py-16">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 text-[9px] font-semibold uppercase tracking-label text-brass-light">
              <ZelligeStar className="h-3 w-3" />
              {t("La lettre de Bookstore.dz")}{' '}</div>
            <h2 className="mt-4 font-display text-[2.2rem] leading-[1.02] tracking-[-0.025em] text-ivory sm:text-[3rem]">
              {t("Restons en page.")}{' '}</h2>
            <p className="mt-3 max-w-lg text-[12.5px] leading-relaxed text-ivory/55">
              {t("Une lettre mensuelle, sans bruit : les livres qui arrivent, les librairies qui ouvrent, et les voix qui traversent l’Algérie.")}{' '}</p>
            <div className="mt-6">
              <NewsletterForm />
            </div>
          </div>

          <div className="hidden flex-col items-end gap-2 text-right lg:flex">
            <span className="font-kufi text-[11px] leading-loose text-ivory/45" dir="rtl">
              اقرأ. تشارك. اكتشف.
            </span>
            <span className="font-arabic text-[2.3rem] leading-none text-brass-light/80" dir="rtl">
              الكتاب رفيق
            </span>
            <span className="mt-1 text-[9px] uppercase tracking-label text-ivory/30">
              {t("Un livre est un compagnon")}{' '}</span>
          </div>
        </div>

        {/* Main footer grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1fr_1fr] lg:gap-x-8 lg:py-16">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-9 w-9 text-brass-light" />
              <div>
                <p className="font-display text-[1.4rem] leading-none text-ivory">
                  Bookstore<span className="font-sans text-[0.58em] font-bold text-brass-light">.dz</span>
                </p>
                <p className="mt-1.5 font-kufi text-[8px] tracking-[0.16em] text-ivory/40" dir="rtl">
                  المكتبة المفتوحة
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-xs text-[11.5px] leading-relaxed text-ivory/50">
              {t("Une infrastructure culturelle pour le livre en Algérie : un catalogue central, des librairies indépendantes et un marché de l’occasion entre lecteurs.")}{' '}</p>

            <div className="mt-6 space-y-2 text-[11px] text-ivory/50">
              <p className="flex items-center gap-2">
                <MapPin className="h-3 w-3 text-brass-light/70" />
                {t("Alger · Oran · Constantine · les 58 wilayas")}{' '}</p>
              <p className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-brass-light/70" />
                bonjour@bookstore.dz
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-brass-light/70" />
                +213 (0) 21 00 00 00
              </p>
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="font-sans text-[8.5px] font-bold uppercase tracking-label text-brass-light">
                {t(column.title)}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-[11.5px] text-ivory/55 transition-colors hover:text-ivory"
                    >
                      {t(label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <ZelligeBand className="text-brass-light/30" />

        <div className="flex flex-col gap-4 py-6 text-[9px] uppercase tracking-[0.12em] text-ivory/30 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("© 2026 Bookstore.dz — Fait pour les lecteurs d’Algérie.")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/#contact" className="hover:text-ivory/60">{t("Confidentialité")}</Link>
            <Link href="/#contact" className="hover:text-ivory/60">{t("Conditions")}</Link>
            <LanguageSwitcher placement="up" className="text-ivory/60 [&_button]:text-ivory/60 [&_button:hover]:text-ivory" />
            <span className="flex items-center gap-1.5 text-ivory/40">
              <span className="h-1 w-1 bg-brass-light" /> {t("DZD")}{' '}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
