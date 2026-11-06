'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Flag,
  Loader2,
  MessageCircle,
  Search,
  Send,
  X,
} from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { SectionHeading, ZelligeDivider, ZelligeStar } from '@/components/ui/Ornaments';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useAppSelector } from '@/lib/store/hooks';
import { selectUser } from '@/lib/store/authSlice';
import {
  fetchConversation,
  fetchConversations,
  reportConversationMessage,
  sendConversationMessage,
} from '@/lib/api';
import type { Conversation, ConversationMessage, ConversationThread } from '@/lib/types';
import { cn, initials } from '@/lib/utils';

function conversationTitle(
  conversation: Conversation,
  userId: number | undefined,
  t: (key: string) => string,
): string {
  if (conversation.buyer === userId) {
    return conversation.bookstore_name || conversation.individual_seller_name || t('Vendeur');
  }
  return conversation.buyer_name || t('Acheteur');
}

function formatTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatListDate(value: string | null, locale: string): string {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return formatTime(value, locale);
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(date);
}

function Inbox() {
  const { t, locale } = useI18n();
  const user = useAppSelector(selectUser);
  const userId = user?.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [reportTarget, setReportTarget] = useState<ConversationMessage | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [reportError, setReportError] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const openConversation = useCallback(async (conversationId: number) => {
    setActiveId(conversationId);
    setLoadingThread(true);
    setError('');
    try {
      const data = await fetchConversation(conversationId);
      setThread(data);
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId ? { ...item, unread_count: 0 } : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('Impossible de charger la conversation.'),
      );
      setThread(null);
    } finally {
      setLoadingThread(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;
    fetchConversations()
      .then((data) => {
        if (!active) return;
        setConversations(data);
        const requested = Number(
          new URLSearchParams(window.location.search).get('c') ?? '',
        );
        const requestedExists = data.some((item) => item.id === requested);
        const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
        const firstId = requestedExists ? requested : isDesktop ? data[0]?.id : undefined;
        if (firstId) void openConversation(firstId);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : t('Impossible de charger les conversations.'),
          );
        }
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, [openConversation, t]);

  useEffect(() => {
    if (!activeId) return;
    const timer = window.setInterval(async () => {
      try {
        const [data, list] = await Promise.all([
          fetchConversation(activeId),
          fetchConversations(),
        ]);
        setThread(data);
        setConversations(list);
      } catch {
        // Polling failures are silent; the composer still reports real errors.
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [activeId]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [thread?.messages.length]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !activeId || sending) return;

    setSending(true);
    setError('');
    try {
      const message = await sendConversationMessage(activeId, body);
      setThread((current) =>
        current ? { ...current, messages: [...current.messages, message] } : current,
      );
      setConversations((current) =>
        current
          .map((item) =>
            item.id === activeId
              ? {
                  ...item,
                  last_message: message,
                  last_message_at: message.created_at,
                  unread_count: 0,
                }
              : item,
          )
          .sort((a, b) => {
            const left = a.last_message_at ?? a.created_at;
            const right = b.last_message_at ?? b.created_at;
            return new Date(right).getTime() - new Date(left).getTime();
          }),
      );
      setDraft('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("Impossible d'envoyer le message."),
      );
    } finally {
      setSending(false);
    }
  };

  const closeReport = () => {
    setReportTarget(null);
    setReportReason('');
    setReportDone(false);
    setReportError('');
  };

  const handleReport = async () => {
    if (!reportTarget || !reportReason.trim()) return;
    setReportSubmitting(true);
    setReportError('');
    try {
      await reportConversationMessage(reportTarget.id, reportReason.trim());
      setReportDone(true);
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : t('Impossible de signaler ce message.'),
      );
    } finally {
      setReportSubmitting(false);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visibleConversations = conversations.filter((conversation) => {
    if (!normalizedQuery) return true;
    const title = conversationTitle(conversation, userId, t).toLowerCase();
    return (
      title.includes(normalizedQuery) ||
      (conversation.subject ?? '').toLowerCase().includes(normalizedQuery)
    );
  });

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ?? thread?.conversation;
  const activeTitle = activeConversation
    ? conversationTitle(activeConversation, userId, t)
    : '';

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
      <SectionHeading
        eyebrow={t('Messagerie')}
        arabic="الرسائل"
        title={t('Vos conversations')}
        description={t(
          'Échangez avec les librairies et les lecteurs : disponibilité, état de l’exemplaire, livraison ou retrait.',
        )}
      />

      <ZelligeDivider className="my-7" />

      <div className="grid min-h-[560px] overflow-hidden border border-line bg-parchment shadow-[var(--shadow-card)] lg:grid-cols-[340px_1fr]">
        {/* Conversation list */}
        <aside
          className={cn(
            'flex flex-col border-line lg:border-r',
            activeId && 'hidden lg:flex',
          )}
        >
          <div className="border-b border-line px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                <MessageCircle className="h-3.5 w-3.5 text-sea" />
                {t('Boîte de réception')}
              </span>
              <span className="border border-line px-1.5 py-0.5 text-[9px] font-semibold text-muted">
                {conversations.length}
              </span>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('Rechercher une conversation…')}
                aria-label={t('Rechercher une conversation')}
                className="h-9 w-full border border-line bg-ivory pl-8 pr-3 text-[11px] text-ink placeholder:text-muted/70 focus:border-sea/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="h-16 skeleton" />
                ))}
              </div>
            ) : visibleConversations.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <ZelligeStar className="h-8 w-8 text-brass/60" />
                <p className="text-[12px] leading-relaxed text-muted">
                  {conversations.length === 0
                    ? t('Aucune conversation pour le moment.')
                    : t('Aucune conversation ne correspond à votre recherche.')}
                </p>
                {conversations.length === 0 ? (
                  <Link
                    href="/libraries"
                    className="border-b border-ink/20 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:border-clay hover:text-clay"
                  >
                    {t('Parcourir les librairies')}
                  </Link>
                ) : null}
              </div>
            ) : (
              <ul>
                {visibleConversations.map((conversation) => {
                  const title = conversationTitle(conversation, userId, t);
                  const preview = conversation.last_message?.body ?? conversation.subject;
                  const isActive = conversation.id === activeId;
                  return (
                    <li key={conversation.id} className="border-b border-line/70 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => void openConversation(conversation.id)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ivory-deep/70',
                          isActive && 'bg-ivory-deep/80',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center border font-display text-[13px]',
                            isActive
                              ? 'border-sea/30 bg-sea text-ivory'
                              : 'border-line bg-ivory text-sea',
                          )}
                        >
                          {initials(title) || '·'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="truncate text-[12px] font-semibold text-ink">
                              {title}
                            </span>
                            <span className="shrink-0 text-[9px] uppercase tracking-[0.06em] text-muted">
                              {formatListDate(conversation.last_message_at, locale)}
                            </span>
                          </span>
                          <span className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="line-clamp-1 text-[10.5px] leading-relaxed text-muted">
                              {preview || t('Nouvelle conversation')}
                            </span>
                            {conversation.unread_count > 0 && (
                              <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-clay px-1 text-[8px] font-bold text-ivory">
                                {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                              </span>
                            )}
                          </span>
                          {conversation.subject ? (
                            <span className="mt-1 block truncate text-[9px] uppercase tracking-[0.08em] text-brass">
                              {conversation.subject}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={cn('flex min-h-[560px] flex-col', !activeId && 'hidden lg:flex')}>
          {activeId && activeConversation ? (
            <>
              <header className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(null);
                    setThread(null);
                  }}
                  aria-label={t('Retour aux conversations')}
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border border-line text-ink-soft transition-colors hover:border-clay hover:text-clay lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-sea/30 bg-sea font-display text-[13px] text-ivory">
                  {initials(activeTitle) || '·'}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-[1.25rem] leading-tight text-ink">
                    {activeTitle}
                  </h2>
                  <p className="mt-0.5 text-[9.5px] uppercase tracking-[0.08em] text-muted">
                    {activeConversation.subject || t('Conversation')}
                    {activeConversation.suborder
                      ? ` · ${t('Commande')} #${activeConversation.suborder}`
                      : ''}
                  </p>
                </div>
                {activeConversation.suborder ? (
                  <Link
                    href="/dashboard/buyer"
                    className="hidden border border-line px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-soft transition-colors hover:border-sea/40 hover:text-sea sm:block"
                  >
                    {t('Voir la commande')}
                  </Link>
                ) : null}
              </header>

              <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto bg-ivory/40 px-4 py-5 sm:px-5"
                aria-live="polite"
              >
                {loadingThread && !thread ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className={cn('h-14 w-2/3 skeleton', index % 2 === 0 && 'ml-auto')}
                      />
                    ))}
                  </div>
                ) : thread && thread.messages.length > 0 ? (
                  thread.messages.map((message) => {
                    const mine = message.sender === userId;
                    return (
                      <div
                        key={message.id}
                        className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[82%] border px-3.5 py-2.5 sm:max-w-[72%]',
                            mine
                              ? 'border-sea/30 bg-sea text-ivory'
                              : 'border-line bg-parchment text-ink',
                          )}
                        >
                          {!mine && (
                            <p className="mb-1 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                              {message.sender_name}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap text-[12px] leading-relaxed">
                            {message.body}
                          </p>
                          <div className="mt-1.5 flex items-center justify-end gap-2">
                            <span
                              className={cn(
                                'text-[8px] uppercase tracking-[0.06em]',
                                mine ? 'text-ivory/50' : 'text-muted/70',
                              )}
                            >
                              {formatTime(message.created_at, locale)}
                            </span>
                            {!mine && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReportTarget(message);
                                  setReportReason('');
                                  setReportDone(false);
                                  setReportError('');
                                }}
                                aria-label={t('Signaler ce message')}
                                title={t('Signaler')}
                                className="text-muted/60 transition-colors hover:text-clay"
                              >
                                <Flag className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
                    <ZelligeStar className="h-8 w-8 text-brass/60" />
                    <p className="max-w-xs text-[12px] leading-relaxed text-muted">
                      {t('Écrivez le premier message de cette conversation.')}
                    </p>
                  </div>
                )}
              </div>

              {error ? (
                <p
                  role="alert"
                  className="border-y border-clay/25 bg-clay/[0.06] px-4 py-2 text-[10.5px] text-clay-deep"
                >
                  {error}
                </p>
              ) : null}

              <form onSubmit={handleSend} className="border-t border-line bg-parchment p-3 sm:p-4">
                <label htmlFor="message-body" className="sr-only">
                  {t('Votre message')}
                </label>
                <textarea
                  id="message-body"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={2}
                  maxLength={5000}
                  placeholder={t('Écrivez votre message…')}
                  className="w-full resize-none border border-line bg-ivory px-3 py-2.5 text-[12px] leading-relaxed text-ink placeholder:text-muted/70 focus:border-sea/40 focus:outline-none"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-[9px] uppercase tracking-[0.08em] text-muted">
                    {draft.length}/5000
                  </span>
                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    className="flex h-9 items-center gap-2 bg-sea px-4 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-sea-deep disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {sending ? t('Envoi…') : t('Envoyer')}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <div className="relative flex h-16 w-16 items-center justify-center border border-line bg-ivory text-sea">
                <ZelligeStar className="h-8 w-8" />
              </div>
              <div>
                <h2 className="font-display text-[1.6rem] leading-tight text-ink">
                  {t('Sélectionnez une conversation')}
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-[12px] leading-relaxed text-muted">
                  {t(
                    'Choisissez un fil à gauche, ou contactez un vendeur depuis la fiche d’un livre.',
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                <Link
                  href="/libraries"
                  className="border-b border-ink/20 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:border-clay hover:text-clay"
                >
                  {t('Parcourir les librairies')}
                </Link>
                <Link
                  href="/recherche"
                  className="border-b border-ink/20 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:border-clay hover:text-clay"
                >
                  {t('Explorer le catalogue')}
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>

      {reportTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-sea-deep/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('Signaler ce message')}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeReport();
          }}
        >
          <div className="w-full max-w-md border border-line bg-parchment shadow-2xl">
            <div className="relative overflow-hidden bg-sea px-5 py-4 text-ivory">
              <div aria-hidden className="zellige-mask absolute inset-0 text-ivory/[0.06]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[8px] uppercase tracking-label text-brass-light">
                    {t('Modération')}
                  </p>
                  <h3 className="mt-1.5 font-display text-[1.5rem] leading-none">
                    {t('Signaler ce message')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeReport}
                  aria-label={t('Fermer')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center border border-ivory/20 text-ivory/70 transition-colors hover:border-ivory hover:text-ivory"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-3 p-5">
              {reportDone ? (
                <div className="flex items-start gap-3 border border-emerald-dz/25 bg-emerald-dz/[0.05] px-4 py-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-deep" />
                  <p className="text-[11.5px] leading-relaxed text-ink-soft">
                    {t('Merci, votre signalement a été transmis à notre équipe.')}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[11px] leading-relaxed text-muted">
                    {t(
                      'Décrivez le problème rencontré. Les signalements sont examinés par notre équipe de modération.',
                    )}
                  </p>
                  <label htmlFor="report-reason" className="sr-only">
                    {t('Motif du signalement')}
                  </label>
                  <textarea
                    id="report-reason"
                    rows={4}
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    placeholder={t('Motif du signalement…')}
                    className="w-full resize-none border border-line bg-ivory px-3 py-2.5 text-[12px] leading-relaxed text-ink placeholder:text-muted/70 focus:border-sea/40 focus:outline-none"
                  />
                  {reportError ? (
                    <p className="text-[10.5px] text-clay-deep" role="alert">
                      {reportError}
                    </p>
                  ) : null}
                </>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeReport}
                  className="h-9 border border-line px-4 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-clay hover:text-clay"
                >
                  {reportDone ? t('Fermer') : t('Annuler')}
                </button>
                {!reportDone && (
                  <button
                    type="button"
                    onClick={handleReport}
                    disabled={!reportReason.trim() || reportSubmitting}
                    className="flex h-9 items-center gap-2 bg-clay px-4 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-clay-deep disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {reportSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t('Signaler')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <RequireAuth>
      <Inbox />
    </RequireAuth>
  );
}
