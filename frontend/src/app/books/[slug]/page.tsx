import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowDown,
  BookOpen,
  Building2,
  ChevronRight,
  FileText,
  Hash,
  Languages,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import { fetchWorkBySlug, fetchWorks } from '@/lib/api';
import {
  authorNames,
  dedupeWorks,
  formatPrice,
  getLocalizedCategory,
  getLocalizedFormat,
  initials,
  pluralize,
} from '@/lib/utils';
import { BookCover } from '@/components/books/BookCover';
import { BookCard } from '@/components/books/BookCard';
import { AddToCartButton } from '@/components/books/AddToCartButton';
import { MessageSellerButton } from '@/components/MessageSellerButton';
import { OfferComparison } from '@/components/books/OfferComparison';
import { SectionHeading, ZelligeDivider, ZelligeField, ZelligeStar } from '@/components/ui/Ornaments';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

const LANGUAGES: Record<string, string> = {
  fr: 'Français',
  ar: 'Arabe',
  en: 'Anglais',
  tamazight: 'Tamazight',
};

export default async function BookDetailPage(props: { params: Promise<{ slug: string }> }) {
  const { t, locale } = await getT();
  const { slug } = await props.params;
  const work = await fetchWorkBySlug(slug);

  if (!work) notFound();

  const offers = work.offers ?? [];
  const editions = work.editions ?? [];
  const primaryEdition = editions[0];
  const cheapest = offers.length ? [...offers].sort((a, b) => a.price - b.price)[0] : null;
  const minPrice = work.min_price ?? cheapest?.price;
  const bookstoreOffers = offers.filter((offer) => offer.seller_type === 'BOOKSTORE');
  const individualOffers = offers.filter((offer) => offer.seller_type === 'INDIVIDUAL');
  const author = work.authors?.[0];
  const language = primaryEdition?.language || LANGUAGES[work.original_language] || work.original_language;
  const isbn = primaryEdition?.isbn13 || primaryEdition?.isbn10;

  const categorySlug = work.categories?.[0]?.slug;
  const relatedRaw = categorySlug ? await fetchWorks({ category: categorySlug }) : [];
  const related = dedupeWorks(relatedRaw)
    .filter((item) => item.id !== work.id)
    .slice(0, 4);

  return (
    <div className="bg-ivory">
      {/* Breadcrumb */}
      <div className="border-b border-line bg-parchment">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 overflow-x-auto px-4 py-4 text-[9px] uppercase tracking-[0.12em] text-muted no-scrollbar sm:px-6 lg:px-10">
          <Link href="/" className="shrink-0 transition-colors hover:text-sea">{t("Accueil")}</Link>
          <ChevronRight className="h-2.5 w-2.5 shrink-0" />
          <Link href="/recherche" className="shrink-0 transition-colors hover:text-sea">{t("Catalogue")}</Link>
          {work.categories?.[0] && (
            <>
              <ChevronRight className="h-2.5 w-2.5 shrink-0" />
              <Link
                href={`/recherche?category=${work.categories[0].slug}`}
                className="shrink-0 transition-colors hover:text-sea"
              >
                {getLocalizedCategory(work.categories[0], locale)}
              </Link>
            </>
          )}
          <ChevronRight className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate text-ink">{work.title}</span>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-ivory">
        <ZelligeField className="pointer-events-none absolute right-0 top-0 h-full w-1/2 text-sea" opacity={0.03} />
        <div className="relative mx-auto grid max-w-[1440px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:py-14">
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="relative mx-auto w-full max-w-[400px] border border-line bg-ivory-deep/55 p-6 sm:p-8">
              <ZelligeField className="text-sea" opacity={0.05} />
              <ZelligeStar className="absolute right-4 top-4 h-5 w-5 text-brass/50" />
              <BookCover
                src={work.cover_image}
                title={work.title}
                author={authorNames(work, locale, t)}
                arabicTitle={work.original_title}
                publisher={primaryEdition?.publisher?.name}
                className="relative mx-auto w-[76%] max-w-[270px]"
                eager
              />
              <div className="relative mt-6 flex items-end justify-between border-t border-line pt-4">
                <div>
                  <p className="text-[8px] uppercase tracking-label text-muted">{t("Édition catalogue")}</p>
                  <p className="mt-1 text-[10px] text-ink-soft">
                    {primaryEdition?.publisher?.name || 'Bookstore.dz'}
                  </p>
                </div>
                <p className="font-arabic text-[15px] text-clay/80" dir="rtl">
                  {work.original_language === 'ar' ? 'النسخة العربية' : 'كتاب'}
                </p>
              </div>
            </div>

            <div className="mx-auto mt-4 flex max-w-[400px] items-center justify-between gap-3 text-[9px] text-muted">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-brass" />
                {t("Vendeurs vérifiés")}{' '}</span>
              <span className="h-3 w-px bg-line" />
              <span className="flex items-center gap-1.5">
                <Truck className="h-3 w-3 text-brass" />
                {t("Livraison 58 wilayas")}{' '}</span>
            </div>
          </div>

          <div className="lg:col-span-7 xl:col-span-8">
            <div className="flex flex-wrap items-center gap-2">
              {work.categories?.map((category) => (
                <Link
                  key={category.id}
                  href={`/recherche?category=${category.slug}`}
                  className="border border-sea/15 bg-sea/[0.035] px-2.5 py-1 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-sea transition-colors hover:border-clay/30 hover:text-clay"
                >
                  {getLocalizedCategory(category, locale)}
                </Link>
              ))}
              {primaryEdition?.format && (
                <span className="border border-line px-2.5 py-1 text-[8.5px] font-medium uppercase tracking-[0.08em] text-muted">
                  {getLocalizedFormat(primaryEdition.format, locale, t)}
                </span>
              )}
            </div>

            <h1 className="mt-5 max-w-[760px] text-[2.7rem] leading-[0.97] tracking-[-0.045em] sm:text-[3.6rem] lg:text-[4.3rem]">
              {work.title}
            </h1>
            {work.original_title && (
              <p className="mt-3 inline-block font-arabic text-[1.45rem] leading-none text-clay/85 sm:text-[1.7rem]" dir="rtl">
                {work.original_title}
              </p>
            )}
            <p className="mt-4 text-[13px] text-muted">
              {t("Par")}{' '}
              <Link
                href={`/recherche?q=${encodeURIComponent(author?.name ?? '')}`}
                className="font-semibold text-ink underline-offset-4 transition-colors hover:text-clay hover:underline"
              >
                {authorNames(work, t)}
              </Link>
            </p>

            <p className="mt-6 max-w-2xl text-[13.5px] leading-[1.85] text-ink-soft/85">
              {work.synopsis}
            </p>

            {/* Buy box */}
            <div className="mt-7 border border-line bg-parchment p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-label text-muted">{t("À partir de")}</p>
                  <p className="mt-1 font-sans text-[2.25rem] font-bold leading-none tracking-tight text-sea">
                    {formatPrice(minPrice)}
                  </p>
                  <p className="mt-2 text-[10.5px] text-muted">
                    {offers.length} {t(pluralize(offers.length, 'offre disponible', 'offres disponibles'))} ·{' '}
                    {bookstoreOffers.length} {t(pluralize(bookstoreOffers.length, 'librairie'))} ·{' '}
                    {individualOffers.length} {t(pluralize(individualOffers.length, 'particulier'))}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AddToCartButton offer={cheapest} label={t("Ajouter le moins cher")} />
                  <MessageSellerButton
                    bookstoreId={cheapest?.bookstore?.id}
                    individualSellerId={cheapest?.individual_seller?.id}
                    label={t("Envoyer un message")}
                    variant="outline"
                  />
                  <Link
                    href="#offres"
                    className="inline-flex items-center justify-center gap-2 border border-ink/20 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-clay hover:text-clay"
                  >
                    {t("Comparer les offres")}{' '}<ArrowDown className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2 border-t border-line pt-4 text-[9.5px] text-muted sm:grid-cols-3">
                <span className="flex items-center gap-1.5">
                  <Store className="h-3 w-3 text-brass" />
                  {t("Retrait gratuit en librairie")}{' '}</span>
                <span className="flex items-center gap-1.5">
                  <Truck className="h-3 w-3 text-brass" />
                  {t("Yalidine & ZR Express")}{' '}</span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-brass" />
                  {t("Paiement à la livraison")}{' '}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Edition facts */}
      <div className="border-b border-line bg-parchment">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
            {[
              { icon: Languages, label: 'Langue', value: language },
              { icon: Building2, label: 'Éditeur', value: primaryEdition?.publisher?.name || '—' },
              { icon: BookOpen, label: 'Édition', value: primaryEdition?.edition_title || (primaryEdition?.publication_year ? `${primaryEdition.publication_year}` : '—') },
              { icon: Hash, label: 'ISBN', value: isbn || '—', mono: true },
              { icon: FileText, label: 'Pages', value: primaryEdition?.page_count ? `${primaryEdition.page_count} pages` : '—' },
              { icon: Sparkles, label: 'Format', value: primaryEdition?.format || '—' },
            ].map((item) => (
              <div key={item.label} className="bg-parchment px-4 py-4 sm:px-5">
                <dt className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted/75">
                  <item.icon className="h-2.5 w-2.5 text-brass" />
                  {item.label}
                </dt>
                <dd className={`mt-1.5 truncate text-[11.5px] text-ink ${item.mono ? 'font-mono text-[10.5px]' : ''}`}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* The work + author */}
      <section className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 sm:py-16 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.45fr_1fr] lg:gap-20">
          <div>
            <div className="flex items-center gap-2.5 text-[9px] font-semibold uppercase tracking-label text-clay">
              <ZelligeStar className="h-3 w-3" />
              {t("L’ouvrage")}{' '}</div>
            <h2 className="mt-3 text-[2rem] leading-[1.03] tracking-[-0.03em] sm:text-[2.6rem]">
              {t("Une œuvre à découvrir.")}{' '}</h2>
            <p className="mt-6 text-[13.5px] leading-[1.95] text-ink-soft/85 first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-display first-letter:text-[4.4rem] first-letter:leading-[0.72] first-letter:text-clay">
              {work.synopsis}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <span className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-muted">{t("Rayons")}</span>
              {work.categories?.map((category) => (
                <Link
                  key={category.id}
                  href={`/recherche?category=${category.slug}`}
                  className="border border-line px-3 py-1.5 text-[10px] text-ink-soft transition-colors hover:border-clay/40 hover:text-clay"
                >
                  {getLocalizedCategory(category, locale)}
                </Link>
              ))}
            </div>
          </div>

          {author && (
            <aside className="h-fit border border-line bg-parchment p-6 sm:p-8">
              <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-label text-clay">
                <ZelligeStar className="h-2.5 w-2.5" />
                {t("L’auteur")}{' '}</div>
              <div className="mt-5 flex items-center gap-4">
                <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-brass/35">
                  <ZelligeField className="text-brass" opacity={0.25} size="sm" />
                  <span className="relative font-display text-[1.4rem] text-sea">{initials(author.name)}</span>
                </div>
                <div>
                  <h3 className="font-display text-[1.4rem] leading-none text-ink">{author.name}</h3>
                  {author.name_ar && (
                    <p className="mt-1.5 font-arabic text-[14px] leading-none text-muted" dir="rtl">
                      {author.name_ar}
                    </p>
                  )}
                  <p className="mt-1.5 text-[8.5px] uppercase tracking-[0.1em] text-muted/70">
                    {author.nationality || 'Algérie'}
                  </p>
                </div>
              </div>
              {author.biography && (
                <p className="mt-5 text-[11.5px] leading-relaxed text-muted">{author.biography}</p>
              )}
              <Link
                href={`/recherche?q=${encodeURIComponent(author.name)}`}
                className="mt-5 flex items-center justify-between border-t border-line pt-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-sea transition-colors hover:text-clay"
              >
                {t("Voir ses livres")}{' '}<ChevronRight className="h-3 w-3" />
              </Link>
            </aside>
          )}
        </div>
      </section>

      {/* Editions */}
      <section className="border-y border-line bg-parchment">
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 sm:py-16 lg:px-10">
          <SectionHeading
            eyebrow={t("Éditions")}
            title={t("Toutes les éditions répertoriées.")}
            arabic="الطبعات"
            description={t("Un même texte peut exister en plusieurs éditions, formats et langues. Chaque édition rassemble ses propres offres.")}
          />

          {editions.length > 0 ? (
            <div className="mt-8 border-t border-line">
              {editions.map((edition) => (
                <div
                  key={edition.id}
                  className="grid gap-3 border-b border-line py-5 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-center lg:gap-6"
                >
                  <div>
                    <p className="font-display text-[1.2rem] leading-none text-ink">
                      {edition.publisher?.name || 'Éditeur national'}
                    </p>
                    <p className="mt-1 text-[9.5px] text-muted">
                      {edition.edition_title || 'Édition catalogue'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] uppercase tracking-[0.1em] text-muted/70">{t("Année")}</p>
                    <p className="mt-1 text-[11px] text-ink-soft">{edition.publication_year || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[8px] uppercase tracking-[0.1em] text-muted/70">{t("Format")}</p>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      {edition.format} · {edition.language}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] uppercase tracking-[0.1em] text-muted/70">{t("ISBN")}</p>
                    <p className="mt-1 font-mono text-[10.5px] text-ink-soft">
                      {edition.isbn13 || edition.isbn10 || '—'}
                    </p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="text-[8px] uppercase tracking-[0.1em] text-muted/70">{t("Pages")}</p>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      {edition.page_count ? `${edition.page_count} p.` : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-8 border-t border-line pt-6 text-[12px] text-muted">
              {t("Les détails d’édition seront complétés par les libraires du réseau.")}{' '}</p>
          )}
        </div>
      </section>

      {/* Offers */}
      <section id="offres" className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 sm:py-16 lg:px-10">
        <SectionHeading
          eyebrow={t("Comparateur multi-vendeurs")}
          title={t("Toutes les offres pour cet ouvrage.")}
          arabic="العروض"
          description={t("Comparez le prix, l’état, la proximité et les options de livraison. Chaque offre mène à un vendeur identifiable.")}
        />
        <OfferComparison offers={offers} />

        <div className="mt-10 grid gap-4 border border-line bg-parchment p-5 sm:grid-cols-3 sm:p-6">
          {[
            {
              icon: ShieldCheck,
              title: 'Librairies vérifiées',
              text: 'Les établissements physiques sont authentifiés par notre équipe.',
            },
            {
              icon: Store,
              title: 'Retrait en librairie',
              text: 'Réservez en ligne, payez et retirez au comptoir, sans frais.',
            },
            {
              icon: Truck,
              title: 'Livraison nationale',
              text: 'Domicile ou stop-desk via Yalidine et ZR Express, dans les 58 wilayas.',
            },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-brass" strokeWidth={1.5} />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink">{item.title}</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ZelligeDivider className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10" tone="sea" />

      {/* Related */}
      {related.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 sm:py-16 lg:px-10">
          <SectionHeading
            eyebrow={t("Dans le même rayon")}
            title={t("Poursuivre la lecture.")}
            arabic="اقرأ أيضاً"
            href={categorySlug ? `/recherche?category=${categorySlug}` : '/recherche'}
            action={t("Voir le rayon")}
          />
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {related.map((item) => (
              <BookCard key={item.id} work={item} />
            ))}
          </div>
        </section>
      )}

      {/* Seller prompt */}
      <section className="border-t border-line bg-ivory-deep/50">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-5 px-4 py-8 sm:flex-row sm:items-center sm:px-6 lg:px-10">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-label text-clay">{t("Vous avez cet ouvrage ?")}</p>
            <p className="mt-1.5 font-display text-[1.5rem] leading-none text-ink">
              {t("Proposez votre exemplaire au catalogue.")}{' '}</p>
          </div>
          <Link
            href="/sell"
            className="inline-flex items-center gap-2 bg-sea px-5 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-sea-deep"
          >
            {t("Créer une offre")}{' '}<ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
