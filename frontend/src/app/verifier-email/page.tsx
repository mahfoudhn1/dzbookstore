'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, MailCheck, MailX } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthAlert } from '@/components/auth/Fields';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  clearFeedback,
  resendVerification,
  selectAuthError,
  selectAuthNotice,
  selectDemoVerificationToken,
  selectPendingAction,
  selectUser,
  verifyEmail,
} from '@/lib/store/authSlice';
import { dashboardPathForRole } from '@/lib/auth-routes';

function VerifyEmailContent() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const user = useAppSelector(selectUser);
  const pendingAction = useAppSelector(selectPendingAction);
  const error = useAppSelector(selectAuthError);
  const notice = useAppSelector(selectAuthNotice);
  const demoToken = useAppSelector(selectDemoVerificationToken);

  const verifying = pendingAction === 'verify';
  const resending = pendingAction === 'resend';
  const startedRef = useRef(false);

  useEffect(() => {
    dispatch(clearFeedback());
    if (!token || startedRef.current) return;
    startedRef.current = true;
    dispatch(verifyEmail(token));
  }, [dispatch, token]);

  const success = Boolean(notice && !error && !verifying);

  return (
    <AuthShell
      eyebrow={t("Vérification de l’adresse email")}
      title={
        success ? (
          <>
            {t("Votre adresse est")}{' '}<span className="italic text-brass-light">{t("confirmée.")}</span>
          </>
        ) : (
          <>
            {t("Une dernière étape,")}{' '}<span className="italic text-brass-light">{t("et c’est fait.")}</span>
          </>
        )
      }
      description={t("La vérification de votre adresse email protège votre compte et débloque toutes les fonctionnalités de Bookstore.dz.")}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="font-semibold text-sea underline decoration-sea/30 underline-offset-4 hover:text-clay">
            {t("Retour à l’accueil")}{' '}</Link>
          {user ? (
            <Link
              href={dashboardPathForRole(user.role, user.is_staff || user.is_superuser)}
              className="font-semibold text-sea underline decoration-sea/30 underline-offset-4 hover:text-clay"
            >
              {t("Mon espace")}{' '}</Link>
          ) : (
            <Link href="/connexion" className="font-semibold text-sea underline decoration-sea/30 underline-offset-4 hover:text-clay">
              {t("Se connecter")}{' '}</Link>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {!token ? (
          <AuthAlert>
            {t("Le lien de vérification est incomplet. Ouvrez le lien reçu par email, ou demandez un nouveau message depuis votre espace.")}{' '}</AuthAlert>
        ) : null}

        {verifying ? (
          <div className="flex items-center gap-3 border border-sea/20 bg-sea/5 px-4 py-4 text-sea">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-[11.5px]">{t("Vérification de votre adresse en cours…")}</p>
          </div>
        ) : null}

        {!verifying && error ? (
          <AuthAlert>
            <p>{error}</p>
            <p className="mt-1.5 text-[10.5px] text-clay-deep/80">
              {t("Si le lien a expiré, connectez-vous puis demandez un nouvel email de vérification.")}{' '}</p>
          </AuthAlert>
        ) : null}

        {!verifying && success ? (
          <div className="border border-emerald-dz/25 bg-emerald-dz/5 px-4 py-5 text-emerald-dz">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em]">{t("Adresse vérifiée")}</p>
                <p className="mt-1.5 text-[11.5px] leading-relaxed">{notice}</p>
              </div>
            </div>
          </div>
        ) : null}

        {!verifying && !success ? (
          <div className="flex items-start gap-3 border border-line bg-ivory px-4 py-3 text-muted">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-sea" />
            <p className="text-[11.5px] leading-relaxed">
              {t("Ouvrez le lien envoyé à")}{' '}
              <span className="font-medium text-ink">{user?.email ?? 'votre adresse email'}</span>{t(". Pensez à vérifier vos courriers indésirables.")}{' '}</p>
          </div>
        ) : null}

        {user && !user.email_verified ? (
          <div className="space-y-2 border-t border-line/80 pt-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
              {t("L’email n’est pas arrivé ?")}{' '}</p>
            <button
              type="button"
              onClick={() => dispatch(resendVerification())}
              disabled={resending}
              className="flex h-10 w-full items-center justify-center gap-2 border border-line text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-sea hover:text-sea disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailX className="h-3.5 w-3.5" />}
              {t("Renvoyer l’email de vérification")}{' '}</button>
            {demoToken ? (
              <Link
                href={`/verifier-email?token=${encodeURIComponent(demoToken)}`}
                className="block text-center text-[9.5px] font-bold uppercase tracking-[0.12em] text-clay underline decoration-clay/30 underline-offset-4 hover:text-clay-deep"
              >
                {t("Ouvrir le lien de test")}{' '}</Link>
            ) : null}
          </div>
        ) : null}

        {success && user ? (
          <Link
            href={dashboardPathForRole(user.role, user.is_staff || user.is_superuser)}
            className="flex h-11 items-center justify-center bg-sea text-[10px] font-bold uppercase tracking-[0.14em] text-ivory transition-colors hover:bg-sea-deep"
          >
            {t("Accéder à mon espace")}{' '}</Link>
        ) : null}

        {!success ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/connexion"
              className="flex h-10 items-center justify-center border border-line text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-sea hover:text-sea"
            >
              {t("Se connecter")}{' '}</Link>
            <Link
              href="/mot-de-passe-oublie"
              className="flex h-10 items-center justify-center border border-line text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-sea hover:text-sea"
            >
              {t("Récupérer le compte")}{' '}</Link>
          </div>
        ) : null}
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
