import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, Library, Search } from 'lucide-react';
import { ArchFrame, ZelligeDivider, ZelligeField, ZelligeStar } from '@/components/ui/Ornaments';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Page introuvable',
  description: 'Cette page n’existe pas ou a été déplacée.',
};

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="relative overflow-hidden bg-parchment">
      <ZelligeField className="text-sea" opacity={0.04} />
      <ZelligeStar className="pointer-events-none absolute -right-20 top-10 h-[420px] w-[420px] text-sea/[0.045]" strokeWidth={0.5} />
      <ZelligeStar className="pointer-events-none absolute -left-24 bottom-0 h-[300px] w-[300px] text-clay/[0.05]" strokeWidth={0.6} />

      <div className="relative mx-auto grid max-w-[1200px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_380px] lg:items-center lg:px-10 lg:py-28">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-label text-clay">
            <ZelligeStar className="h-3 w-3" />
            {t("Erreur 404 · Page introuvable")}{' '}</div>

          <p className="mt-6 font-display text-[5rem] leading-[0.8] tracking-[-0.06em] text-sea/15 sm:text-[7rem]">
            404
          </p>

          <h1 className="mt-3 max-w-xl text-[2.7rem] leading-[0.98] tracking-[-0.04em] sm:text-[3.6rem]">
            {t("Ce rayon est")}{' '}<span className="italic text-clay">{t("vide.")}</span>
          </h1>

          <p className="mt-4 max-w-lg text-[12.5px] leading-relaxed text-muted">
            {t("La page que vous cherchez a peut-être été déplacée, vendue, ou n’a jamais existé. Le catalogue, lui, est toujours ouvert.")}{' '}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/recherche"
              className="inline-flex items-center gap-2 bg-sea px-5 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-sea-deep"
            >
              <Search className="h-3.5 w-3.5" />
              {t("Chercher un livre")}{' '}<ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 border border-ink/15 px-5 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-clay hover:text-clay"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("Retour à l’accueil")}{' '}</Link>
          </div>

          <ZelligeDivider className="mt-10 max-w-sm" tone="sea" />
        </div>

        <div className="relative hidden justify-center lg:flex">
          <ArchFrame id="not-found-arch" className="h-[420px] w-[330px]" padding="p-2">
            <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-sea text-ivory">
              <ZelligeField className="text-ivory" opacity={0.08} />
              <ZelligeStar className="relative h-14 w-14 text-brass-light/80" strokeWidth={0.7} />
              <p className="relative mt-7 px-8 text-center font-arabic text-[1.8rem] leading-[1.6] text-ivory/70" dir="rtl">
                الكتاب<br />
                دائماً<br />
                في مكانه
              </p>
              <p className="relative mt-6 text-center text-[7.5px] uppercase tracking-[0.18em] text-ivory/35">
                {t("Le livre est toujours")}{' '}<br />
                {t("à sa place")}{' '}</p>
              <Library className="relative mt-6 h-4 w-4 text-brass-light/60" />
            </div>
          </ArchFrame>
        </div>
      </div>
    </div>
  );
}
