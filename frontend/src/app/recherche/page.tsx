import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { fetchCategories, fetchOffers, fetchWorks } from '@/lib/api';
import { dedupeWorks, formatNumber, getLocalizedCategory, getLocalizedCondition, getLocalizedWilaya, pluralize } from '@/lib/utils';
import { SearchBar } from '@/components/SearchBar';
import { BookCard } from '@/components/books/BookCard';
import { SortSelect } from '@/components/catalog/SortSelect';
import { WILAYAS } from '@/lib/wilayas';
import { ZelligeField, ZelligeStar } from '@/components/ui/Ornaments';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Explorer le catalogue',
  description:
    'Tous les livres disponibles en Algérie : recherche par titre, auteur, rayon, wilaya, librairie ou vendeur particulier.',
};

const CONDITIONS = [
  ['NEW', 'Neuf'],
  ['LIKE_NEW', 'Comme neuf'],
  ['VERY_GOOD', 'Très bon état'],
  ['GOOD', 'Bon état'],
  ['ACCEPTABLE', 'État acceptable'],
] as const;

const FEATURED_FILTER_WILAYAS = ['16', '31', '25', '15', '19', '06', '23', '13'];

export default async function SearchPage(props: {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    wilaya_id?: string;
    seller_type?: string;
    condition?: string;
    sort?: string;
  }>;
}) {
  const { t, locale } = await getT();
  const params = (await props.searchParams) ?? {};
  const q = params.q?.trim() ?? '';
  const categoryParam = params.category ?? '';
  const selectedCategories = categoryParam.split(',').filter(Boolean);
  const wilayaId = params.wilaya_id ?? '';
  const sellerType = params.seller_type ?? '';
  const condition = params.condition ?? '';
  const sort = params.sort ?? 'pertinence';

  const [rawWorks, categories, offers] = await Promise.all([
    fetchWorks({
      search: q || undefined,
      category: selectedCategories.join(',') || undefined,
    }),
    fetchCategories(),
    fetchOffers({
      wilaya_id: wilayaId ? Number(wilayaId) : undefined,
      seller_type: sellerType === 'BOOKSTORE' || sellerType === 'INDIVIDUAL' ? sellerType : undefined,
      condition: condition || undefined,
    }),
  ]);

  const hasOfferFilters = Boolean(wilayaId || sellerType || condition);
  const allowedIds = new Set(offers.map((offer) => offer.work_id));
  let works = dedupeWorks(rawWorks);
  if (hasOfferFilters) works = works.filter((work) => allowedIds.has(work.id));

  works = [...works].sort((a, b) => {
    if (sort === 'price_asc') return (a.min_price ?? Number.MAX_SAFE_INTEGER) - (b.min_price ?? Number.MAX_SAFE_INTEGER);
    if (sort === 'price_desc') return (b.min_price ?? -1) - (a.min_price ?? -1);
    if (sort === 'title') return a.title.localeCompare(b.title, 'fr');
    if (sort === 'recent') return b.id - a.id;
    return 0;
  });

  const selectedCategoryItems = selectedCategories
    .map((slug) => categories.find((item) => item.slug === slug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const selectedWilaya = WILAYAS.find((item) => String(item.id) === wilayaId);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      q: q || undefined,
      category: selectedCategories.join(',') || undefined,
      wilaya_id: wilayaId || undefined,
      seller_type: sellerType || undefined,
      condition: condition || undefined,
      sort: sort !== 'pertinence' ? sort : undefined,
      ...overrides,
    };
    Object.entries(merged).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    const query = next.toString();
    return `/recherche${query ? `?${query}` : ''}`;
  };

  const activeFilters: { label: string; href: string }[] = [];
  if (q) activeFilters.push({ label: `« ${q} »`, href: buildHref({ q: undefined }) });
  for (const selected of selectedCategoryItems) {
    activeFilters.push({
      label: getLocalizedCategory(selected, locale),
      href: buildHref({
        category:
          selectedCategories.filter((slug) => slug !== selected.slug).join(',') ||
          undefined,
      }),
    });
  }
  if (selectedWilaya)
    activeFilters.push({
      label: `${selectedWilaya.code} · ${getLocalizedWilaya(selectedWilaya, locale)}`,
      href: buildHref({ wilaya_id: undefined }),
    });
  if (sellerType)
    activeFilters.push({
      label: sellerType === 'BOOKSTORE' ? t('Librairies') : t('Particuliers'),
      href: buildHref({ seller_type: undefined }),
    });
  if (condition)
    activeFilters.push({
      label: getLocalizedCondition(condition, locale, t),
      href: buildHref({ condition: undefined }),
    });

  const filters = (
    <div className="space-y-8">
      <FilterGroup title={t("Rayons")}>
        <FilterLink
          href={buildHref({ category: undefined })}
          active={selectedCategories.length === 0}
        >
          {t("Tous les rayons")}{' '}</FilterLink>
        {categories.map((item) => {
          const next = selectedCategories.includes(item.slug)
            ? selectedCategories.filter((slug) => slug !== item.slug)
            : [...selectedCategories, item.slug];
          return (
            <FilterLink
              key={item.id}
              href={buildHref({ category: next.join(',') || undefined })}
              active={selectedCategories.includes(item.slug)}
            >
              {getLocalizedCategory(item, locale)}
            </FilterLink>
          );
        })}
      </FilterGroup>

      <FilterGroup title={t("Wilaya")}>
        <FilterLink href={buildHref({ wilaya_id: undefined })} active={!wilayaId}>
          {t("Toute l’Algérie")}{' '}</FilterLink>
        {WILAYAS.filter((item) => FEATURED_FILTER_WILAYAS.includes(String(item.id))).map((item) => (
          <FilterLink
            key={item.id}
            href={buildHref({ wilaya_id: String(item.id) })}
            active={wilayaId === String(item.id)}
          >
            {item.code} · {getLocalizedWilaya(item, locale)}
          </FilterLink>
        ))}
        <details className="pt-1">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.1em] text-clay marker:content-none">
            {t("Les 58 wilayas +")}{' '}</summary>
          <div className="mt-2 max-h-64 overflow-y-auto border-t border-line/70 pt-2">
            {WILAYAS.filter((item) => !FEATURED_FILTER_WILAYAS.includes(String(item.id))).map((item) => (
              <FilterLink
                key={item.id}
                href={buildHref({ wilaya_id: String(item.id) })}
                active={wilayaId === String(item.id)}
              >
                {item.code} · {getLocalizedWilaya(item, locale)}
              </FilterLink>
            ))}
          </div>
        </details>
      </FilterGroup>

      <FilterGroup title={t("Vendeur")}>
        <FilterLink href={buildHref({ seller_type: undefined })} active={!sellerType}>
          {t("Tous les vendeurs")}{' '}</FilterLink>
        <FilterLink
          href={buildHref({ seller_type: 'BOOKSTORE' })}
          active={sellerType === 'BOOKSTORE'}
        >
          {t("Librairies vérifiées")}{' '}</FilterLink>
        <FilterLink
          href={buildHref({ seller_type: 'INDIVIDUAL' })}
          active={sellerType === 'INDIVIDUAL'}
        >
          {t("Particuliers · occasion")}{' '}</FilterLink>
      </FilterGroup>

      <FilterGroup title={t("État")}>
        <FilterLink href={buildHref({ condition: undefined })} active={!condition}>
          {t("Tous les états")}{' '}</FilterLink>
        {CONDITIONS.map(([value, label]) => (
          <FilterLink
            key={value}
            href={buildHref({ condition: value })}
            active={condition === value}
          >
            {getLocalizedCondition(value, locale, t)}
          </FilterLink>
        ))}
      </FilterGroup>
    </div>
  );

  return (
    <div className="bg-ivory">
      <section className="relative overflow-hidden border-b border-line bg-parchment">
        <ZelligeField className="text-sea" opacity={0.03} />
        <div className="relative mx-auto max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 sm:pb-12 lg:px-10">
          <nav className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.12em] text-muted" aria-label={t("Fil d’Ariane")}>
            <Link href="/" className="transition-colors hover:text-sea">{t("Accueil")}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-ink">{t("Catalogue")}</span>
          </nav>

          <div className="mt-7 grid gap-8 xl:grid-cols-[1fr_560px] xl:items-end">
            <div>
              <div className="flex items-center gap-2.5 text-[9px] font-semibold uppercase tracking-label text-clay">
                <ZelligeStar className="h-3 w-3" />
                {t("Le catalogue central")}{' '}</div>
              <h1 className="mt-3 text-[2.5rem] leading-[0.99] tracking-[-0.04em] sm:text-[3.3rem]">
                {q ? (
                  <>
                    {t("Résultats pour")}{' '}<span className="italic text-clay">« {q} »</span>
                  </>
                ) : (
                  <>
                    {t("Explorer")}{' '}<span className="italic text-clay">{t("le catalogue.")}</span>
                  </>
                )}
              </h1>
              <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-muted">
                {t("Tous les livres, toutes les offres. Filtrez par rayon, wilaya, vendeur ou état, puis comparez les prix sur chaque fiche.")}{' '}</p>
            </div>
            <div className="lg:pb-1">
              <SearchBar defaultValue={q} defaultWilaya={wilayaId} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[236px_1fr] lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-8 border-t border-line pt-6">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-label text-muted">{t("Filtres")}</p>
                {activeFilters.length > 0 && (
                  <Link
                    href="/recherche"
                    className="text-[9px] uppercase tracking-[0.1em] text-clay hover:underline"
                  >
                    {t("Tout effacer")}{' '}</Link>
                )}
              </div>
              {filters}
            </div>
          </aside>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                <span className="font-semibold text-ink">{formatNumber(works.length)}</span>{' '}
                {t(pluralize(works.length, 'livre trouvé', 'livres trouvés'))}
                {q && <span> {t("pour «")}{' '}{q} »</span>}
              </p>
              <div className="flex items-center gap-3">
                <span className="hidden text-[9px] uppercase tracking-[0.1em] text-muted sm:inline">{t("Trier")}</span>
                <SortSelect value={sort} />
              </div>
            </div>

            <details className="mt-4 border border-line bg-parchment lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink marker:content-none">
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-clay" />
                  {t("Filtres")}{' '}{activeFilters.length > 0 && `(${activeFilters.length})`}
                </span>
                <span className="text-[8px] text-muted">{t("Ouvrir")}</span>
              </summary>
              <div className="border-t border-line px-4 py-4">{filters}</div>
            </details>

            {activeFilters.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-[9px] uppercase tracking-[0.1em] text-muted">{t("Filtres actifs")}</span>
                {activeFilters.map((filter) => (
                  <Link
                    key={filter.label}
                    href={filter.href}
                    className="group inline-flex items-center gap-1.5 border border-sea/20 bg-sea/[0.04] px-2.5 py-1.5 text-[10px] text-sea transition-colors hover:border-clay/30 hover:text-clay"
                  >
                    {filter.label}
                    <X className="h-2.5 w-2.5 opacity-50 group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            )}

            {works.length === 0 ? (
              <div className="mt-8 flex flex-col items-center border border-line bg-parchment px-6 py-16 text-center">
                <ZelligeStar className="h-10 w-10 text-brass/70" strokeWidth={0.9} />
                <h2 className="mt-5 font-display text-[1.9rem] leading-none tracking-[-0.02em] text-ink">
                  {t("Aucun livre ne correspond.")}{' '}</h2>
                <p className="mt-3 max-w-md text-[12px] leading-relaxed text-muted">
                  {t("Essayez un autre terme, élargissez la wilaya ou retirez un filtre. Le catalogue s’enrichit chaque semaine.")}{' '}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/recherche"
                    className="bg-sea px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-sea-deep"
                  >
                    {t("Réinitialiser")}{' '}</Link>
                  <Link
                    href="/secondhand"
                    className="border border-line px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-clay hover:text-clay"
                  >
                    {t("Voir l’occasion")}{' '}</Link>
                </div>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 xl:grid-cols-3">
                {works.map((work, index) => (
                  <BookCard key={work.id} work={work} eager={index < 3} />
                ))}
              </div>
            )}

            <div className="mt-14 flex flex-col items-center gap-4 border-t border-line pt-8 text-center">
              <ZelligeStar className="h-4 w-4 text-brass/70" />
              <p className="max-w-md text-[11px] leading-relaxed text-muted">
                {t("Vous ne trouvez pas le livre que vous cherchez ? Les librairies du réseau peuvent le commander pour vous.")}{' '}</p>
              <Link
                href="/libraries"
                className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-sea underline-offset-4 hover:text-clay hover:underline"
              >
                {t("Trouver une librairie près de chez moi")}{' '}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-[8.5px] font-bold uppercase tracking-label text-sea">{title}</h2>
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
      {active && <ZelligeStar className="h-2.5 w-2.5 text-clay" />}
    </Link>
  );
}
