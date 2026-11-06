'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/store/hooks';
import { selectUser } from '@/lib/store/authSlice';
import { startConversation } from '@/lib/api';
import { useI18n } from '@/lib/i18n/I18nProvider';

export interface StartConversationTarget {
  bookstore_id?: number;
  individual_seller_id?: number;
  suborder_id?: number;
  subject?: string;
}

export function useStartConversation() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const user = useAppSelector(selectUser);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const start = async (target: StartConversationTarget) => {
    if (starting) return null;
    if (!user) {
      const next = encodeURIComponent(pathname || '/');
      router.push(`/connexion?next=${next}`);
      return null;
    }

    setStarting(true);
    setError('');
    try {
      const conversation = await startConversation(target);
      router.push(`/messages?c=${conversation.id}`);
      return conversation;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('Impossible de démarrer la conversation.'),
      );
      return null;
    } finally {
      setStarting(false);
    }
  };

  return { start, starting, error, setError };
}
