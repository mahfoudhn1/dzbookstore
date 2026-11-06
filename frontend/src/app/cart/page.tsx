'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  ChevronRight,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
} from 'lucide-react';
import { useCart, type CartLine } from '@/lib/cart-context';
import { createOrder } from '@/lib/api';
import { getStoredToken } from '@/lib/auth-storage';
import { formatPrice, getLocalizedCondition, getLocalizedWilaya, initials, normalizeCondition, pluralize } from '@/lib/utils';
import { WILAYAS } from '@/lib/wilayas';
import { BookCover } from '@/components/books/BookCover';
import { ZelligeField, ZelligeStar, ZelligeDivider } from '@/components/ui/Ornaments';
import { useI18n } from '@/lib/i18n/I18nProvider';

type DeliveryMethod = 'PICKUP' | 'STOP_DESK' | 'HOME';

interface SellerGroup {
  key: string;
  name: string;
  type: 'BOOKSTORE' | 'INDIVIDUAL';
  wilaya: string;
  code: string;
  commune?: string;
  slug?: string;
  lines: CartLine[];
  pickup: boolean;
  stopDesk: boolean;
  home: boolean;
  stopDeskFee?: number;
  homeFee?: number;
}

export default function CartPage() {
  const { t, locale } = useI18n();
  const { lines, count, subtotal, setQuantity, remove, clear, isReady } = useCart();
  const [delivery, setDelivery] = useState<Record<string, DeliveryMethod>>({});
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'BARIDIMOB'>('COD');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientWilaya, setRecipientWilaya] = useState('16');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

  const groups = useMemo<SellerGroup[]>(() => {
    const map = new Map<string, SellerGroup>();
    for (const line of lines) {
      const { offer } = line;
      const isBookstore = offer.seller_type === 'BOOKSTORE';
      const key = `${offer.seller_type}-${isBookstore ? offer.bookstore?.id ?? offer.seller_name : offer.individual_seller?.id ?? offer.seller_name}`;
      const existing = map.get(key);
      if (existing) {
        existing.lines.push(line);
        existing.pickup = existing.pickup || offer.has_store_pickup;
        existing.stopDesk = existing.stopDesk || offer.has_stop_desk_delivery;
        existing.home = existing.home || offer.has_home_delivery;
        existing.stopDeskFee = Math.max(existing.stopDeskFee ?? 0, offer.stop_desk_fee ?? 0);
        existing.homeFee = Math.max(existing.homeFee ?? 0, offer.home_delivery_fee ?? 0);
      } else {
        map.set(key, {
          key,
          name: offer.seller_name,
          type: offer.seller_type,
          wilaya:
            locale === 'ar'
              ? (offer.seller_wilaya_name_ar || offer.seller_wilaya_name)
              : locale === 'en'
                ? (offer.seller_wilaya_name_en || offer.seller_wilaya_name)
                : offer.seller_wilaya_name,
          code: offer.seller_wilaya_code,
          commune:
            locale === 'ar'
              ? (offer.seller_commune_name_ar || offer.seller_commune_name)
              : offer.seller_commune_name,
          slug: offer.bookstore?.slug,
          lines: [line],
          pickup: offer.has_store_pickup,
          stopDesk: offer.has_stop_desk_delivery,
          home: offer.has_home_delivery,
          stopDeskFee: offer.stop_desk_fee,
          homeFee: offer.home_delivery_fee,
        });
      }
    }
    return Array.from(map.values());
  }, [lines]);

  const methodFor = (group: SellerGroup): DeliveryMethod =>
    delivery[group.key] ?? (group.pickup ? 'PICKUP' : group.home ? 'HOME' : 'STOP_DESK');

  const deliveryTotal = groups.reduce((total, group) => {
    const method = methodFor(group);
    if (method === 'PICKUP') return total;
    if (method === 'STOP_DESK') return total + (group.stopDeskFee || 350);
    return total + (group.homeFee || 550);
  }, 0);

  const grandTotal = subtotal + deliveryTotal;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (!getStoredToken()) {
      setCheckoutError(t('Connectez-vous pour finaliser votre commande.'));
      return;
    }

    setSubmitting(true);
    setCheckoutError('');

    const deliveryChoices: Record<string, string> = {};
    for (const group of groups) {
      const method = methodFor(group);
      deliveryChoices[group.key] = method;
      for (const line of group.lines) {
        deliveryChoices[String(line.offer.id)] = method;
      }
    }

    const deliveryType =
      groups.length > 0
        ? {
            PICKUP: 'STORE_PICKUP',
            STOP_DESK: 'STOP_DESK',
            HOME: 'HOME_DELIVERY',
          }[methodFor(groups[0])]
        : undefined;

    try {
      const result = await createOrder({
        items: lines.map(({ offer, quantity }) => ({
          offer_id: offer.id,
          quantity,
          expected_price: offer.price,
        })),
        delivery: deliveryChoices,
        delivery_type: deliveryType,
        payment_method:
          paymentMethod === 'COD' ? 'CASH_ON_DELIVERY' : 'BARIDIMOB_TRANSFER',
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        recipient_wilaya: Number(recipientWilaya),
        recipient_address: recipientAddress,
      });
      setOrderNumber(result.order.order_number);
      clear();
      setSubmitted(true);
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : t('Impossible de finaliser la commande.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isReady) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 lg:px-10">
        <div className="h-9 w-48 skeleton" />
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="h-40 skeleton" />
            <div className="h-40 skeleton" />
          </div>
          <div className="h-80 skeleton" />
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:py-28">
        <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-brass/35">
          <ZelligeField className="text-brass" opacity={0.2} size="sm" />
          <Check className="relative h-8 w-8 text-sea" strokeWidth={1.5} />
        </div>
        <p className="mt-6 text-[9px] font-semibold uppercase tracking-label text-clay">{t("Commande enregistrée")}</p>
        <h1 className="mt-3 font-display text-[2.7rem] leading-[1] tracking-[-0.04em] text-ink">
          {t("Merci, votre commande est en route.")}{' '}</h1>
        <p className="mt-4 max-w-md text-[12px] leading-relaxed text-muted">
          {t("Chaque vendeur va confirmer la disponibilité et les modalités de remise. Vous recevrez les prochaines nouvelles par téléphone.")}{' '}</p>
        {orderNumber ? (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-sea">
            {t('Commande')} {orderNumber}
          </p>
        ) : null}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/recherche"
            className="inline-flex items-center gap-2 bg-sea px-5 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-sea-deep"
          >
            {t("Continuer la lecture")}{' '}<ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/dashboard/buyer"
            className="inline-flex items-center gap-2 border border-line px-5 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-clay hover:text-clay"
          >
            {t("Mes commandes")}{' '}</Link>
        </div>
        <ZelligeDivider className="mt-12 w-full" tone="sea" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:py-28">
        <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-brass/35">
          <ZelligeField className="text-brass" opacity={0.2} size="sm" />
          <ShoppingBag className="relative h-8 w-8 text-sea" strokeWidth={1.3} />
        </div>
        <p className="mt-6 text-[9px] font-semibold uppercase tracking-label text-clay">{t("Votre panier")}</p>
        <h1 className="mt-3 font-display text-[2.7rem] leading-[1] tracking-[-0.04em] text-ink">
          {t("Une page blanche, pour l’instant.")}{' '}</h1>
        <p className="mt-4 max-w-md text-[12px] leading-relaxed text-muted">
          {t("Ajoutez un livre depuis sa fiche, puis choisissez le retrait en librairie ou la livraison. Votre panier peut réunir plusieurs vendeurs.")}{' '}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/recherche"
            className="inline-flex items-center gap-2 bg-sea px-5 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-sea-deep"
          >
            {t("Explorer le catalogue")}{' '}<ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/secondhand"
            className="inline-flex items-center gap-2 border border-line px-5 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-clay hover:text-clay"
          >
            {t("Voir l’occasion")}{' '}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ivory">
      <div className="border-b border-line bg-parchment">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 py-4 text-[9px] uppercase tracking-[0.12em] text-muted sm:px-6 lg:px-10">
          <Link href="/" className="hover:text-sea">{t("Accueil")}</Link>
          <ChevronRight className="h-2.5 w-2.5" />
          <span className="text-ink">{t("Panier")}</span>
        </div>
      </div>

      <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-label text-clay">
              <ZelligeStar className="h-3 w-3" />
              {t("Votre sélection")}{' '}</div>
            <h1 className="mt-3 text-[2.6rem] leading-[0.98] tracking-[-0.04em] sm:text-[3.4rem]">
              {t("Le panier,")}{' '}<span className="italic text-clay">{t("en deux temps.")}</span>
            </h1>
            <p className="mt-3 text-[12px] text-muted">
              {count} {t(pluralize(count, 'livre'))} {t("chez")}{' '}{groups.length} {t(pluralize(groups.length, 'vendeur'))} {t("· le retrait en librairie est toujours gratuit.")}{' '}</p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted underline-offset-4 transition-colors hover:text-clay hover:underline"
          >
            {t("Vider le panier")}{' '}</button>
        </div>

        <div className="mt-9 grid gap-8 xl:grid-cols-[1.45fr_1fr] xl:gap-12">
          <div className="space-y-6">
            {groups.map((group) => {
              const method = methodFor(group);
              return (
                <section key={group.key} className="border border-line bg-parchment">
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-brass/30">
                        <ZelligeField className="text-brass" opacity={0.2} size="sm" />
                        <span className="relative font-display text-[12px] text-sea">{initials(group.name)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-display text-[1.1rem] leading-none text-ink">{group.name}</h2>
                          <span className="border border-line px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.08em] text-muted">
                            {group.type === 'BOOKSTORE' ? 'Librairie' : 'Particulier'}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-[9px] text-muted">
                          <MapPin className="h-2.5 w-2.5 text-clay/70" />
                          {group.code} · {group.wilaya}
                          {group.commune ? ` · ${group.commune}` : ''}
                        </p>
                      </div>
                    </div>
                    {group.slug && (
                      <Link
                        href={`/libraries/${group.slug}`}
                        className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-sea underline-offset-4 hover:text-clay hover:underline"
                      >
                        {t("Voir la librairie")}{' '}</Link>
                    )}
                  </header>

                  <div className="divide-y divide-line/70 px-5">
                    {group.lines.map(({ offer, quantity }) => (
                      <div key={offer.id} className="flex gap-4 py-4">
                        <Link href={`/books/${offer.work_slug}`} className="w-[62px] shrink-0 sm:w-[72px]">
                          <BookCover src={offer.work_cover} title={offer.work_title} author={offer.seller_name} />
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-clay">
                                {getLocalizedCondition(offer.condition, locale, t)}
                              </p>
                              <Link href={`/books/${offer.work_slug}`}>
                                <h3 className="mt-0.5 truncate font-display text-[1.15rem] leading-none text-ink transition-colors hover:text-sea">
                                  {offer.work_title}
                                </h3>
                              </Link>
                              <p className="mt-1 text-[9px] text-muted">
                                {offer.edition_publisher || 'Édition catalogue'}
                                {offer.edition_year ? ` · ${offer.edition_year}` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => remove(offer.id)}
                              aria-label={`Retirer ${offer.work_title}`}
                              className="flex h-7 w-7 shrink-0 items-center justify-center text-muted/60 transition-colors hover:text-clay"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                            <div className="inline-flex items-center border border-line">
                              <button
                                type="button"
                                onClick={() => setQuantity(offer.id, quantity - 1)}
                                aria-label={t("Diminuer la quantité")}
                                className="flex h-7 w-7 items-center justify-center text-muted transition-colors hover:text-ink"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="flex h-7 w-7 items-center justify-center border-x border-line text-[10px] font-semibold text-ink">
                                {quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQuantity(offer.id, quantity + 1)}
                                aria-label={t("Augmenter la quantité")}
                                className="flex h-7 w-7 items-center justify-center text-muted transition-colors hover:text-ink"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <p className="font-sans text-[13px] font-bold text-sea">
                              {formatPrice(offer.price * quantity, locale)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-line bg-ivory/60 px-5 py-4">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">{t("Mode de réception")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.pickup && (
                        <DeliveryChoice
                          active={method === 'PICKUP'}
                          onClick={() => setDelivery((current) => ({ ...current, [group.key]: 'PICKUP' }))}
                          icon={<Store className="h-3 w-3" />}
                          label={t("Retrait en librairie")}
                          detail={t("Gratuit")}
                        />
                      )}
                      {group.stopDesk && (
                        <DeliveryChoice
                          active={method === 'STOP_DESK'}
                          onClick={() => setDelivery((current) => ({ ...current, [group.key]: 'STOP_DESK' }))}
                          icon={<Truck className="h-3 w-3" />}
                          label={t("Stop-desk")}
                          detail={formatPrice(group.stopDeskFee || 350, locale)}
                        />
                      )}
                      {group.home && (
                        <DeliveryChoice
                          active={method === 'HOME'}
                          onClick={() => setDelivery((current) => ({ ...current, [group.key]: 'HOME' }))}
                          icon={<Truck className="h-3 w-3" />}
                          label={t("À domicile")}
                          detail={formatPrice(group.homeFee || 550, locale)}
                        />
                      )}
                    </div>
                  </div>
                </section>
              );
            })}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-5 text-[9.5px] text-muted">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-brass" /> {t("Vendeurs vérifiés")}{' '}</span>
              <span className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-brass" /> {t("Livraison 58 wilayas")}{' '}</span>
              <span className="flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5 text-brass" /> {t("Retrait gratuit")}{' '}</span>
            </div>
          </div>

          {/* Summary / checkout */}
          <aside className="h-fit border border-line bg-sea text-ivory xl:sticky xl:top-28">
            <div className="relative overflow-hidden border-b border-ivory/15 px-6 py-5">
              <ZelligeField className="text-ivory" opacity={0.06} />
              <div className="relative flex items-center justify-between">
                <p className="text-[8px] font-semibold uppercase tracking-label text-brass-light">{t("Récapitulatif")}</p>
                <ZelligeStar className="h-4 w-4 text-brass-light/70" />
              </div>
              <p className="relative mt-3 font-display text-[2rem] leading-none text-ivory">
                {formatPrice(grandTotal, locale)}
              </p>
              <p className="relative mt-1.5 text-[9.5px] text-ivory/50">
                {t("TVA incluse · paiement en dinars algériens")}{' '}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="space-y-2 border-b border-ivory/12 pb-3 text-[10.5px] text-ivory/60">
                <div className="flex justify-between">
                  <span>{t("Sous-total")}</span>
                  <span className="text-ivory">{formatPrice(subtotal, locale)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("Livraison")}</span>
                  <span className="text-ivory">{deliveryTotal === 0 ? t('Gratuit') : formatPrice(deliveryTotal, locale)}</span>
                </div>
              </div>

              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-brass-light">{t("Paiement")}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('COD')}
                    className={
                      paymentMethod === 'COD'
                        ? 'border border-brass-light bg-brass-light/10 px-3 py-2 text-left text-[9px] font-semibold text-ivory'
                        : 'border border-ivory/15 px-3 py-2 text-left text-[9px] text-ivory/55 transition-colors hover:border-ivory/30'
                    }
                  >
                    {t("À la livraison")}{' '}</button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BARIDIMOB')}
                    className={
                      paymentMethod === 'BARIDIMOB'
                        ? 'border border-brass-light bg-brass-light/10 px-3 py-2 text-left text-[9px] font-semibold text-ivory'
                        : 'border border-ivory/15 px-3 py-2 text-left text-[9px] text-ivory/55 transition-colors hover:border-ivory/30'
                    }
                  >
                    {t("BaridiMob / CCP")}{' '}</button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-brass-light">{t("Livraison à")}</p>
                <input
                  required
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  placeholder={t("Nom et prénom")}
                  aria-label={t("Nom du destinataire")}
                  className="h-9 w-full border border-ivory/15 bg-ivory/[0.04] px-3 text-[11px] text-ivory placeholder:text-ivory/30 focus:border-brass-light focus:outline-none"
                />
                <input
                  required
                  value={recipientPhone}
                  onChange={(event) => setRecipientPhone(event.target.value)}
                  placeholder={t("Téléphone")}
                  aria-label={t("Téléphone")}
                  inputMode="tel"
                  className="h-9 w-full border border-ivory/15 bg-ivory/[0.04] px-3 text-[11px] text-ivory placeholder:text-ivory/30 focus:border-brass-light focus:outline-none"
                />
                <select
                  value={recipientWilaya}
                  onChange={(event) => setRecipientWilaya(event.target.value)}
                  aria-label={t("Wilaya de livraison")}
                  className="h-9 w-full cursor-pointer border border-ivory/15 bg-ivory/[0.04] px-3 text-[11px] text-ivory focus:border-brass-light focus:outline-none"
                >
                  {WILAYAS.map((item) => (
                    <option key={item.id} value={String(item.id)} className="text-ink">
                      {item.code} — {getLocalizedWilaya(item, locale)}
                    </option>
                  ))}
                </select>
                <input
                  value={recipientAddress}
                  onChange={(event) => setRecipientAddress(event.target.value)}
                  placeholder={t("Adresse (ou librairie de retrait)")}
                  aria-label={t("Adresse")}
                  className="h-9 w-full border border-ivory/15 bg-ivory/[0.04] px-3 text-[11px] text-ivory placeholder:text-ivory/30 focus:border-brass-light focus:outline-none"
                />
              </div>

              {checkoutError ? (
                <p className="border border-clay/40 bg-clay/10 px-3 py-2 text-[10.5px] leading-relaxed text-ivory">
                  {checkoutError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 bg-brass-light py-3 text-[9px] font-bold uppercase tracking-[0.14em] text-sea-deep transition-colors hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-sea-deep/40 border-t-sea-deep" />
                    {t("Envoi en cours…")}
                  </>
                ) : (
                  <>
                    {t("Confirmer la commande")}{' '}<ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
              <p className="text-center text-[8px] leading-relaxed text-ivory/35">
                {t("Aucun prélèvement immédiat. Le vendeur confirme avant l’expédition.")}{' '}</p>
            </form>
          </aside>
        </div>
      </section>
    </div>
  );
}

function DeliveryChoice({
  active,
  onClick,
  icon,
  label,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'flex items-center gap-2 border border-sea bg-sea/[0.04] px-2.5 py-1.5 text-[9px] font-semibold text-sea'
          : 'flex items-center gap-2 border border-line px-2.5 py-1.5 text-[9px] text-muted transition-colors hover:border-sea/30 hover:text-sea'
      }
    >
      {icon}
      {label}
      <span className={active ? 'text-[8px] font-normal text-sea/60' : 'text-[8px] font-normal text-muted/60'}>
        {detail}
      </span>
    </button>
  );
}
