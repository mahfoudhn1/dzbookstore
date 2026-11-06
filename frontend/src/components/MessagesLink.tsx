'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useAppSelector } from '@/lib/store/hooks';
import { selectUser } from '@/lib/store/authSlice';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { fetchUnreadMessageCount } from '@/lib/api';
import { cn } from '@/lib/utils';

export function MessagesLink({ className }: { className?: string }) {
  const { t } = useI18n();
  const user = useAppSelector(selectUser);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const refresh = () => {
      fetchUnreadMessageCount().then((count) => {
        if (active) setUnread(count);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user]);

  if (!user) return null;

  return (
    <Link
      href="/messages"
      aria-label={
        unread > 0 ? `${t('Messages')} (${unread})` : t('Messages')
      }
      className={cn(
        'relative flex h-9 w-9 items-center justify-center text-ink-soft transition-colors hover:text-clay',
        className,
      )}
    >
      <MessageCircle className="h-[17px] w-[17px]" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-dz px-1 text-[8px] font-bold text-ivory">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}

export default MessagesLink;
