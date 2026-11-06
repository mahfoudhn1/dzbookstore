import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  MapPin,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import { fetchAuthors, fetchBookstores, fetchCategories, fetchOffers, fetchWorks } from '@/lib/api';
import type { Work } from '@/lib/types';
import { authorNames, cn, dedupeWorks, formatNumber, formatPrice, getLocalizedCategory, getLocalizedCondition, getLocalizedWilaya, initials, normalizeCondition, pluralize } from '@/lib/utils';
import { SearchBar } from '@/components/SearchBar';
import { BookCard } from '@/components/books/BookCard';
import { BookCover } from '@/components/books/BookCover';
import { getT } from '@/lib/i18n/server';
import {
  ArchFrame,
  SectionHeading,
  ZelligeDivider,
  ZelligeDiamond,
  ZelligeField,
  ZelligeStar,
} from '@/components/ui/Ornaments';

export const dynamic = 'force-dynamic';

const MAP_CITIES = [
  { id: 16, name: 'Alger', x: 340.6, y: 11.8, anchor: 'end', dx: -8, dy: 17 },
  { id: 31, name: 'Oran', x: 233.5, y: 48.7, anchor: 'start', dx: 8, dy: 18 },
  { id: 25, name: 'Constantine', x: 443.8, y: 25.9, anchor: 'start', dx: 8, dy: 18 },
  { id: 47, name: 'Ghardaïa', x: 358.4, y: 158.9, anchor: 'start', dx: 8, dy: 5 },
  { id: 11, name: 'Tamanrasset', x: 412, y: 492.2, anchor: 'start', dx: 10, dy: 5 },
] as const;

const ALGERIA_PATH =
  'M600.0,468.5 L500.6,533.9 L416.6,601.3 L375.7,616.6 L343.5,620.0 L343.2,598.2 L329.8,592.6 L311.7,582.8 L304.8,566.7 L207.0,491.8 L109.1,416.9 L0.0,333.8 L0.6,327.1 L0.5,324.8 L0.3,284.1 L47.1,258.8 L76.1,253.6 L99.9,244.3 L110.9,227.2 L144.9,213.6 L146.1,188.2 L162.9,185.2 L176.0,172.5 L214.0,166.7 L219.3,153.3 L211.7,146.0 L201.6,109.8 L199.9,88.9 L189.0,66.9 L216.9,48.2 L248.2,42.2 L266.5,28.0 L294.5,17.6 L343.6,11.5 L391.6,8.7 L406.2,13.8 L433.6,0.3 L464.6,0.0 L476.4,8.0 L496.2,5.9 L490.3,23.5 L494.9,56.2 L488.1,84.6 L470.2,103.7 L472.7,129.6 L496.5,150.0 L496.7,158.3 L514.6,172.2 L527.0,233.8 L536.4,264.1 L537.9,280.1 L532.8,308.1 L534.9,323.7 L531.2,342.5 L533.8,364.1 L522.3,378.4 L539.4,403.5 L540.5,418.2 L550.8,437.3 L564.4,431.0 L587.3,447.0 L600.0,468.5 Z';

