import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { fetchLibraries } from '@/lib/api';
import { getLocalizedWilaya, getMediaUrl, initials, pluralize } from '@/lib/utils';
import { MessageSellerButton } from '@/components/MessageSellerButton';
import { WILAYAS } from '@/lib/wilayas';
import {
  ArchFrame,
  SectionHeading,
  ZelligeField,
  ZelligeStar,
} from '@/components/ui/Ornaments';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Les librairies d’Algérie',
  description:
    'L’annuaire des librairies indépendantes et vérifiées en Algérie : Alger, Oran, Constantine et les 58 wilayas.',
};

const FEATURED = ['16', '31', '25', '15', '19', '06', '23', '13'];

export default async function BookstoresPage(props: {
  searchParams?: Promise<{ wilaya_id?: string; search?: string }>;
}) {
  const { t, locale } = await getT();
  const params = (await props.searchParams) ?? {};
  const wilayaId = params.wilaya_id ? Number(params.wilaya_id) : undefined;
  const search = params.search?.trim() ?? '';
  const bookstores = await fetchLibraries({ wilaya_id: wilayaId, search: search || undefined });
  const selectedWilaya = WILAYAS.find((item) => item.id === wilayaId);

  const buildHref = (overrides: { wilaya_id?: string; search?: string }) => {
    const next = new URLSearchParams();
    const values = {
      wilaya_id: params.wilaya_id,
      search: params.search,
      ...overrides,
    };
    if (values.wilaya_id) next.set('wilaya_id', values.wilaya_id);
    if (values.search) next.set('search', values.search);
    return `/libraries${next.toString() ? `?${next.toString()}` : ''}`;
  };

  return (
    <div className="bg-ivory">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-line bg-parchment">
        <ZelligeField className="text-sea" opacity={0.035} />
        <ZelligeStar className="pointer-events-none absolute -right-16 top-8 h-72 w-72 text-sea/[0.04]" strokeWidth={0.6} />
        <div className="relative mx-auto max-w-[1440px] px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pb-16">
          <nav className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.12em] text-muted" aria-label={t("Fil d’Ariane")}>
            <Link href="/" className="transition-colors hover:text-sea">{t("Accueil")}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-ink">{t("Librairies")}</span>
          </nav>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px] lg:items-end">
            <div>
              <div className="flex items-center gap-2.5 text-[9px] font-semibold uppercase tracking-label text-clay">
                <ZelligeStar className="h-3 w-3" />
                {t("Le réseau national du livre")}{' '}</div>
              <h1 className="mt-3 max-w-3xl text-[2.6rem] leading-[0.98] tracking-[-0.04em] sm:text-[3.5rem] lg:text-[4rem]">
                {t("Les maisons")}{' '}<span className="italic text-clay">{t("du livre.")}</span>
              </h1>
              <p className="mt-4 max-w-2xl text-[12.5px] leading-relaxed text-muted">
                {t("Des librairies avec une adresse, un comptoir et un libraire. Découvrez les établissements vérifiés qui font vivre le livre en Algérie, et retirez vos commandes sans frais.")}{' '}</p>

              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-5 text-[10px] text-muted">
                <span className="flex items-center gap-2">
                  <Store className="h-3.5 w-3.5 text-brass" />
                  <strong className="font-semibold text-ink">{bookstores.length}</strong>{' '}
                  {t(pluralize(bookstores.length, 'librairie'))} {t("dans le réseau")}{' '}</span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-brass" />
                  {t("58 wilayas couvertes")}{' '}</span>
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-brass" />
                  {t("Vérification administrative")}{' '}</span>
              </div>
            </div>

            <form action="/libraries" method="get" className="border border-line bg-ivory p-1.5">
              <div className="flex items-center border border-line/80 bg-parchment">
                <Search className="ml-3 h-3.5 w-3.5 shrink-0 text-muted" />
                <input
                  type="search"
                  name="search"
                  defaultValue={search}
                  placeholder={t("Nom de la librairie…")}
                  aria-label={t("Rechercher une librairie")}
                  className="h-10 min-w-0 flex-1 bg-transparent px-2.5 text-[11.5px] placeholder:text-muted/60 focus:outline-none"
                />
              </div>
              <div className="mt-1.5 flex items-stretch border border-line/80 bg-parchment">
                <MapPin className="ml-3 mt-3 h-3.5 w-3.5 shrink-0 text-clay" />
                <select
                  name="wilaya_id"
                  defaultValue={params.wilaya_id ?? ''}
                  aria-label={t("Filtrer par wilaya")}
                  className="h-10 min-w-0 flex-1 cursor-pointer bg-transparent px-2.5 text-[11px] text-ink-soft focus:outline-none"
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
                  className="flex h-10 shrink-0 items-center gap-1.5 bg-sea px-4 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-sea-deep"
                >
                  {t("Filtrer")}{' '}<ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Quick wilaya chips */}
      <div className="border-b border-line bg-ivory">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 overflow-x-auto px-4 py-4 no-scrollbar sm:px-6 lg:px-10">
          <span className="mr-1 shrink-0 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-muted">
            {t("Wilaya")}{' '}</span>
          <Link
            href={buildHref({ wilaya_id: undefined })}
            className={
              !wilayaId
                ? 'shrink-0 border border-sea bg-sea px-3 py-1.5 text-[9.5px] font-semibold text-ivory'
                : 'shrink-0 border border-line px-3 py-1.5 text-[9.5px] text-ink-soft transition-colors hover:border-sea/40 hover:text-sea'
            }
          >
            {t("Toutes")}
          </Link>
          {WILAYAS.filter((item) => FEATURED.includes(String(item.id))).map((item) => (
            <Link
              key={item.id}
              href={buildHref({ wilaya_id: String(item.id) })}
              className={
                wilayaId === item.id
                  ? 'shrink-0 border border-sea bg-sea px-3 py-1.5 text-[9.5px] font-semibold text-ivory'
                  : 'shrink-0 border border-line px-3 py-1.5 text-[9.5px] text-ink-soft transition-colors hover:border-sea/40 hover:text-sea'
              }
            >
              {item.code} · {getLocalizedWilaya(item, locale)}
            </Link>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
            <span className="font-semibold text-ink">{bookstores.length}</span>{' '}
            {t(pluralize(bookstores.length, 'librairie trouvée', 'librairies trouvées'))}
            {selectedWilaya && <span> · {getLocalizedWilaya(selectedWilaya, locale)}</span>}
            {search && <span> · « {search} »</span>}
          </p>
          {(selectedWilaya || search) && (
            <Link
              href="/libraries"
              className="text-[9px] font-semibold uppercase tracking-[0.1em] text-clay underline-offset-4 hover:underline"
            >
              {t("Réinitialiser")}{' '}</Link>
          )}
        </div>

        {bookstores.length === 0 ? (
          <div className="mt-8 flex flex-col items-center border border-line bg-parchment px-6 py-16 text-center">
            <Store className="h-9 w-9 text-brass/70" strokeWidth={1.2} />
            <h2 className="mt-5 font-display text-[1.9rem] leading-none text-ink">
              {t("Aucune librairie ne correspond.")}{' '}</h2>
            <p className="mt-3 max-w-md text-[12px] leading-relaxed text-muted">
              {t("Essayez une autre wilaya ou un autre nom. Le réseau s’étend chaque mois.")}{' '}</p>
            <Link
              href="/libraries"
              className="mt-5 bg-sea px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory"
            >
              {t("Voir toutes les librairies")}{' '}</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {bookstores.map((store) => {
              const hasPhoto = Boolean(store.banner_url && !store.banner_url.includes('images.unsplash.com'));
              return (
                <article
                  key={store.id}
                  className="group flex flex-col border border-line bg-parchment transition-colors hover:border-sea/30"
                >
                  <div className="relative h-[146px] overflow-hidden bg-sea">
                    <ZelligeField className="text-ivory" opacity={0.07} />
                    {store.banner_url && (
                      <img
                        src={getMediaUrl(store.banner_url)}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-30 transition-transform duration-700 group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-sea-deep/70 via-transparent to-transparent" />
                    <div className="absolute left-5 top-5 flex items-center gap-2">
                      {store.is_verified && (
                        <span className="inline-flex items-center gap-1 border border-brass-light/30 bg-sea-deep/60 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-brass-light backdrop-blur">
                          <ShieldCheck className="h-2.5 w-2.5" />
                          {t("Vérifiée")}{' '}</span>
                      )}
                      <span className="border border-ivory/15 bg-sea-deep/50 px-2 py-1 text-[8px] uppercase tracking-[0.1em] text-ivory/70 backdrop-blur">
                        {store.wilaya_code} · {getLocalizedWilaya(store, locale)}
                      </span>
                    </div>
                    <div className="absolute -bottom-8 left-6">
                      <ArchFrame id={`store-card-${store.id}`} className="h-[92px] w-[76px]" padding="p-[3px]">
                        {store.logo_url && !store.logo_url.includes('images.unsplash.com') ? (
                          <img src={getMediaUrl(store.logo_url)} alt={`Logo de ${store.store_name}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-sea-soft">
                            <ZelligeField className="text-brass" opacity={0.2} size="sm" />
                            <span className="relative font-display text-xl text-ivory">{initials(store.store_name)}</span>
                          </div>
                        )}
                      </ArchFrame>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col px-6 pb-6 pt-12">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-[1.65rem] leading-[1.05] tracking-[-0.02em] text-ink transition-colors group-hover:text-sea">
                          {store.store_name}
                        </h2>
                        <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted">
                          <MapPin className="h-3 w-3 text-clay/80" />
                          {store.address}
                        </p>
                      </div>
                      <span className="border border-line px-2 py-1 text-[8.5px] font-medium uppercase tracking-[0.08em] text-muted">
                        {store.offers_count} {t(pluralize(store.offers_count, 'titre'))}
                      </span>
                    </div>

                    <p className="mt-4 line-clamp-2 text-[11.5px] leading-relaxed text-muted">
                      {store.description || 'Librairie généraliste et indépendante.'}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/80 pt-4 text-[9.5px] text-muted">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-brass" />
                        {store.opening_hours || 'Samedi – Jeudi'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-brass" />
                        {store.phone}
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-deep">
                        <Store className="h-3 w-3" />
                        {t("Retrait gratuit")}{' '}</span>
                    </div>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                      <span className="text-[9px] uppercase tracking-[0.12em] text-muted/70">
                        {hasPhoto ? 'Vitrine partenaire' : 'Librairie du réseau'}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <MessageSellerButton
                          bookstoreId={store.id}
                          label={t("Message")}
                          variant="outline"
                        />
                        <Link
                          href={`/libraries/${store.slug}`}
                          className="group/link inline-flex items-center gap-2 border border-ink/15 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-clay hover:text-clay"
                        >
                          {t("Visiter la librairie")}{' '}<ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-t border-line bg-ivory-deep/50">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-5 px-4 py-10 sm:flex-row sm:items-center sm:px-6 lg:px-10">
          <div>
            <div className="flex items-center gap-2 text-[8.5px] font-semibold uppercase tracking-label text-clay">
              <ZelligeStar className="h-2.5 w-2.5" />
              {t("Vous tenez une librairie ?")}{' '}</div>
            <p className="mt-2 font-display text-[1.7rem] leading-none text-ink">
              {t("Ouvrez votre vitrine sur Bookstore.dz.")}{' '}</p>
            <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-muted">
              {t("Un espace professionnel pour présenter votre fonds, gérer vos stocks et recevoir des commandes de tout le pays.")}{' '}</p>
          </div>
          <Link
            href="/dashboard/library"
            className="inline-flex shrink-0 items-center gap-2 bg-clay px-5 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-clay-deep"
          >
            {t("Devenir libraire")}{' '}<ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
