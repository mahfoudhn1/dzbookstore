'use client';

import React, { useState } from 'react';
import { Check, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useAppSelector } from '@/lib/store/hooks';
import { selectUser } from '@/lib/store/authSlice';
import type { Offer } from '@/lib/types';
import { cn } from '@/lib/utils';

export function AddToCartButton({
  offer,
  label = 'Ajouter au panier',
  variant = 'solid',
  className,
}: {
  offer?: Offer | null;
  label?: string;
  variant?: 'solid' | 'outline' | 'light';
  className?: string;
}) {
  const { t } = useI18n();
  const { add } = useCart();
  const user = useAppSelector(selectUser);
  const [added, setAdded] = useState(false);
  const ownsOffer = Boolean(
    user &&
      offer &&
      (offer.seller === user.id ||
        (offer.bookstore?.id && user.bookstore_profile?.id === offer.bookstore.id)),
  );

  if (!offer || offer.is_in_stock === false || ownsOffer) {
    return (
      <span
        className={cn(
          'inline-flex cursor-not-allowed items-center justify-center gap-2 border border-line bg-ivory-deep/50 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted',
          className,
        )}
      >
        {ownsOffer ? t('Votre annonce') : t('Indisponible')}{' '}</span>
    );
  }

  const handleAdd = () => {
    add(offer);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  };

  return (
    <button
      type="button"
      onClick={handleAdd}
      aria-live="polite"
      className={cn(
        'group inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] transition-colors',
        variant === 'solid' && 'bg-sea text-ivory hover:bg-sea-deep',
        variant === 'outline' && 'border border-ink/20 text-ink hover:border-clay hover:text-clay',
        variant === 'light' && 'bg-ivory text-sea hover:bg-brass-light hover:text-sea-deep',
        className,
      )}
    >
      {added ? <Check className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}
      {added ? t('Ajouté au panier') : t(label)}
    </button>
  );
}