export default async function HomePage() {
  const { t, locale } = await getT();
  const [rawWorks, bookstores, categories, authors, allOffers] = await Promise.all([
    fetchWorks(),
    fetchBookstores(),
    fetchCategories(),
    fetchAuthors(),
    fetchOffers(),
  ]);

  const works = dedupeWorks(rawWorks).sort((a, b) => (a.min_price ?? 99999) - (b.min_price ?? 99999));

  // Dynamic selection for « كتب مختارة » (Approach A/C):
  // 1. Pick works marked as featured in Django Admin
  const adminFeatured = works.filter((work) => Boolean(work.featured));
  // 2. If fewer than 3, fill with works having active bookstore offers from distinct libraries
  const withOffers = works.filter((work) => !work.featured && (work.offers_count ?? 0) > 0);
  const others = works.filter((work) => !work.featured && (work.offers_count ?? 0) === 0);

  const heroPool = [...adminFeatured, ...withOffers, ...others];
  const seenHeroIds = new Set<number>();
  const heroCovers: Work[] = [];
  for (const w of heroPool) {
    if (!seenHeroIds.has(w.id)) {
      seenHeroIds.add(w.id);
      heroCovers.push(w);
      if (heroCovers.length === 3) break;
    }
  }

  const featured = heroCovers[0] ?? works[0];
  const secondaryWorks = works.filter((work) => work.id !== featured?.id).slice(0, 4);
  const recentWorks = [...works].sort((a, b) => b.id - a.id).slice(0, 4);
  const usedOffers = allOffers.filter((offer) => offer.seller_type === 'INDIVIDUAL').slice(0, 3);

  const totalOffers = works.reduce((sum, work) => sum + (work.offers_count ?? 0), 0);
  const cheapest = works.reduce<number | null>(
    (min, work) => (work.min_price && (min === null || work.min_price < min) ? work.min_price : min),
    null,
  );

  const categoryCounts = categories.map((category) => ({
    ...category,
    count: works.filter((work) => work.categories?.some((item) => item.id === category.id)).length,
  }));

  const wilayaStats = new Map<number, { stores: number; offers: number }>();
  for (const store of bookstores) {
    const current = wilayaStats.get(store.wilaya_id) ?? { stores: 0, offers: 0 };
    current.stores += 1;
    wilayaStats.set(store.wilaya_id, current);
  }
  for (const offer of allOffers) {
    const wilayaId = Number(offer.seller_wilaya_code);
    if (!wilayaId) continue;
    const current = wilayaStats.get(wilayaId) ?? { stores: 0, offers: 0 };
    current.offers += 1;
    wilayaStats.set(wilayaId, current);
  }

  const cityRows = MAP_CITIES.map((city) => ({
    ...city,
    stats: wilayaStats.get(city.id) ?? { stores: 0, offers: 0 },
  }));

  const authorWorks = new Map<string, number>();
  for (const work of works) {
    for (const author of work.authors ?? []) {
      authorWorks.set(author.slug, (authorWorks.get(author.slug) ?? 0) + 1);
    }
  }

  return (
    <div className="overflow-x-clip">
      {/* ————————————————————————————————————————————————
          HERO — a contemporary riad: ivory wall, deep blue arch,
          a small constellation of book covers.
          ———————————————————————————————————————————————— */}
      <section className="relative overflow-hidden bg-ivory">
        <div aria-hidden className="pointer-events-none absolute inset-0 paper-grain opacity-60" />
        <ZelligeStar
          className="pointer-events-none absolute -right-16 top-16 h-72 w-72 text-sea/[0.045] sm:h-96 sm:w-96"
          strokeWidth={0.5}
        />
        <ZelligeField className="pointer-events-none absolute right-0 top-0 h-full w-1/2 text-sea" opacity={0.035} />

        <div className="relative mx-auto grid max-w-[1440px] gap-14 px-4 pb-14 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:gap-8 lg:px-10 lg:pb-20 lg:pt-16">
          <div className="relative z-10 max-w-[650px]">
            <div className="animate-fade-up flex items-center gap-3">
              <ZelligeStar className="h-4 w-4 text-clay" />
              <p className="text-[9.5px] font-semibold uppercase tracking-label text-clay">
                {t("La librairie ouverte d’Algérie")}{' '}</p>
              <span className="h-px w-8 bg-clay/30" />
              <p className="font-arabic text-[15px] leading-none text-muted" dir="rtl">
                مكتبة الجزائر
              </p>
            </div>

            <h1 className="animate-fade-up delay-1 mt-6 max-w-[680px] text-balance font-display text-[2.85rem] leading-[0.97] tracking-[-0.045em] text-ink sm:text-[4.1rem] lg:text-[4.55rem] xl:text-[5rem]">
              {t("Lire l’Algérie,")}{' '}<span className="block italic text-clay">{t("du rayon au lecteur.")}</span>
            </h1>

            <p className="animate-fade-up delay-2 mt-6 max-w-xl text-[13.5px] leading-relaxed text-ink-soft/80 sm:text-[14.5px]">
              {t("Tous les livres, toutes les éditions, toutes les offres. Comparez les prix des librairies indépendantes et des lecteurs des 58 wilayas — puis choisissez votre manière de recevoir le livre.")}{' '}</p>

            <div className="animate-fade-up delay-3 mt-8 max-w-[660px]">
              <SearchBar
                suggestions={[
                  { label: 'Kateb Yacine', href: '/recherche?q=Kateb%20Yacine' },
                  { label: 'Malek Bennabi', href: '/recherche?q=Malek%20Bennabi' },
                  { label: 'Littérature algérienne', href: '/recherche?category=litterature-algerienne' },
                  { label: 'Occasion', href: '/secondhand' },
                ]}
              />
            </div>

            <div className="animate-fade-up delay-4 mt-8 grid grid-cols-3 divide-x divide-line border-t border-line/90 pt-6">
              <div className="pr-3">
                <p className="font-display text-[1.65rem] leading-none text-sea">{bookstores.length}</p>
                <p className="mt-2 text-[8px] font-semibold uppercase tracking-[0.11em] text-muted">
                  {t("Librairies vérifiées")}{' '}</p>
              </div>
              <div className="px-3 sm:px-5">
                <p className="font-display text-[1.65rem] leading-none text-sea">{formatNumber(totalOffers)}</p>
                <p className="mt-2 text-[8px] font-semibold uppercase tracking-[0.11em] text-muted">
                  {t("Offres en ligne")}{' '}</p>
              </div>
              <div className="pl-3 sm:pl-5">
                <p className="font-display text-[1.65rem] leading-none text-sea">58</p>
                <p className="mt-2 text-[8px] font-semibold uppercase tracking-[0.11em] text-muted">
                  {t("Wilayas couvertes")}{' '}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[9.5px] text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-brass" />
              {t("Vendeurs vérifiés · paiement en dinars · retrait en librairie")}{' '}</div>
          </div>

          {/* The arch */}
          <div className="relative mx-auto w-full max-w-[520px] lg:mx-0 lg:ml-auto">
            <div
              aria-hidden
              className="absolute -left-8 top-16 hidden h-40 w-px bg-gradient-to-b from-transparent via-brass/60 to-transparent lg:block"
            />
            <div
              aria-hidden
              className="absolute -left-12 top-16 hidden -translate-x-1/2 text-[8px] uppercase tracking-[0.35em] text-muted/60 lg:block"
              style={{ writingMode: 'vertical-rl' }}
            >
              {t("Sélection · Automne 2026")}{' '}</div>

            <ArchFrame
              id="hero-arch"
              className="animate-fade-up delay-2 relative mx-auto h-[455px] w-[88%] max-w-[430px] sm:h-[565px]"
              padding="p-[7px]"
            >
              <div className="absolute inset-0 bg-sea" />
              <ZelligeField className="text-ivory" opacity={0.08} />
              <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sea-deep/55 to-transparent" />

              <div className="relative flex h-full flex-col justify-between p-5 sm:p-7">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-kufi text-[8px] tracking-[0.22em] text-brass-light/80">{t("MUKHTARAT")}</p>
                    <p className="mt-1 font-arabic text-[1.25rem] leading-none text-ivory/85" dir="rtl">
                      مختارات
                    </p>
                  </div>
                  <ZelligeStar className="h-6 w-6 text-brass-light/80" strokeWidth={0.8} />
                </div>

                <div className="relative flex-1">
                  {heroCovers[1] && (
                    <Link
                      href={`/books/${heroCovers[1].slug}`}
                      className="group/hero1 absolute left-[2%] top-[47%] z-10 block w-[38%] -rotate-[9deg] opacity-95 transition-all duration-300 hover:z-30 hover:scale-105 hover:opacity-100"
                      title={heroCovers[1].title}
                    >
                      <BookCover
                        src={heroCovers[1].cover_image}
                        title={heroCovers[1].title}
                        author={authorNames(heroCovers[1], locale, t)}
                        arabicTitle={heroCovers[1].original_title}
                        className="shadow-2xl"
                        eager
                      />
                    </Link>
                  )}
                  {heroCovers[2] && (
                    <Link
                      href={`/books/${heroCovers[2].slug}`}
                      className="group/hero2 absolute right-[1%] top-[50%] z-10 block w-[38%] rotate-[8deg] transition-all duration-300 hover:z-30 hover:scale-105"
                      title={heroCovers[2].title}
                    >
                      <BookCover
                        src={heroCovers[2].cover_image}
                        title={heroCovers[2].title}
                        author={authorNames(heroCovers[2], locale, t)}
                        arabicTitle={heroCovers[2].original_title}
                        className="shadow-2xl"
                        eager
                      />
                    </Link>
                  )}
                  {heroCovers[0] && (
                    <Link
                      href={`/books/${heroCovers[0].slug}`}
                      className="group/hero0 absolute left-1/2 top-[46%] z-20 block w-[52%] -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:z-30 hover:scale-105"
                      title={heroCovers[0].title}
                    >
                      <BookCover
                        src={heroCovers[0].cover_image}
                        title={heroCovers[0].title}
                        author={authorNames(heroCovers[0], locale, t)}
                        arabicTitle={heroCovers[0].original_title}
                        className="shadow-2xl"
                        eager
                      />
                    </Link>
                  )}

                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-ivory/15 pt-3">
                    <span className="text-[8px] uppercase tracking-[0.18em] text-ivory/50">
                      {t("La sélection de la maison")}{' '}</span>
                    <span className="font-arabic text-[13px] text-brass-light/80" dir="rtl">
                      كتب مختارة
                    </span>
                  </div>
                </div>
              </div>
            </ArchFrame>

            <div className="relative z-20 -mt-6 ml-0 w-[240px] border border-line bg-parchment p-4 shadow-[0_24px_60px_-36px_rgba(14,52,68,0.55)] sm:-mt-8 sm:ml-2">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-semibold uppercase tracking-label text-muted">{t("Le comparateur")}</span>
                <ZelligeStar className="h-3 w-3 text-brass" />
              </div>
              <p className="mt-2 font-display text-[1.35rem] leading-none text-sea">
                {formatPrice(cheapest)}
                <span className="ml-1 font-sans text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                  {t("dès")}{' '}</span>
              </p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                {featured?.offers_count ?? totalOffers} {t("offres comparées, livraison dans tout le pays.")}{' '}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust rail */}
      <section id="livraison" aria-label={t("Nos engagements")} className="border-y border-line bg-parchment">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x divide-line/80 px-4 sm:px-6 lg:grid-cols-4 lg:px-10">
          {[
            { icon: Store, title: 'Librairies vérifiées', text: 'Des maisons de quartier, authentifiées.' },
            { icon: Truck, title: 'Retrait ou livraison', text: 'Yalidine, ZR Express ou au comptoir.' },
            { icon: ShieldCheck, title: 'Paiement en dinars', text: 'À la livraison ou en librairie.' },
            { icon: MapPin, title: 'Les 58 wilayas', text: 'Du littoral au grand Sud.' },
          ].map((item, index) => (
            <div
              key={item.title}
              className={cn(
                'flex items-start gap-3 px-3 py-5 sm:px-5 lg:py-6',
                index === 2 && 'border-t border-line lg:border-t-0',
                index === 3 && 'border-t border-line lg:border-t-0',
              )}
            >
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-brass" strokeWidth={1.5} />
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-ink">{item.title}</p>
                <p className="mt-1 text-[10.5px] leading-snug text-muted">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ————————————————————————————————————————————————
          FEATURED — one editorial lead, four companions
          ———————————————————————————————————————————————— */}
      <section id="catalogue" className="relative mx-auto max-w-[1440px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
        <SectionHeading
          eyebrow={t("La sélection de la maison")}
          title={t("Des livres qui nous rassemblent.")}
          arabic="مختاراتنا"
          description={t("Les œuvres qui font la conversation en Algérie — classiques fondateurs, voix contemporaines et pensées qui traversent les générations.")}
          href="/recherche"
          action={t("Tout le catalogue")}
        />

        <div className="mt-10">
          {featured && (
            <article className="relative overflow-hidden bg-sea text-ivory">
              <ZelligeField className="text-ivory" opacity={0.07} />
              <div className="relative grid gap-7 p-6 sm:grid-cols-[200px_1fr] sm:items-center sm:gap-8 sm:p-8 lg:grid-cols-[240px_1fr_200px] lg:gap-10 lg:p-10 xl:grid-cols-[240px_1fr_240px]">
                <Link href={`/books/${featured.slug}`} className="group mx-auto block w-[58%] max-w-[220px] sm:mx-0 sm:w-full">
                  <BookCover
                    src={featured.cover_image}
                    title={featured.title}
                    author={authorNames(featured, t)}
                    arabicTitle={featured.original_title}
                    className="transition-transform duration-500 group-hover:-translate-y-2"
                    eager
                  />
                </Link>

                <div>
                  <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.18em] text-ivory/50">
                    <span>{t("Le grand choix · N° 01")}</span>
                    <ZelligeStar className="h-4 w-4 text-brass-light/80" />
                  </div>

                  <p className="mt-5 text-[8.5px] font-semibold uppercase tracking-label text-brass-light">
                    {featured.categories?.[0] ? getLocalizedCategory(featured.categories[0], locale) : t('Littérature')}
                  </p>
                  <Link href={`/books/${featured.slug}`}>
                    <h3 className="mt-2 max-w-xl font-display text-[2rem] leading-[1.02] tracking-[-0.03em] text-ivory transition-colors hover:text-brass-light sm:text-[2.5rem]">
                      {featured.title}
                    </h3>
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {featured.original_title && (
                      <p className="font-arabic text-lg text-ivory/55" dir="rtl">
                        {featured.original_title}
                      </p>
                    )}
                    <p className="text-[11px] italic text-ivory/65">{t("par")}{' '}{authorNames(featured, locale, t)}</p>
                  </div>
                  <p className="mt-4 max-w-xl line-clamp-3 text-[11.5px] leading-relaxed text-ivory/60">
                    {featured.synopsis}
                  </p>

                  <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-ivory/15 pt-5">
                    <div className="flex items-end gap-6">
                      <div>
                        <p className="text-[8px] uppercase tracking-label text-ivory/50">{t("Dès")}</p>
                        <p className="mt-1 text-lg font-bold text-ivory">{formatPrice(featured.min_price, locale)}</p>
                      </div>
                      <p className="pb-1 text-[9.5px] text-ivory/50">
                        {featured.offers_count} {t(pluralize(featured.offers_count ?? 0, 'offre'))} ·{' '}
                        {featured.bookstores_count} {t(pluralize(featured.bookstores_count ?? 0, 'librairie'))}
                      </p>
                    </div>
                    <Link
                      href={`/books/${featured.slug}`}
                      className="group inline-flex items-center gap-2 border border-ivory/25 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:border-brass-light hover:text-brass-light"
                    >
                      {t("Voir l’ouvrage")}{' '}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>

                <div className="hidden flex-col items-end justify-between border-l border-ivory/15 pl-8 lg:flex">
                  <ZelligeStar className="h-5 w-5 text-brass-light/50" strokeWidth={0.9} />
                  <p className="text-right font-arabic text-[2.1rem] leading-[1.45] text-ivory/40" dir="rtl">
                    كل<br />
                    كتاب<br />
                    حكاية
                  </p>
                  <div className="text-right">
                    <ZelligeDivider className="ml-auto w-20" tone="ivory" />
                    <p className="mt-3 text-[7px] uppercase tracking-[0.18em] text-ivory/35">
                      {t("Chaque livre")}{' '}<br />
                      {t("est une histoire")}{' '}</p>
                  </div>
                </div>
              </div>
            </article>
          )}

          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4 lg:gap-y-8">
            {secondaryWorks.map((work, index) => (
              <BookCard key={work.id} work={work} eager={index === 0} />
            ))}
          </div>
        </div>
      </section>

      {/* ————————————————————————————————————————————————
          RAYONS — categories as typographic tiles
          ———————————————————————————————————————————————— */}
      <section id="rayons" className="border-y border-line bg-ivory-deep/45">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
          <SectionHeading
            eyebrow={t("Les rayons")}
            title={t("Un pays, plusieurs bibliothèques.")}
            arabic="الأقسام"
            description={t("Littérature, histoire, pensée, sciences humaines et vie pratique : entrez par le sujet qui vous appelle.")}
          />

          <div className="mt-10 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-6">
            <Link
              href="/recherche"
              className="group relative flex min-h-[190px] flex-col justify-between overflow-hidden bg-sea p-5 text-ivory sm:p-6"
            >
              <ZelligeField className="text-ivory" opacity={0.08} />
              <div className="relative flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-label text-ivory/55">{t("Tous les rayons")}</span>
                <ArrowUpRight className="h-4 w-4 text-brass-light transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
              <div className="relative">
                <h3 className="font-display text-[1.6rem] leading-[1.02] tracking-[-0.02em]">
                  {t("Parcourir")}{' '}<br />
                  {t("le catalogue")}{' '}</h3>
                <p className="mt-2 font-arabic text-lg text-brass-light/80" dir="rtl">
                  كل الكتب
                </p>
              </div>
            </Link>

            {categoryCounts.map((category, index) => (
              <Link
                key={category.id}
                href={`/recherche?category=${category.slug}`}
                className="group flex min-h-[190px] flex-col justify-between bg-parchment p-5 transition-colors hover:bg-ivory sm:p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-[10px] text-brass">0{index + 1}</span>
                  <ZelligeStar className="h-3.5 w-3.5 text-sea/25 transition-colors group-hover:text-clay" />
                </div>
                <div className="mt-8">
                  <h3 className="font-display text-[1.35rem] leading-[1.05] tracking-[-0.02em] text-ink transition-colors group-hover:text-sea">
                    {getLocalizedCategory(category, locale)}
                  </h3>
                  {locale !== 'ar' && category.name_ar && (
                    <p className="mt-1.5 font-arabic text-[15px] leading-none text-clay/80" dir="rtl">
                      {category.name_ar}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between border-t border-line/80 pt-3 text-[9.5px] text-muted">
                    <span>
                      {category.count} {t(pluralize(category.count, 'titre'))}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-clay transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ————————————————————————————————————————————————
          LIBRAIRIES — the human network, on blue
          ———————————————————————————————————————————————— */}
      <section id="librairies" className="relative overflow-hidden bg-sea py-16 sm:py-20 lg:py-24">
        <ZelligeField className="text-ivory" opacity={0.055} />
        <ZelligeStar className="pointer-events-none absolute -left-20 top-10 h-64 w-64 text-ivory/[0.04]" strokeWidth={0.6} />
        <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <SectionHeading
            eyebrow={t("Les maisons du livre")}
            title={t("Des librairies avec une adresse.")}
            arabic="المكتبات"
            description={t("Derrière chaque offre, une maison, un comptoir, un libraire. Retrouvez les librairies indépendantes qui font vivre le livre en Algérie.")}
            href="/libraries"
            action={t("Toutes les librairies")}
            tone="dark"
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {bookstores.slice(0, 4).map((store) => (
              <Link
                key={store.id}
                href={`/libraries/${store.slug}`}
                className="group flex flex-col justify-between border border-ivory/12 bg-ivory/[0.035] p-5 transition-colors hover:border-brass-light/40 hover:bg-ivory/[0.06]"
              >
                <div>
                  <div className="flex items-start gap-4">
                    <ArchFrame
                      id={`store-arch-${store.id}`}
                      className="h-[68px] w-[56px] shrink-0"
                      padding="p-[2px]"
                    >
                      {store.logo_url && !store.logo_url.includes('images.unsplash.com') ? (
                        <img src={store.logo_url} alt={`Logo de ${store.store_name}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-sea-soft">
                          <ZelligeField className="text-brass" opacity={0.18} size="sm" />
                          <span className="relative font-display text-lg text-ivory">
                            {initials(store.store_name)}
                          </span>
                        </div>
                      )}
                    </ArchFrame>
                    <div className="min-w-0">
                      {store.is_verified && (
                        <span className="mb-1.5 inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-brass-light">
                          <ShieldCheck className="h-2.5 w-2.5" /> {t("Vérifiée")}{' '}</span>
                      )}
                      <h3 className="font-display text-[1.18rem] leading-[1.08] text-ivory transition-colors group-hover:text-brass-light">
                        {store.store_name}
                      </h3>
                      <p className="mt-1.5 flex items-center gap-1 text-[9.5px] text-ivory/55">
                        <MapPin className="h-2.5 w-2.5 text-clay/80" />
                        {store.wilaya_code} · {getLocalizedWilaya(store, locale)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 line-clamp-3 text-[10.5px] leading-relaxed text-ivory/62">
                    {store.description}
                  </p>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-ivory/10 pt-3 text-[9px] uppercase tracking-[0.1em] text-ivory/50">
                  <span>{store.offers_count} {t(pluralize(store.offers_count, 'titre'))} {t("en rayon")}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-brass-light/70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ————————————————————————————————————————————————
          NEW & SECONDHAND — editorial split
          ———————————————————————————————————————————————— */}
      <section id="nouveautes" className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
          <div>
            <SectionHeading
              eyebrow={t("Nouveautés")}
              title={t("Derniers entrés au catalogue.")}
              arabic="وصل حديثاً"
              description={t("Les ouvrages qui viennent d’arriver chez nos libraires et nos lecteurs.")}
              href="/recherche"
              action={t("Explorer")}
            />

            <div className="mt-8 border-t border-line">
              {recentWorks.map((work, index) => (
                <Link
                  key={work.id}
                  href={`/books/${work.slug}`}
                  className="group grid grid-cols-[28px_62px_1fr_auto] items-center gap-3 border-b border-line/80 py-4 transition-colors hover:bg-parchment sm:grid-cols-[34px_70px_1fr_auto] sm:gap-5"
                >
                  <span className="font-display text-[11px] text-brass">0{index + 1}</span>
                  <BookCover
                    src={work.cover_image}
                    title={work.title}
                    author={authorNames(work, locale, t)}
                    className="w-full"
                  />
                  <div className="min-w-0">
                    <p className="text-[8px] font-semibold uppercase tracking-label text-clay">
                      {work.categories?.[0] ? getLocalizedCategory(work.categories[0], locale) : t('Catalogue')}
                    </p>
                    <h3 className="mt-1 truncate font-display text-[1.25rem] leading-none tracking-[-0.02em] text-ink transition-colors group-hover:text-sea sm:text-[1.45rem]">
                      {work.title}
                    </h3>
                    <p className="mt-1.5 truncate text-[10.5px] text-muted">{authorNames(work, locale, t)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden text-right sm:block">
                      <p className="text-[8px] uppercase tracking-label text-muted/70">{t("Dès")}</p>
                      <p className="text-[12px] font-bold text-sea">{formatPrice(work.min_price, locale)}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-clay" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <aside className="relative flex flex-col overflow-hidden border border-line bg-ivory-deep/70">
            <div className="absolute inset-x-0 top-0 h-[3px] bg-clay" />
            <ZelligeField className="text-clay" opacity={0.05} />
            <div className="relative flex flex-1 flex-col p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-label text-clay">
                  <Sparkles className="h-3 w-3" />
                  {t("Le marché de l’occasion")}{' '}</div>
                <span className="font-arabic text-base text-clay/60" dir="rtl">
                  كتب مستعملة
                </span>
              </div>
              <h2 className="mt-4 font-display text-[2rem] leading-[1.02] tracking-[-0.03em] text-ink">
                {t("Une seconde vie")}{' '}<br />
                {t("pour chaque livre.")}{' '}</h2>
              <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
                {t("Des exemplaires photographiés, décrits et vendus par des lecteurs, à quelques rues ou quelques wilayas de vous.")}{' '}</p>

              <div className="mt-6 flex-1">
                {usedOffers.length === 0 ? (
                  <p className="border-t border-line py-6 text-[11px] text-muted">
                    {t("Les premières annonces arrivent bientôt.")}{' '}</p>
                ) : (
                  usedOffers.map((offer) => (
                    <Link
                      key={offer.id}
                      href={`/books/${offer.work_slug}`}
                      className="group flex items-center gap-3 border-t border-clay/15 py-3.5"
                    >
                      <BookCover
                        src={offer.photos?.[0] || offer.work_cover}
                        title={offer.work_title}
                        author={offer.seller_name}
                        className="w-[42px] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-clay">
                          {getLocalizedCondition(offer.condition, locale, t)}
                        </p>
                        <h3 className="mt-1 truncate font-display text-[1.05rem] leading-none text-ink transition-colors group-hover:text-clay">
                          {offer.work_title}
                        </h3>
                        <p className="mt-1.5 flex items-center gap-1 text-[9px] text-muted">
                          <MapPin className="h-2.5 w-2.5" />
                          {getLocalizedWilaya({ wilaya_name_fr: offer.seller_wilaya_name, seller_wilaya_name_ar: offer.seller_wilaya_name_ar, seller_wilaya_name_en: offer.seller_wilaya_name_en }, locale)}
                        </p>
                      </div>
                      <p className="font-sans text-[12px] font-bold text-sea">{formatPrice(offer.price, locale)}</p>
                    </Link>
                  ))
                )}
              </div>

              <Link
                href="/secondhand"
                className="group mt-5 flex items-center justify-between border border-ink/15 px-4 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-clay hover:text-clay"
              >
                {t("Explorer l’occasion")}{' '}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* ————————————————————————————————————————————————
          AUTHORS — voices, not headshots
          ———————————————————————————————————————————————— */}
      <section id="auteurs" className="border-y border-line bg-parchment">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-end">
            <SectionHeading
              eyebrow={t("Les voix")}
              title={t("Les auteurs qui habitent nos rayons.")}
              arabic="أصوات جزائرية"
              description={t("Une littérature qui pense, raconte et déplace. Découvrez les plumes les plus présentes dans le catalogue.")}
              href="/recherche"
              action={t("Tous les auteurs")}
            />
            <div className="relative hidden overflow-hidden border-l border-line pl-8 lg:block">
              <p className="font-arabic text-[1.6rem] leading-[1.8] text-sea/80" dir="rtl">
                « الكتاب ذاكرة الأمة،<br />
                والقراءة وطن ثانٍ. »
              </p>
              <p className="mt-3 text-[9px] uppercase tracking-label text-muted">
                {t("Une littérature, trois langues, une même mémoire.")}{' '}</p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {authors.slice(0, 5).map((author) => (
              <Link
                key={author.id}
                href={`/recherche?q=${encodeURIComponent(author.name)}`}
                className="group flex flex-col items-center text-center"
              >
                <div className="relative flex h-[104px] w-[104px] items-center justify-center overflow-hidden rounded-full border border-brass/35 transition-colors group-hover:border-clay/60 sm:h-[122px] sm:w-[122px]">
                  <ZelligeField className="text-brass" opacity={0.25} size="sm" />
                  <span className="relative font-display text-[2rem] tracking-[-0.03em] text-sea">
                    {initials(author.name)}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-[1.25rem] leading-none tracking-[-0.02em] text-ink transition-colors group-hover:text-clay">
                  {author.name}
                </h3>
                {author.name_ar && (
                  <p className="mt-1.5 font-arabic text-[14px] leading-none text-muted" dir="rtl">
                    {author.name_ar}
                  </p>
                )}
                <p className="mt-2 text-[8.5px] uppercase tracking-label text-muted/65">
                  {authorWorks.get(author.slug) ?? 1} {t(pluralize(authorWorks.get(author.slug) ?? 1, 'ouvrage'))}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ————————————————————————————————————————————————
          GEOGRAPHY — a drawn map of the country
          ———————————————————————————————————————————————— */}
      <section id="wilayas" className="relative overflow-hidden bg-sand/45">
        <ZelligeField className="text-sea" opacity={0.035} />
        <div className="relative mx-auto grid max-w-[1440px] gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-20 lg:px-10 lg:py-24">
          <div className="relative order-2 lg:order-1">
            <div className="relative mx-auto max-w-[520px]">
              <div className="pointer-events-none absolute -left-4 top-0 font-display text-[9rem] leading-none text-sea/[0.045] sm:text-[12rem]">
                58
              </div>
              <svg
                viewBox="-12 -32 624 692"
                role="img"
                aria-label={t("Carte de l’Algérie avec les villes où trouver des livres")}
                className="relative h-auto w-full"
              >
                <defs>
                  <pattern id="map-dots" width="11" height="11" patternUnits="userSpaceOnUse">
                    <circle cx="1.4" cy="1.4" r="1.05" fill="#0e3444" opacity=".2" />
                  </pattern>
                </defs>
                <path
                  d={ALGERIA_PATH}
                  fill="url(#map-dots)"
                  stroke="#0e3444"
                  strokeOpacity=".5"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                {cityRows.map((city) => (
                  <a key={city.id} href={`/recherche?wilaya_id=${city.id}`} aria-label={`Livres à ${city.name}`}>
                    <title>{city.name}</title>
                    <circle cx={city.x} cy={city.y} r="13" fill="#b4512f" opacity=".12" className="transition-opacity hover:opacity-25" />
                    <circle cx={city.x} cy={city.y} r="3.6" fill="#b4512f" stroke="#f7f2e7" strokeWidth="1.6" />
                    <text
                      x={city.x + city.dx}
                      y={city.y + city.dy}
                      textAnchor={city.anchor}
                      fill="#201e19"
                      fontSize="10.5"
                      fontFamily="var(--font-manrope), sans-serif"
                      fontWeight="600"
                      letterSpacing=".02em"
                    >
                      {city.name}
                    </text>
                  </a>
                ))}
              </svg>
              <p className="mt-3 text-center text-[8px] uppercase tracking-[0.18em] text-muted/60 lg:text-left">
                {t("Les villes où le catalogue est déjà vivant")}{' '}</p>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <SectionHeading
              eyebrow={t("Le livre près de chez vous")}
              title={t("Un catalogue à l’échelle du pays.")}
              arabic="قريب منك"
              description={t("Choisissez votre wilaya pour voir les librairies, les offres et les possibilités de retrait autour de vous.")}
            />

            <div className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2">
              {cityRows.slice(0, 6).map((city) => {
                const live = city.stats.stores + city.stats.offers > 0;
                return (
                  <Link
                    key={city.id}
                    href={`/recherche?wilaya_id=${city.id}`}
                    className="group flex items-center justify-between bg-parchment px-4 py-4 transition-colors hover:bg-ivory"
                  >
                    <div>
                      <p className="font-display text-[1.1rem] leading-none text-ink transition-colors group-hover:text-clay">
                        {city.name}
                      </p>
                      <p className="mt-1.5 text-[8.5px] uppercase tracking-[0.1em] text-muted/70">
                        {live
                          ? `${city.stats.stores} ${t(pluralize(city.stats.stores, 'librairie'))} · ${city.stats.offers} ${t(pluralize(city.stats.offers, 'offre'))}`
                          : 'Catalogue en déploiement'}
                      </p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-clay" />
                  </Link>
                );
              })}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[10.5px]">
              <Link
                href="/recherche"
                className="group inline-flex items-center gap-2 border-b border-ink/20 pb-1 font-semibold uppercase tracking-[0.1em] text-ink transition-colors hover:border-clay hover:text-clay"
              >
                {t("Les 58 wilayas")}{' '}<ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/libraries" className="text-muted underline-offset-4 hover:text-sea hover:underline">
                {t("Voir l’annuaire des librairies")}{' '}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ————————————————————————————————————————————————
          MANIFESTO / SELLER CTA
          ———————————————————————————————————————————————— */}
      <section id="manifeste" className="relative overflow-hidden bg-clay text-ivory">
        <ZelligeField className="text-ivory" opacity={0.07} />
        <ZelligeStar className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 text-ivory/[0.05]" strokeWidth={0.6} />
        <div className="relative mx-auto grid max-w-[1440px] gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-10 lg:py-24">
          <div>
            <div className="flex items-center gap-2.5 text-[9px] font-semibold uppercase tracking-label text-ivory/60">
              <ZelligeDiamond className="h-1.5 w-1.5" />
              {t("Librairies & lecteurs")}{' '}</div>
            <h2 className="mt-4 max-w-2xl font-display text-[2.4rem] leading-[0.98] tracking-[-0.035em] sm:text-[3.3rem] lg:text-[3.8rem]">
              {t("Faites circuler")}{' '}<span className="block italic text-ivory/80">{t("les livres.")}</span>
            </h2>
            <p className="mt-4 max-w-xl text-[12.5px] leading-relaxed text-ivory/70">
              {t("Une librairie à faire connaître, un livre à transmettre ? Rejoignez le réseau et donnez à chaque ouvrage une nouvelle adresse en Algérie.")}{' '}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/sell"
                className="group inline-flex items-center gap-2 bg-ivory px-5 py-3 text-[9.5px] font-bold uppercase tracking-[0.12em] text-clay transition-colors hover:bg-sea hover:text-ivory"
              >
                {t("Vendre un livre")}{' '}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/libraries"
                className="inline-flex items-center gap-2 border border-ivory/30 px-5 py-3 text-[9.5px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:border-ivory hover:bg-ivory/10"
              >
                {t("Devenir libraire")}{' '}</Link>
            </div>
          </div>

          <div className="relative hidden justify-end lg:flex">
            <div className="border border-ivory/20 p-8 text-right">
              <p className="font-arabic text-[3.2rem] leading-[1.2] text-ivory/75" dir="rtl">
                شارك<br />
                كتابك
              </p>
              <ZelligeDivider tone="ivory" className="my-6" />
              <p className="text-[8px] uppercase tracking-[0.2em] text-ivory/50">{t("Partage ton livre")}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
