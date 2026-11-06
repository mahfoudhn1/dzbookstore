'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Phone, X } from 'lucide-react';
import { ZelligeStar } from '@/components/ui/Ornaments';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useStartConversation } from '@/lib/useStartConversation';

export function ContactSellerButton({
  sellerName,
  phone,
  whatsapp,
  bookstoreId,
  individualSellerId,
}: {
  sellerName: string;
  phone?: string;
  whatsapp?: string;
  bookstoreId?: number;
  individualSellerId?: number;
}) {
  const { t } = useI18n();
  const { start, starting, error: startError } = useStartConversation();
  const [open, setOpen] = useState(false);

  const canMessage = Boolean(bookstoreId || individualSellerId);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 border border-line px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-ink-soft transition-colors hover:border-clay hover:text-clay"
      >
        <Phone className="h-3 w-3" />
        {t("Contacter")}{' '}</button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-sea-deep/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Contacter ${sellerName}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md border border-line bg-parchment shadow-2xl">
            <div className="relative overflow-hidden bg-sea px-6 py-5 text-ivory">
              <div aria-hidden className="zellige-mask absolute inset-0 text-ivory/[0.07]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[8px] uppercase tracking-label text-brass-light">{t("Prendre contact")}</p>
                  <h3 className="mt-2 font-display text-[1.8rem] leading-none tracking-[-0.02em]">
                    {sellerName}
                  </h3>
                  <p className="mt-2 text-[10.5px] leading-relaxed text-ivory/55">
                    {t("Confirmez la disponibilité, l’état de l’exemplaire ou un créneau de retrait.")}{' '}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t("Fermer")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center border border-ivory/20 text-ivory/70 transition-colors hover:border-ivory hover:text-ivory"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5 p-5">
              {canMessage ? (
                <button
                  type="button"
                  onClick={() =>
                    start({
                      bookstore_id: bookstoreId,
                      individual_seller_id: individualSellerId,
                    })
                  }
                  disabled={starting}
                  className="flex w-full items-center justify-between gap-3 bg-sea px-4 py-3 text-ivory transition-colors hover:bg-sea-deep disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex items-center gap-3">
                    {starting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-brass-light" />
                    ) : (
                      <MessageCircle className="h-4 w-4 text-brass-light" />
                    )}
                    <span>
                      <span className="block text-[8px] uppercase tracking-[0.12em] text-ivory/55">
                        {t('Messagerie')}
                      </span>
                      <span className="mt-0.5 block text-[12px] font-semibold">
                        {starting ? t('Ouverture…') : t('Envoyer un message')}
                      </span>
                    </span>
                  </span>
                  <span className="text-[9px] uppercase tracking-[0.1em] text-brass-light">
                    {t('Écrire')}
                  </span>
                </button>
              ) : null}

              {startError ? (
                <p className="border border-clay/25 bg-clay/[0.06] px-3 py-2 text-[10.5px] text-clay-deep" role="alert">
                  {startError}
                </p>
              ) : null}

              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s/g, '')}`}
                  className="group flex items-center justify-between border border-line px-4 py-3 transition-colors hover:border-sea/40"
                >
                  <span className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-sea" />
                    <span>
                      <span className="block text-[8px] uppercase tracking-[0.12em] text-muted">{t("Téléphone")}</span>
                      <span className="mt-0.5 block text-[12px] font-semibold text-ink">{phone}</span>
                    </span>
                  </span>
                  <span className="text-[9px] uppercase tracking-[0.1em] text-clay opacity-0 transition-opacity group-hover:opacity-100">
                    {t("Appeler")}{' '}</span>
                </a>
              ) : (
                <p className="border border-line px-4 py-3 text-[11px] text-muted">
                  {t("Le vendeur n’a pas publié de numéro public. Utilisez la fiche de la librairie.")}{' '}</p>
              )}

              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between border border-emerald-dz/20 bg-emerald-dz/[0.04] px-4 py-3 transition-colors hover:border-emerald-dz/50"
                >
                  <span className="flex items-center gap-3">
                    <MessageCircle className="h-4 w-4 text-emerald-deep" />
                    <span>
                      <span className="block text-[8px] uppercase tracking-[0.12em] text-muted">{t("WhatsApp")}</span>
                      <span className="mt-0.5 block text-[12px] font-semibold text-ink">{whatsapp}</span>
                    </span>
                  </span>
                  <span className="text-[9px] uppercase tracking-[0.1em] text-emerald-deep opacity-0 transition-opacity group-hover:opacity-100">
                    {t("Écrire")}{' '}</span>
                </a>
              )}

              <div className="flex items-center gap-2 border-t border-line pt-3 text-[9px] leading-relaxed text-muted">
                <ZelligeStar className="h-3 w-3 shrink-0 text-brass" />
                {t("Pour votre sécurité, privilégiez le paiement à la livraison ou le retrait en librairie.")}{' '}</div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-1 w-full border border-line py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-clay hover:text-clay"
              >
                {t("Fermer")}{' '}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ContactSellerButton;
