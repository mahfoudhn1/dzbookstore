'use client';

import { Loader2, MessageCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useStartConversation } from '@/lib/useStartConversation';
import { useAppSelector } from '@/lib/store/hooks';
import { selectUser } from '@/lib/store/authSlice';
import { cn } from '@/lib/utils';

type Variant = 'solid' | 'outline' | 'hero';

const VARIANTS: Record<Variant, string> = {
  solid:
    'bg-sea text-ivory hover:bg-sea-deep disabled:bg-sea/60',
  outline:
    'border border-ink/20 text-ink hover:border-clay hover:text-clay',
  hero:
    'border border-brass-light/45 bg-ivory/[0.06] text-brass-light hover:bg-brass-light hover:text-sea-deep',
};

export function MessageSellerButton({
  bookstoreId,
  individualSellerId,
  label,
  variant = 'solid',
  className,
}: {
  bookstoreId?: number;
  individualSellerId?: number;
  label?: string;
  variant?: Variant;
  className?: string;
}) {
  const { t } = useI18n();
  const user = useAppSelector(selectUser);
  const { start, starting, error } = useStartConversation();

  const isOwnStore =
    Boolean(bookstoreId) && bookstoreId === user?.bookstore_profile?.id;
  const isOwnListing =
    Boolean(individualSellerId) &&
    individualSellerId === user?.individual_profile?.id;

  if ((!bookstoreId && !individualSellerId) || isOwnStore || isOwnListing) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <button
        type="button"
        onClick={() =>
          start({ bookstore_id: bookstoreId, individual_seller_id: individualSellerId })
        }
        disabled={starting}
        className={cn(
          'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed',
          VARIANTS[variant],
        )}
      >
        {starting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <MessageCircle className="h-3.5 w-3.5" />
        )}
        {starting ? t('Ouverture…') : label ?? t('Envoyer un message')}
      </button>
      {error ? (
        <p className="max-w-xs text-[9.5px] leading-relaxed text-clay-deep" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default MessageSellerButton;
