'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  Heart,
  Info,
  MessageCircle,
  ShieldAlert,
  ShoppingBag,
  Store,
  Tag,
} from 'lucide-react';
import { useAppSelector } from '@/lib/store/hooks';
import { selectUser } from '@/lib/store/authSlice';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { cn } from '@/lib/utils';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api';
import type { Notification, NotificationType } from '@/lib/types';
import { ZelligeStar } from '@/components/ui/Ornaments';

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  ORDER: ShoppingBag,
  MESSAGE: MessageCircle,
  WISHLIST: Heart,
  PRICE: Tag,
  LISTING: Store,
  MODERATION: ShieldAlert,
  SYSTEM: Info,
};

const TYPE_TONE: Record<NotificationType, string> = {
  ORDER: 'text-sea border-sea/25',
  MESSAGE: 'text-emerald-dz border-emerald-dz/25',
  WISHLIST: 'text-clay border-clay/25',
  PRICE: 'text-brass border-brass/35',
  LISTING: 'text-sea-soft border-sea-soft/25',
  MODERATION: 'text-clay-deep border-clay-deep/25',
  SYSTEM: 'text-muted border-line',
};

function relativeTime(value: string, locale: string): string {
  const diff = new Date(value).getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return formatter.format(0, 'minute');
}

function notificationData(notification: Notification): Record<string, unknown> {
  const raw: unknown = notification.data;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

function idValue(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return value.trim();
  return null;
}

function hrefFor(
  notification: Notification,
  role: string | undefined,
  isStaff: boolean,
): string | null {
  const data = notificationData(notification);

  const conversationId = idValue(data.conversation_id);
  if (conversationId) return `/messages?c=${conversationId}`;

  if (typeof data.work_slug === 'string' && data.work_slug) {
    return `/books/${data.work_slug}`;
  }

  const orderId = idValue(data.order_id);
  const suborderId = idValue(data.suborder_id);
  if (orderId || suborderId) {
    if (isStaff || role === 'ADMIN') return '/dashboard/admin';
    if (role === 'BOOKSTORE_SELLER') {
      return `/dashboard/library?tab=orders${suborderId ? `&order=${suborderId}` : ''}`;
    }
    if (role === 'INDIVIDUAL_SELLER') return '/dashboard/seller';
    return `/dashboard/buyer?order=${orderId ?? suborderId}`;
  }

  if (idValue(data.review_id)) {
    return isStaff || role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/buyer?tab=orders';
  }

  if (idValue(data.saved_search_id)) return '/recherche';

  if (notification.type === 'MODERATION' && (isStaff || role === 'ADMIN')) {
    return '/dashboard/admin';
  }

  return null;
}

export function NotificationsBell({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const refresh = () => {
      fetchUnreadNotificationCount().then((count) => {
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications({ limit: 12 });
      setItems(data.results);
      setUnread(data.unread_count);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await load();
  };

  const handleItem = (notification: Notification) => {
    setOpen(false);
    const href = hrefFor(
      notification,
      user?.role,
      Boolean(user?.is_staff || user?.is_superuser),
    );

    if (!notification.is_read) {
      // Navigate immediately; reading the notification can finish in the
      // background without delaying the user.
      void markNotificationRead(notification.id);
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item,
        ),
      );
      setUnread((count) => Math.max(0, count - 1));
    }

    if (!href) return;

    // Deep links are read once on mount by the dashboards and the inbox. When
    // the target shares the current path (e.g. a second order notification),
    // force a reload so the new query string is picked up.
    const target = new URL(href, window.location.origin);
    if (target.pathname === window.location.pathname) {
      window.location.assign(href);
      return;
    }
    router.push(href);
  };

  const handleReadAll = async () => {
    const updated = await markAllNotificationsRead();
    if (updated > 0) {
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnread(0);
    }
  };

  if (!user) return null;

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={t('Notifications')}
        className="relative flex h-9 w-9 items-center justify-center text-ink-soft transition-colors hover:text-clay"
      >
        <Bell className="h-[17px] w-[17px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[8px] font-bold text-ivory">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={t('Fermer les notifications')}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-sea-deep/10"
          />
          <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[min(360px,calc(100vw-2rem))] border border-line bg-parchment shadow-[0_30px_70px_-30px_rgba(10,38,50,0.45)]">
            <div className="relative overflow-hidden border-b border-line bg-sea px-4 py-3 text-ivory">
              <div aria-hidden className="zellige-mask absolute inset-0 text-ivory/[0.06]" />
              <div className="relative flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <ZelligeStar className="h-3.5 w-3.5 text-brass-light" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                    {t('Notifications')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleReadAll}
                  disabled={unread === 0}
                  className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-ivory/70 transition-colors hover:text-ivory disabled:cursor-default disabled:opacity-40"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {t('Tout lire')}
                </button>
              </div>
            </div>

            <div className="max-h-[380px] overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="h-14 skeleton" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                  <ZelligeStar className="h-7 w-7 text-brass/60" />
                  <p className="text-[11.5px] text-muted">
                    {t('Aucune notification pour le moment.')}
                  </p>
                </div>
              ) : (
                <ul>
                  {items.map((notification) => {
                    const Icon = TYPE_ICON[notification.type] ?? Info;
                    return (
                      <li key={notification.id} className="border-b border-line/70 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => handleItem(notification)}
                          className={cn(
                            'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ivory-deep',
                            !notification.is_read && 'bg-ivory/70',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border bg-parchment',
                              TYPE_TONE[notification.type] ?? TYPE_TONE.SYSTEM,
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className="text-[11.5px] font-semibold leading-snug text-ink">
                                {notification.title}
                              </span>
                              {!notification.is_read && (
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-clay" />
                              )}
                            </span>
                            {notification.message ? (
                              <span className="mt-0.5 line-clamp-2 block text-[10.5px] leading-relaxed text-muted">
                                {notification.message}
                              </span>
                            ) : null}
                            <span className="mt-1 block text-[9px] uppercase tracking-[0.08em] text-muted/80">
                              {relativeTime(notification.created_at, locale)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationsBell;
