'use client';

import React from 'react';
import Link from 'next/link';
import { Loader2, MailWarning } from 'lucide-react';
import { resendVerification } from '@/lib/store/authSlice';
import {
  selectAuthError,
  selectAuthNotice,
  selectDemoVerificationToken,
  selectPendingAction,
  selectUser,
} from '@/lib/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { useI18n } from '@/lib/i18n/I18nProvider';

export function EmailVerificationBanner() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const pending = useAppSelector(selectPendingAction) === 'resend';
  const notice = useAppSelector(selectAuthNotice);
  const error = useAppSelector(selectAuthError);
  const demoToken = useAppSelector(selectDemoVerificationToken);

  if (!user || user.email_verified) return null;

  return (
    <div className="border-b border-brass/30 bg-brass/10">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 text-[11.5px] text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <div className="flex items-start gap-2.5">
          <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-clay" />
          <p>
            <span className="font-semibold text-ink">{t("Confirmez votre adresse email.")}</span>{' '}
            {t("Un lien de vérification a été envoyé à")}{' '}{user.email}{t(". Certaines actions restent limitées tant que l’adresse n’est pas confirmée.")}{' '}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3 pl-6 sm:pl-0">
          {demoToken ? (
            <Link
              href={`/verifier-email?token=${encodeURIComponent(demoToken)}`}
              className="text-[9px] font-bold uppercase tracking-[0.12em] text-clay underline decoration-clay/30 underline-offset-4 hover:text-clay-deep"
            >
              {t("Lien de test")}{' '}</Link>
          ) : null}
          <button
            type="button"
            onClick={() => dispatch(resendVerification())}
            disabled={pending}
            className="flex h-8 items-center gap-1.5 border border-ink/20 px-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-sea hover:text-sea disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {t("Renvoyer l’email")}{' '}</button>
        </div>
      </div>

      {notice ? (
        <p className="mx-auto max-w-[1440px] px-4 pb-2 text-[10.5px] text-emerald-dz sm:px-6 lg:px-10">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mx-auto max-w-[1440px] px-4 pb-2 text-[10.5px] text-clay sm:px-6 lg:px-10">
          {error}
        </p>
      ) : null}
    </div>
  );
}
