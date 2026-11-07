import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowUpRight,
  ChevronRight,
  Clock,
  Filter,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Store,
  Truck,
  X,
} from 'lucide-react';
import {
  fetchBookstoreBySlug,
  fetchCategories,
  fetchLibraryBooks,
} from '@/lib/api';
import { formatPrice, getLocalizedCategory, getLocalizedWilaya, getMediaUrl, initials, normalizeCondition, pluralize } from '@/lib/utils';
import { WILAYAS } from '@/lib/wilayas';
import { BookCover } from '@/components/books/BookCover';
import { AddToCartButton } from '@/components/books/AddToCartButton';
import { MessageSellerButton } from '@/components/MessageSellerButton';
import { ArchFrame, SectionHeading, ZelligeField, ZelligeStar } from '@/components/ui/Ornaments';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

const LANGUAGE_OPTIONS = [
  { value: 'ARABIC', label: 'Arabe' },
  { value: 'FRENCH', label: 'Français' },
  { value: 'ENGLISH', label: 'Anglais' },
  { value: 'TAMAZIGHT', label: 'Tamazight' },
  { value: 'OTHER', label: 'Autre' },
];

export default async function BookstoreDetailPage(props: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, locale } = await getT();
  const { slug } = await props.params;
  const [store, categories] = await Promise.all([
    fetchBookstoreBySlug(slug),
    fetchCategories(),
  ]);
  if (!store) notFound();

  const query = (await props.searchParams) ?? {};
  const value = (key: string) => {
    const entry = query[key];
    return Array.isArray(entry) ? entry[0] : entry;
  };

  const search = (value('search') || '').trim();
  const categoryParam = value('category') || '';
  const selectedCategories = categoryParam.split(',').filter(Boolean);
  const language = value('language') || '';
  const minPrice = value('min_price') || '';
  const maxPrice = value('max_price') || '';
  const stock = value('is_in_stock') || '';
  const ordering = value('ordering') || '-created_at';
  const hasActiveFilters = Boolean(
    search || selectedCategories.length || language || minPrice || maxPrice || stock,
  );

  const storeOffers = await fetchLibraryBooks(store.id, {
    search: search || undefined,
    category: selectedCategories.join(',') || undefined,
    language: language || undefined,
    min_price: minPrice ? Number(minPrice) : undefined,
    max_price: maxPrice ? Number(maxPrice) : undefined,
    is_in_stock: stock === 'true' ? true : stock === 'false' ? false : undefined,
    ordering,
    include_unavailable: stock === 'false',
  });

  const activeFilterCount =
    (search ? 1 : 0) +
    selectedCategories.length +
    (language ? 1 : 0) +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (stock ? 1 : 0);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      search: search || undefined,
      category: selectedCategories.join(',') || undefined,
      language: language || undefined,
      min_price: minPrice || undefined,
      max_price: maxPrice || undefined,
      is_in_stock: stock || undefined,
      ordering: ordering !== '-created_at' ? ordering : undefined,
      ...overrides,
    };
    Object.entries(merged).forEach(([key, entry]) => {
      if (entry) next.set(key, entry);
    });
    const queryString = next.toString();
    return `/libraries/${store.slug}${queryString ? `?${queryString}` : ''}`;
  };

  const toggleCategoryHref = (slug: string) => {
    const next = selectedCategories.includes(slug)
      ? selectedCategories.filter((item) => item !== slug)
      : [...selectedCategories, slug];
    return buildHref({ category: next.join(',') || undefined });
  };

  const filters = (
    <div className="space-y-8">
      <FilterGroup title={t('Rayons')}>
        <FilterLink
          href={buildHref({ category: undefined })}
          active={selectedCategories.length === 0}
        >
          {t('Toutes les catégories')}
        </FilterLink>
        <div className="max-h-64 overflow-y-auto pr-1">
          {categories.map((item) => (
            <FilterLink
              key={item.id}
              href={toggleCategoryHref(item.slug)}
              active={selectedCategories.includes(item.slug)}
            >
              {getLocalizedCategory(item, locale)}
            </FilterLink>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={t('Langue')}>
        <FilterLink href={buildHref({ language: undefined })} active={!language}>
          {t('Toutes les langues')}
        </FilterLink>
        {LANGUAGE_OPTIONS.map((item) => (
          <FilterLink
            key={item.value}
            href={buildHref({ language: item.value })}
            active={language === item.value}
          >
            {item.label}
          </FilterLink>
        ))}
      </FilterGroup>

      <FilterGroup title={t('Disponibilité')}>
        <FilterLink href={buildHref({ is_in_stock: undefined })} active={!stock}>
          {t('Tous les stocks')}
        </FilterLink>
        <FilterLink href={buildHref({ is_in_stock: 'true' })} active={stock === 'true'}>
          {t('En stock')}
        </FilterLink>
        <FilterLink href={buildHref({ is_in_stock: 'false' })} active={stock === 'false'}>
          {t('Rupture de stock')}
        </FilterLink>
      </FilterGroup>

      <FilterGroup title={t('Prix (DA)')}>
        <form
          action={`/libraries/${store.slug}`}
          method="get"
          className="space-y-2 pt-2"
        >
          {search ? <input type="hidden" name="search" value={search} /> : null}
          {selectedCategories.length ? (
            <input type="hidden" name="category" value={selectedCategories.join(',')} />
          ) : null}
          {language ? <input type="hidden" name="language" value={language} /> : null}
          {stock ? <input type="hidden" name="is_in_stock" value={stock} /> : null}
          {ordering !== '-created_at' ? (
            <input type="hidden" name="ordering" value={ordering} />
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              name="min_price"
              defaultValue={minPrice}
              placeholder={t('Min.')}
              className="w-full rounded-xs border border-line bg-parchment px-2.5 py-2 text-[11px] text-ink focus:border-sea/50 focus:outline-none"
            />
            <input
              type="number"
              min="0"
              name="max_price"
              defaultValue={maxPrice}
              placeholder={t('Max.')}
              className="w-full rounded-xs border border-line bg-parchment px-2.5 py-2 text-[11px] text-ink focus:border-sea/50 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-sea px-3 py-2 text-[8.5px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-sea-deep"
          >
            {t('Appliquer le prix')}
          </button>
        </form>
      </FilterGroup>
    </div>
  );

  return (
    <div className="bg-ivory">
      <div className="border-b border-line bg-parchment">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 overflow-x-auto px-4 py-4 text-[9px] uppercase tracking-[0.12em] text-muted no-scrollbar sm:px-6 lg:px-10">
          <Link href="/" className="shrink-0 hover:text-sea">{t("Accueil")}</Link>
          <ChevronRight className="h-2.5 w-2.5 shrink-0" />
          <Link href="/libraries" className="shrink-0 hover:text-sea">{t("Librairies")}</Link>
          <ChevronRight className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate text-ink">{store.store_name}</span>
        </div>
      </div>

      {/* Storefront */}
      <section className="relative overflow-hidden bg-sea text-ivory">
        <ZelligeField className="text-ivory" opacity={0.06} />
        {store.banner_url && (
          <img
            src={getMediaUrl(store.banner_url)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-sea-deep/80 via-sea/60 to-transparent" />
        <div className="relative mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end">
            <ArchFrame id="store-hero-arch" className="h-[132px] w-[108px] shrink-0" padding="p-[3px]">
              {store.logo_url && !store.logo_url.includes('images.unsplash.com') ? (
                <img src={getMediaUrl(store.logo_url)} alt={`Logo de ${store.store_name}`} className="h-full w-full object-cover" />
              ) : (
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-sea-soft">
                  <ZelligeField className="text-brass" opacity={0.2} size="sm" />
                  <span className="relative font-display text-[2.4rem] text-ivory">
                    {initials(store.store_name)}
                  </span>
                </div>
              )}
            </ArchFrame>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {store.is_verified && (
                  <span className="inline-flex items-center gap-1 border border-brass-light/35 bg-ivory/[0.07] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-brass-light backdrop-blur">
                    <ShieldCheck className="h-3 w-3" />
                    {t("Librairie vérifiée")}{' '}</span>
                )}
                <span className="border border-ivory/15 bg-ivory/[0.04] px-2.5 py-1 text-[8px] uppercase tracking-[0.1em] text-ivory/60">
                  {t("Wilaya")}{' '}{store.wilaya_code} · {getLocalizedWilaya(store, locale)}
                </span>
              </div>
              <h1 className="mt-4 font-display text-[2.6rem] leading-[0.98] tracking-[-0.04em] sm:text-[3.5rem]">
                {store.store_name}
              </h1>
              <p className="mt-3 flex items-center gap-2 text-[11px] text-ivory/60">
                <MapPin className="h-3.5 w-3.5 text-brass-light" />
                {store.address}
                {locale === 'ar' && store.commune_name_ar ? ` · ${store.commune_name_ar}` : store.commune_name_fr ? ` · ${store.commune_name_fr}` : ''}
              </p>
              <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-ivory/60">
                {store.description || 'Librairie généraliste et indépendante.'}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <MessageSellerButton
                bookstoreId={store.id}
                label={t("Envoyer un message")}
                variant="hero"
              />
              {store.phone && (
                <a
                  href={`tel:${store.phone.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-2 border border-ivory/25 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-ivory transition-colors hover:border-brass-light hover:text-brass-light"
                >
                  <Phone className="h-3 w-3" />
                  {store.phone}
                </a>
              )}
              {store.whatsapp && (
                <a
                  href={`https://wa.me/${store.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-brass-light px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-sea-deep transition-colors hover:bg-ivory"
                >
                  <MessageCircle className="h-3 w-3" />
                  {t("WhatsApp")}{' '}</a>
              )}
            </div>
          </div>

          <div className="mt-10 grid gap-px border border-ivory/15 bg-ivory/15 sm:grid-cols-3">
            <div className="bg-sea/80 px-5 py-4">
              <p className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.12em] text-brass-light">
                <Clock className="h-2.5 w-2.5" /> {t("Horaires")}{' '}</p>
              <p className="mt-1.5 text-[11px] text-ivory/70">
                {store.opening_hours || 'Samedi – Jeudi · 09h00 – 19h00'}
              </p>
            </div>
            <div className="bg-sea/80 px-5 py-4">
              <p className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.12em] text-brass-light">
                <Store className="h-2.5 w-2.5" /> {t("Retrait")}{' '}</p>
              <p className="mt-1.5 text-[11px] text-ivory/70">{t("Gratuit au comptoir, sous 24 h")}</p>
            </div>
            <div className="bg-sea/80 px-5 py-4">
              <p className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.12em] text-brass-light">
                <Truck className="h-2.5 w-2.5" /> {t("Expédition")}{' '}</p>
              <p className="mt-1.5 text-[11px] text-ivory/70">{t("Yalidine & ZR Express · 58 wilayas")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Inventory */}
      <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
        <SectionHeading
          eyebrow={t("Le fonds")}
          title={t("Les livres en rayon.")}
          arabic="الرفوف"
          description={`Les titres disponibles chez ${store.store_name}, mis à jour par la librairie.`}
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-[236px_1fr] lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-8 border-t border-line pt-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9px] font-semibold uppercase tracking-label text-muted">
                  {t('Filtres')}
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </p>
                {activeFilterCount > 0 ? (
                  <Link
                    href={`/libraries/${store.slug}`}
                    className="text-[9px] uppercase tracking-[0.1em] text-clay hover:underline"
                  >
                    {t('Tout effacer')}
                  </Link>
                ) : null}
              </div>
              {filters}
            </div>
          </aside>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
              <form
                action={`/libraries/${store.slug}`}
                method="get"
                className="relative min-w-[220px] flex-1 sm:max-w-sm"
              >
                {selectedCategories.length ? (
                  <input
                    type="hidden"
                    name="category"
                    value={selectedCategories.join(',')}
                  />
                ) : null}
                {language ? <input type="hidden" name="language" value={language} /> : null}
                {minPrice ? <input type="hidden" name="min_price" value={minPrice} /> : null}
                {maxPrice ? <input type="hidden" name="max_price" value={maxPrice} /> : null}
                {stock ? <input type="hidden" name="is_in_stock" value={stock} /> : null}
                {ordering !== '-created_at' ? (
                  <input type="hidden" name="ordering" value={ordering} />
                ) : null}
                <Search className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-muted" />
                <input
                  type="search"
                  name="search"
                  defaultValue={search}
                  placeholder={t('Rechercher un titre ou un auteur…')}
                  className="h-9 w-full border border-line bg-parchment py-2 pl-9 pr-3 text-[11px] text-ink focus:border-sea/50 focus:outline-none"
                />
              </form>

              <form
                action={`/libraries/${store.slug}`}
                method="get"
                className="flex items-center gap-3"
              >
                {search ? <input type="hidden" name="search" value={search} /> : null}
                {selectedCategories.length ? (
                  <input
                    type="hidden"
                    name="category"
                    value={selectedCategories.join(',')}
                  />
                ) : null}
                {language ? <input type="hidden" name="language" value={language} /> : null}
                {minPrice ? <input type="hidden" name="min_price" value={minPrice} /> : null}
                {maxPrice ? <input type="hidden" name="max_price" value={maxPrice} /> : null}
                {stock ? <input type="hidden" name="is_in_stock" value={stock} /> : null}
                <span className="hidden text-[9px] uppercase tracking-[0.1em] text-muted sm:inline">
                  {t('Trier')}
                </span>
                <select
                  name="ordering"
                  defaultValue={ordering}
                  className="h-9 cursor-pointer border border-line bg-parchment px-2.5 text-[10.5px] font-medium text-ink-soft focus:border-sea/50 focus:outline-none"
                >
                  <option value="-created_at">{t('Plus récents')}</option>
                  <option value="created_at">{t('Plus anciens')}</option>
                  <option value="price">{t('Prix croissant')}</option>
                  <option value="-price">{t('Prix décroissant')}</option>
                </select>
                <button
                  type="submit"
                  className="h-9 border border-line bg-sea px-3 text-[8.5px] font-bold uppercase tracking-[0.1em] text-ivory transition-colors hover:bg-sea-deep"
                >
                  {t('Trier')}
                </button>
              </form>
            </div>

            <details className="mt-4 border border-line bg-parchment lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink marker:content-none">
                <span className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-clay" />
                  {t('Filtres')}
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </span>
                <span className="text-[8px] text-muted">{t('Ouvrir')}</span>
              </summary>
              <div className="border-t border-line px-4 py-4">{filters}</div>
            </details>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
              <p>
                <span className="font-semibold text-ink">{storeOffers.length}</span>{' '}
                {t('titre(s) affiché(s)')}
              </p>
              {hasActiveFilters && (
                <p className="uppercase tracking-[0.1em] text-clay">
                  {t('Filtres actifs')}
                </p>
              )}
            </div>

            {storeOffers.length === 0 ? (
          <div className="mt-8 flex flex-col items-center border border-line bg-parchment px-6 py-14 text-center">
            <ZelligeStar className="h-8 w-8 text-brass/70" strokeWidth={0.9} />
            <h2 className="mt-4 font-display text-[1.8rem] leading-none text-ink">
              {hasActiveFilters
                ? t('Aucun livre ne correspond à ces filtres.')
                : t('Le fonds arrive bientôt.')}{' '}</h2>
            <p className="mt-2 max-w-md text-[11.5px] leading-relaxed text-muted">
              {hasActiveFilters
                ? t('Essayez une autre catégorie, une autre langue ou réinitialisez les filtres.')
                : t('Cette librairie prépare sa vitrine. Revenez dans quelques jours ou contactez-la directement.')}{' '}</p>
            {hasActiveFilters ? (
              <Link
                href={`/libraries/${store.slug}`}
                className="mt-4 inline-flex items-center gap-1.5 border border-line px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-muted transition-colors hover:border-sea/40 hover:text-sea"
              >
                <X className="h-3 w-3" />
                {t('Réinitialiser les filtres')}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {storeOffers.map((offer) => (
              <article key={offer.id} className="group flex flex-col">
                <Link
                  href={`/books/${offer.work_slug}`}
                  className="relative block overflow-hidden border border-line bg-ivory-deep/45 p-4"
                >
                  <BookCover
                    src={offer.work_cover}
                    title={offer.work_title}
                    author={offer.seller_name}
                    className="mx-auto w-[86%] transition-transform duration-500 group-hover:-translate-y-1.5"
                  />
                </Link>
                <div className="flex flex-1 flex-col pt-3.5">
                  <p className="text-[8px] font-semibold uppercase tracking-label text-clay">
                    {t(normalizeCondition(offer.condition))}
                  </p>
                  <Link href={`/books/${offer.work_slug}`} className="mt-1.5">
                    <h3 className="font-display text-[1.15rem] leading-[1.1] text-ink transition-colors group-hover:text-sea">
                      {offer.work_title}
                    </h3>
                  </Link>
                  <p className="mt-1 line-clamp-1 text-[10px] text-muted">
                    {offer.edition_publisher} {offer.edition_year ? `· ${offer.edition_year}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] ${
                        offer.is_in_stock
                          ? 'border-emerald-dz/25 bg-emerald-dz/5 text-emerald-deep'
                          : 'border-clay/25 bg-clay/5 text-clay-deep'
                      }`}
                    >
                      {offer.is_in_stock ? t('En stock') : t('Rupture de stock')}
                    </span>
                    <span className="border border-line bg-ivory px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted">
                      {LANGUAGE_OPTIONS.find((item) => item.value === offer.language)?.label ||
                        offer.language_display ||
                        '—'}
                    </span>
                    <span className="text-[8.5px] text-muted">
                      {offer.regions?.length
                        ? `${t('Livraison')}: ${offer.regions
                            .slice(0, 2)
                            .map((id) => {
                              const w = WILAYAS.find((item) => item.id === id);
                              return w ? getLocalizedWilaya(w, locale) : id;
                            })
                            .join(', ')}${offer.regions.length > 2 ? ` +${offer.regions.length - 2}` : ''}`
                        : t('Toutes les wilayas')}
                    </span>
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-2 border-t border-line/80 pt-3">
                    <p className="font-sans text-[13px] font-bold text-sea">{formatPrice(offer.price, locale)}</p>
                    <AddToCartButton offer={offer} label={t("Ajouter")} className="px-2.5 py-2 text-[8px]" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
          <p className="text-[10px] uppercase tracking-[0.1em] text-muted">
            {storeOffers.length} {t(pluralize(storeOffers.length, 'titre en rayon'))} {t("· retrait gratuit en magasin")}{' '}</p>
          {store.latitude && store.longitude ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${store.latitude},${store.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-sea hover:text-clay"
            >
              {t("Voir l’adresse sur la carte")}{' '}<ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          ) : null}
        </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-[8.5px] font-bold uppercase tracking-label text-sea">
        {title}
      </h2>
      <div className="space-y-0.5 border-t border-line/70 pt-1.5">{children}</div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'flex items-center justify-between py-1.5 text-[11px] font-semibold text-clay'
          : 'flex items-center justify-between py-1.5 text-[11px] text-ink-soft/80 transition-colors hover:text-sea'
      }
    >
      <span>{children}</span>
      {active ? <ZelligeStar className="h-2.5 w-2.5 text-clay" /> : null}
    </Link>
  );
}
