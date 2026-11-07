'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  MapPin,
  Pencil,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import type { Offer } from '@/lib/types';
import { cn, conditionTone, formatPrice, getLocalizedCondition, getLocalizedFormat, getLocalizedWilaya, getMediaUrl, normalizeCondition } from '@/lib/utils';
import { WILAYAS } from '@/lib/wilayas';
import { AddToCartButton } from './AddToCartButton';
import { ContactSellerButton } from '@/components/ContactSellerButton';
import { ZelligeStar } from '@/components/ui/Ornaments';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useAppSelector } from '@/lib/store/hooks';
import { selectUser } from '@/lib/store/authSlice';

type Tab = 'ALL' | 'BOOKSTORE' | 'INDIVIDUAL';

export function OfferComparison({ offers }: { offers: Offer[] }) {
  const { t, locale } = useI18n();
  const user = useAppSelector(selectUser);
  const [tab, setTab] = useState<Tab>('ALL');
  const [sort, setSort] = useState<'price_asc' | 'price_desc'>('price_asc');

  const cheapestId = useMemo(
    () =>
      offers.length
        ? [...offers].sort((a, b) => a.price - b.price)[0].id
        : null,
    [offers],
  );

  const bookstoreCount = offers.filter((offer) => offer.seller_type === 'BOOKSTORE').length;
  const individualCount = offers.filter((offer) => offer.seller_type === 'INDIVIDUAL').length;

  const visible = useMemo(() => {
    const filtered =
      tab === 'ALL' ? offers : offers.filter((offer) => offer.seller_type === tab);
    return [...filtered].sort((a, b) =>
      sort === 'price_asc' ? a.price - b.price : b.price - a.price,
    );
  }, [offers, tab, sort]);

  if (offers.length === 0) {
    return (
      <div className="mt-8 border border-line bg-parchment px-6 py-14 text-center">
        <ZelligeStar className="mx-auto h-8 w-8 text-brass/70" strokeWidth={0.9} />
        <h3 className="mt-4 font-display text-[1.7rem] leading-none text-ink">
          {t("Aucune offre active pour le moment.")}{' '}</h3>
        <p className="mx-auto mt-3 max-w-md text-[12px] leading-relaxed text-muted">
          {t("Ce titre est référencé au catalogue. Les librairies peuvent le commander et les lecteurs peuvent proposer leur exemplaire.")}{' '}</p>
        <Link
          href="/sell"
          className="mt-5 inline-flex bg-clay px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-clay-deep"
        >
          {t("Proposer un exemplaire")}{' '}</Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="grid grid-cols-3 divide-x divide-line border-y border-line bg-parchment">
        <div className="px-4 py-4 sm:px-6">
          <p className="text-[8px] uppercase tracking-label text-muted">{t("Meilleur prix")}</p>
          <p className="mt-1.5 font-display text-[1.35rem] leading-none text-sea">
            {formatPrice(Math.min(...offers.map((offer) => offer.price)))}
          </p>
        </div>
        <div className="px-4 py-4 sm:px-6">
          <p className="text-[8px] uppercase tracking-label text-muted">{t("Librairies")}</p>
          <p className="mt-1.5 font-display text-[1.35rem] leading-none text-sea">{bookstoreCount}</p>
        </div>
        <div className="px-4 py-4 sm:px-6">
          <p className="text-[8px] uppercase tracking-label text-muted">{t("Occasion")}</p>
          <p className="mt-1.5 font-display text-[1.35rem] leading-none text-sea">{individualCount}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 border-b border-line pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-5 overflow-x-auto no-scrollbar">
          {[
            { id: 'ALL' as const, label: 'Toutes les offres', count: offers.length },
            { id: 'BOOKSTORE' as const, label: 'En librairie', count: bookstoreCount },
            { id: 'INDIVIDUAL' as const, label: 'D’occasion', count: individualCount },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'relative shrink-0 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors',
                tab === item.id ? 'text-sea' : 'text-muted hover:text-ink',
              )}
            >
              {t(item.label)} <span className="text-[8px] opacity-60">({item.count})</span>
              <span
                className={cn(
                  'absolute bottom-0 left-0 h-px w-full bg-clay transition-transform',
                  tab === item.id ? 'scale-x-100' : 'scale-x-0',
                )}
              />
            </button>
          ))}
        </div>

        <label className="flex shrink-0 items-center gap-2 text-[9px] uppercase tracking-[0.1em] text-muted">
          {t("Trier")}{' '}<select
            value={sort}
            onChange={(event) => setSort(event.target.value as 'price_asc' | 'price_desc')}
            className="h-8 cursor-pointer border border-line bg-parchment px-2 text-[10px] font-medium text-ink focus:border-sea/50 focus:outline-none"
          >
            <option value="price_asc">{t("Prix croissant")}</option>
            <option value="price_desc">{t("Prix décroissant")}</option>
          </select>
        </label>
      </div>

      <div className="mt-4 space-y-3">
        {visible.map((offer) => {
          const isBookstore = offer.seller_type === 'BOOKSTORE';
          const isCheapest = offer.id === cheapestId;
          const isOwner = Boolean(
            user &&
              (offer.seller === user.id ||
                (offer.bookstore?.id &&
                  user.bookstore_profile?.id === offer.bookstore.id)),
          );
          const editHref = offer.bookstore
            ? `/dashboard/library?edit=${offer.id}`
            : '/dashboard/seller';
          return (
            <article
              key={offer.id}
              className={cn(
                'relative grid gap-5 border bg-parchment p-5 transition-colors sm:p-6 lg:grid-cols-[1.25fr_1fr_1fr_auto] lg:items-center lg:gap-6',
                isCheapest ? 'border-brass/45' : 'border-line hover:border-sea/25',
              )}
            >
              {isCheapest && (
                <span className="absolute -top-[1px] left-4 inline-flex -translate-y-1/2 items-center gap-1 bg-brass px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-sea-deep">
                  <ZelligeStar className="h-2.5 w-2.5" />
                  {t("Meilleur prix")}{' '}</span>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {isBookstore ? (
                    <span className="inline-flex items-center gap-1 border border-emerald-dz/20 bg-emerald-dz/[0.07] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-emerald-deep">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      {t("Librairie vérifiée")}{' '}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 border border-clay/20 bg-clay/[0.06] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-clay">
                      <Sparkles className="h-2.5 w-2.5" />
                      {t("Particulier")}{' '}</span>
                  )}
                  {!isBookstore && offer.individual_seller?.trust_score ? (
                    <span className="text-[9px] font-semibold text-muted">
                      ★ {offer.individual_seller.trust_score.toFixed(1)}/5
                    </span>
                  ) : null}
                </div>

                <div className="mt-2.5">
                  {isBookstore && offer.bookstore ? (
                    <Link
                      href={`/libraries/${offer.bookstore.slug}`}
                      className="font-display text-[1.3rem] leading-none text-ink transition-colors hover:text-sea"
                    >
                      {offer.seller_name}
                    </Link>
                  ) : (
                    <p className="font-display text-[1.3rem] leading-none text-ink">{offer.seller_name}</p>
                  )}
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
                    <MapPin className="h-3 w-3 text-clay/80" />
                    {t("Wilaya")}{' '}{offer.seller_wilaya_code} · {getLocalizedWilaya({
                      code: offer.seller_wilaya_code,
                      name_fr: offer.seller_wilaya_name,
                      name_ar: offer.seller_wilaya_name_ar,
                      name_en: offer.seller_wilaya_name_en,
                    }, locale)}
                    {locale === 'ar' && offer.seller_commune_name_ar
                      ? ` · ${offer.seller_commune_name_ar}`
                      : offer.seller_commune_name
                        ? ` · ${offer.seller_commune_name}`
                        : ''}
                  </p>
                  {offer.bookstore?.opening_hours && (
                    <p className="mt-1 flex items-center gap-1.5 text-[9.5px] text-muted/75">
                      <Clock className="h-2.5 w-2.5" />
                      {offer.bookstore.opening_hours}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'border px-2 py-1 text-[8.5px] font-semibold uppercase tracking-[0.05em]',
                      conditionTone(offer.condition),
                    )}
                  >
                    {getLocalizedCondition(offer.condition, locale, t)}
                  </span>
                  {offer.edition_format && (
                    <span className="text-[9.5px] text-muted">{getLocalizedFormat(offer.edition_format, locale, t)}</span>
                  )}
                  {offer.language_display && (
                    <span className="border border-line bg-ivory px-2 py-1 text-[8.5px] font-semibold uppercase tracking-[0.05em] text-muted">
                      {offer.language_display}
                    </span>
                  )}
                  <span
                    className={cn(
                      'border px-2 py-1 text-[8.5px] font-semibold uppercase tracking-[0.05em]',
                      offer.is_in_stock
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700',
                    )}
                  >
                    {offer.is_in_stock ? t('En stock') : t('Rupture de stock')}
                  </span>
                </div>
                <p className="mt-1.5 text-[9px] text-muted">
                  {offer.regions?.length
                    ? `${t('Livraison')}: ${offer.regions
                        .slice(0, 4)
                        .map((id) => {
                          const w = WILAYAS.find((item) => item.id === id);
                          return w ? getLocalizedWilaya(w, locale) : id;
                        })
                        .join(', ')}${offer.regions.length > 4 ? ` +${offer.regions.length - 4}` : ''}`
                    : t('Livraison dans les 58 wilayas')}
                </p>
                <p className="mt-2 line-clamp-2 text-[10.5px] leading-relaxed text-muted">
                  {offer.condition_description || t('Exemplaire vérifié par le vendeur.')}
                </p>
                {offer.photos?.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[8px] uppercase tracking-[0.1em] text-muted/60">{t("Photos")}</span>
                    {offer.photos.slice(0, 3).map((photo, index) => {
                      const resolvedPhoto = getMediaUrl(photo);
                      return (
                        <a
                          key={`${photo}-${index}`}
                          href={resolvedPhoto}
                          target="_blank"
                          rel="noreferrer"
                          className="h-7 w-7 overflow-hidden border border-line transition-transform hover:scale-105"
                        >
                          <img src={resolvedPhoto} alt={t("Photo de l’exemplaire")} className="h-full w-full object-cover" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 border-t border-line/70 pt-3 text-[10px] text-muted lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                {offer.has_store_pickup && (
                  <p className="flex items-center gap-1.5 text-emerald-deep">
                    <Store className="h-3 w-3 shrink-0" />
                    {t("Retrait en librairie ·")}{' '}<span className="font-semibold">{t("gratuit")}</span>
                  </p>
                )}
                {offer.has_stop_desk_delivery && (
                  <p className="flex items-center gap-1.5">
                    <Truck className="h-3 w-3 shrink-0 text-brass" />
                    {t("Stop-desk ·")}{' '}{offer.stop_desk_fee ? formatPrice(offer.stop_desk_fee) : '350 DA'}
                  </p>
                )}
                {offer.has_home_delivery && (
                  <p className="flex items-center gap-1.5">
                    <Truck className="h-3 w-3 shrink-0 text-brass" />
                    {t("À domicile ·")}{' '}{offer.home_delivery_fee ? formatPrice(offer.home_delivery_fee) : '550 DA'}
                  </p>
                )}
                {!offer.has_store_pickup && !offer.has_stop_desk_delivery && !offer.has_home_delivery && (
                  <p className="text-[9.5px] italic text-muted/70">{t("Modalités à convenir avec le vendeur")}</p>
                )}
              </div>

              <div className="flex flex-row items-end justify-between gap-3 border-t border-line/70 pt-4 lg:min-w-[164px] lg:flex-col lg:items-end lg:border-t-0 lg:pt-0">
                <div className="text-left lg:text-right">
                  {offer.original_price && (
                    <p className="text-[10px] text-muted/60 line-through">
                      {formatPrice(offer.original_price)}
                    </p>
                  )}
                  <p className="font-sans text-[1.5rem] font-bold leading-none tracking-tight text-sea">
                    {formatPrice(offer.price)}
                  </p>
                  <p className="mt-1 text-[9px] text-muted/70">
                    {offer.quantity > 1 ? t("{count} exemplaires", { count: offer.quantity }) : t("Dernier exemplaire")}
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto lg:w-[164px]">
                  {isOwner ? (
                    <>
                      <span className="inline-flex items-center justify-center border border-clay/30 bg-clay/5 px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-clay">
                        {t('Votre annonce')}
                      </span>
                      <Link
                        href={editHref}
                        className="inline-flex items-center justify-center gap-2 bg-sea px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-ivory transition-colors hover:bg-sea-deep"
                      >
                        <Pencil className="h-3 w-3" />
                        {t('Modifier / stock')}
                      </Link>
                    </>
                  ) : (
                    <>
                      <AddToCartButton offer={offer} label={t("Ajouter")} />
                      <ContactSellerButton
                        sellerName={offer.seller_name}
                        phone={offer.bookstore?.phone || offer.individual_seller?.phone}
                        whatsapp={offer.bookstore?.whatsapp || offer.individual_seller?.whatsapp}
                        bookstoreId={offer.bookstore?.id}
                        individualSellerId={offer.individual_seller?.id}
                      />
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
