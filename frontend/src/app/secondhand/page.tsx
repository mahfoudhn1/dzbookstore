import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  ChevronRight,
  MapPin,
  Plus,
  Sparkles,
  Star,
  Truck,
} from 'lucide-react';
import { fetchOffers } from '@/lib/api';
import { conditionTone, formatPrice, getLocalizedCondition, getLocalizedWilaya, normalizeCondition, pluralize } from '@/lib/utils';
import { WILAYAS } from '@/lib/wilayas';
import { BookCover } from '@/components/books/BookCover';
import { ContactSellerButton } from '@/components/ContactSellerButton';
import { ZelligeField, ZelligeStar } from '@/components/ui/Ornaments';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Livres d’occasion',
  description:
    'Le marché de l’occasion entre lecteurs en Algérie : exemplaires photographiés, état décrit, remise en main propre ou livraison.',
};

const CONDITIONS = [
  ['NEW', 'Neuf'],
  ['LIKE_NEW', 'Comme neuf'],
  ['VERY_GOOD', 'Très bon état'],
  ['GOOD', 'Bon état'],
  ['ACCEPTABLE', 'État acceptable'],
] as const;

export default async function SecondhandPage(props: {
  searchParams?: Promise<{ wilaya_id?: string; condition?: string }>;
}) {
  const { t, locale } = await getT();
  const params = (await props.searchParams) ?? {};
  const wilayaId = params.wilaya_id ? Number(params.wilaya_id) : undefined;
  const condition = params.condition ?? '';

  const usedOffers = await fetchOffers({
    seller_type: 'INDIVIDUAL',
    wilaya_id: wilayaId,
    condition: condition || undefined,
  });

  const buildHref = (overrides: { wilaya_id?: string; condition?: string }) => {
    const next = new URLSearchParams();
    const values = { wilaya_id: params.wilaya_id, condition: params.condition, ...overrides };
    if (values.wilaya_id) next.set('wilaya_id', values.wilaya_id);
    if (values.condition) next.set('condition', values.condition);
    return `/secondhand${next.toString() ? `?${next.toString()}` : ''}`;
  };

  return (
    <div className="bg-ivory">
      {/* Header */}
      <section className="relative overflow-hidden bg-ivory-deep/60">
        <ZelligeField className="text-clay" opacity={0.045} />
        <ZelligeStar className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 text-clay/[0.06]" strokeWidth={0.6} />
        <div className="relative mx-auto max-w-[1440px] px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pb-16">
          <nav className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.12em] text-muted" aria-label={t("Fil d’Ariane")}>
            <Link href="/" className="transition-colors hover:text-sea">{t("Accueil")}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-ink">{t("Occasion")}</span>
          </nav>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-end">
            <div>
              <div className="flex items-center gap-2.5 text-[9px] font-semibold uppercase tracking-label text-clay">
                <Sparkles className="h-3 w-3" />
                {t("Le marché de seconde main")}{' '}</div>
              <h1 className="mt-3 max-w-3xl text-[2.6rem] leading-[0.97] tracking-[-0.045em] sm:text-[3.5rem] lg:text-[4rem]">
                {t("Une seconde vie")}{' '}<br />
                <span className="italic text-clay">{t("pour chaque livre.")}</span>
              </h1>
              <p className="mt-4 max-w-xl text-[12.5px] leading-relaxed text-muted">
                {t("Des exemplaires photographiés et décrits par des lecteurs, à Oran, Alger, Constantine ou à quelques wilayas de vous. Le prix juste, la conversation en plus.")}{' '}</p>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-5 text-[9.5px] text-muted">
                <span className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 text-brass" /> {t("Vendeurs notés par les lecteurs")}{' '}</span>
                <span className="flex items-center gap-1.5">
                  <Truck className="h-3 w-3 text-brass" /> {t("Remise en main propre ou envoi")}{' '}</span>
                <span className="flex items-center gap-1.5">
                  <ZelligeStar className="h-3 w-3 text-brass" /> {t("Photos réelles de l’exemplaire")}{' '}</span>
              </div>
            </div>

            <div className="border border-clay/20 bg-parchment p-5">
              <p className="font-kufi text-[8px] uppercase tracking-[0.2em] text-clay/70">{t("Vendez vos livres")}</p>
              <p className="mt-2 font-display text-[1.45rem] leading-[1.05] text-ink">
                {t("Votre bibliothèque peut faire des heureux.")}{' '}</p>
              <Link
                href="/sell"
                className="mt-4 inline-flex items-center gap-2 bg-clay px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-clay-deep"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("Déposer une annonce")}{' '}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="border-b border-line bg-ivory">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="mr-1 shrink-0 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-muted">{t("État")}</span>
            <Link
              href={buildHref({ condition: undefined })}
              className={
                !condition
                  ? 'shrink-0 border border-sea bg-sea px-3 py-1.5 text-[9.5px] font-semibold text-ivory'
                  : 'shrink-0 border border-line px-3 py-1.5 text-[9.5px] text-ink-soft transition-colors hover:border-sea/40 hover:text-sea'
              }
            >
              {t("Tous")}{' '}</Link>
            {CONDITIONS.map(([value, label]) => (
              <Link
                key={value}
                href={buildHref({ condition: value })}
                className={
                  condition === value
                    ? 'shrink-0 border border-sea bg-sea px-3 py-1.5 text-[9.5px] font-semibold text-ivory'
                    : 'shrink-0 border border-line px-3 py-1.5 text-[9.5px] text-ink-soft transition-colors hover:border-sea/40 hover:text-sea'
                }
              >
                {getLocalizedCondition(value, locale, t)}
              </Link>
            ))}
          </div>

          <form action="/secondhand" method="get" className="flex items-center gap-2">
            {condition && <input type="hidden" name="condition" value={condition} />}
            <label htmlFor="secondhand-wilaya" className="text-[8.5px] uppercase tracking-[0.1em] text-muted">
              {t("Wilaya")}{' '}</label>
            <select
              id="secondhand-wilaya"
              name="wilaya_id"
              defaultValue={params.wilaya_id ?? ''}
              className="h-8 max-w-[180px] cursor-pointer border border-line bg-parchment px-2 text-[10px] text-ink-soft focus:border-sea/50 focus:outline-none"
            >
              <option value="">{t("Toute l’Algérie")}</option>
              {WILAYAS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {getLocalizedWilaya(item, locale)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-8 border border-line px-3 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-ink transition-colors hover:border-sea hover:text-sea"
            >
              {t("Filtrer")}{' '}</button>
          </form>
        </div>
      </div>

      <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
            <span className="font-semibold text-ink">{usedOffers.length}</span>{' '}
            {t(pluralize(usedOffers.length, 'exemplaire disponible', 'exemplaires disponibles'))}
          </p>
          {(condition || wilayaId) && (
            <Link href="/secondhand" className="text-[9px] font-semibold uppercase tracking-[0.1em] text-clay hover:underline">
              {t("Réinitialiser")}{' '}</Link>
          )}
        </div>

        {usedOffers.length === 0 ? (
          <div className="mt-8 flex flex-col items-center border border-line bg-parchment px-6 py-16 text-center">
            <Sparkles className="h-9 w-9 text-brass/70" strokeWidth={1.2} />
            <h2 className="mt-5 font-display text-[1.9rem] leading-none text-ink">
              {t("Aucun exemplaire pour ces filtres.")}{' '}</h2>
            <p className="mt-3 max-w-md text-[12px] leading-relaxed text-muted">
              {t("Élargissez la recherche ou soyez le premier à proposer ce livre à la communauté.")}{' '}</p>
            <Link
              href="/sell"
              className="mt-5 bg-clay px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory"
            >
              {t("Vendre un livre")}{' '}</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {usedOffers.map((offer) => (
              <article
                key={offer.id}
                className="group flex flex-col border border-line bg-parchment transition-colors hover:border-clay/35"
              >
                <div className="flex gap-4 p-4 sm:p-5">
                  <Link href={`/books/${offer.work_slug}`} className="block w-[36%] shrink-0">
                    <BookCover
                      src={offer.photos?.[0] || offer.work_cover}
                      title={offer.work_title}
                      author={offer.seller_name}
                      className="transition-transform duration-500 group-hover:-translate-y-1"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={`inline-flex w-fit border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] ${conditionTone(offer.condition)}`}
                    >
                      {getLocalizedCondition(offer.condition, locale, t)}
                    </span>
                    <Link href={`/books/${offer.work_slug}`} className="mt-2">
                      <h2 className="font-display text-[1.4rem] leading-[1.02] tracking-[-0.02em] text-ink transition-colors group-hover:text-clay">
                        {offer.work_title}
                      </h2>
                    </Link>
                    <p className="mt-1.5 text-[9.5px] text-muted">{t("Vendu par")}{' '}{offer.seller_name}</p>
                    <p className="mt-1 flex items-center gap-1 text-[9px] text-muted/75">
                      <MapPin className="h-2.5 w-2.5 text-clay/70" />
                      {getLocalizedWilaya({ wilaya_name_fr: offer.seller_wilaya_name, seller_wilaya_name_ar: offer.seller_wilaya_name_ar, seller_wilaya_name_en: offer.seller_wilaya_name_en }, locale)} · {(locale === 'ar' && offer.seller_commune_name_ar) ? offer.seller_commune_name_ar : (offer.seller_commune_name || 'Centre')}
                    </p>
                    <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                      <p className="font-sans text-[1.35rem] font-bold leading-none text-sea">
                        {formatPrice(offer.price, locale)}
                      </p>
                      {offer.individual_seller?.trust_score ? (
                        <span className="flex items-center gap-1 text-[9px] font-semibold text-muted">
                          <Star className="h-2.5 w-2.5 fill-brass text-brass" />
                          {offer.individual_seller.trust_score.toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <p className="mx-4 line-clamp-2 border-t border-line/80 py-3 text-[10.5px] italic leading-relaxed text-muted sm:mx-5">
                  « {offer.condition_description || 'Exemplaire soigné, décrit avec attention.'} »
                </p>

                <div className="mt-auto grid grid-cols-2 gap-2 border-t border-line p-4 sm:p-5">
                  <Link
                    href={`/books/${offer.work_slug}`}
                    className="inline-flex items-center justify-center gap-1.5 border border-ink/15 px-3 py-2.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink transition-colors hover:border-sea hover:text-sea"
                  >
                    {t("Voir la fiche")}{' '}<ArrowRight className="h-3 w-3" />
                  </Link>
                  <ContactSellerButton
                    sellerName={offer.seller_name}
                    phone={offer.individual_seller?.phone}
                    whatsapp={offer.individual_seller?.whatsapp}
                    bookstoreId={offer.bookstore?.id}
                    individualSellerId={offer.individual_seller?.id}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-parchment">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_1fr_1fr_1fr] lg:px-10">
          <div>
            <div className="flex items-center gap-2 text-[8.5px] font-semibold uppercase tracking-label text-clay">
              <ZelligeStar className="h-2.5 w-2.5" />
              {t("Comment ça marche")}{' '}</div>
            <h2 className="mt-3 font-display text-[1.8rem] leading-[1.02] tracking-[-0.02em] text-ink">
              {t("Du lecteur au lecteur.")}{' '}</h2>
          </div>
          {[
            ['01', 'Choisissez', 'Parcourez les exemplaires, lisez l’état et regardez les photos réelles.'],
            ['02', 'Écrivez', 'Contactez le vendeur pour confirmer la disponibilité et le mode de remise.'],
            ['03', 'Recevez', 'Retrait en main propre, stop-desk ou livraison à domicile.'],
          ].map(([number, title, text]) => (
            <div key={number} className="border-t border-line pt-4">
              <span className="font-display text-[10px] text-brass">{number}</span>
              <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.1em] text-ink">{title}</p>
              <p className="mt-2 text-[10.5px] leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
