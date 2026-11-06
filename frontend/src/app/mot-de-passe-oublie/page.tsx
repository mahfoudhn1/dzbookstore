'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail, Send } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthAlert, TextField } from '@/components/auth/Fields';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  clearFeedback,
  requestPasswordReset,
  selectAuthError,
  selectAuthNotice,
  selectDemoResetToken,
  selectPendingAction,
} from '@/lib/store/authSlice';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const pendingAction = useAppSelector(selectPendingAction);
  const error = useAppSelector(selectAuthError);
  const notice = useAppSelector(selectAuthNotice);
  const demoToken = useAppSelector(selectDemoResetToken);
  const loading = pendingAction === 'reset-request';

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    dispatch(clearFeedback());
  }, [dispatch]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setFieldError('Votre adresse email est requise.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFieldError('Cette adresse email ne semble pas valide.');
      return;
    }

    setFieldError(undefined);
    try {
      await dispatch(requestPasswordReset(trimmed)).unwrap();
      setSubmitted(true);
    } catch {
      // The error is exposed through the Redux slice.
    }
  };

  return (
    <AuthShell
      eyebrow={t("Récupération du compte")}
      title={
        <>
          {t("Retrouver l’accès à")}{' '}<span className="italic text-brass-light">{t("votre espace.")}</span>
        </>
      }
      description={t("Indiquez l’adresse email associée à votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.")}
      footer={
        <Link
          href="/connexion"
          className="inline-flex items-center gap-1.5 font-semibold text-sea underline decoration-sea/30 underline-offset-4 hover:text-clay"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("Revenir à la connexion")}{' '}</Link>
      }
    >
      {submitted ? (
        <div className="space-y-4">
          <AuthAlert tone="success">
            {notice ??
              'Si un compte existe pour cette adresse, un email de réinitialisation a été envoyé.'}
          </AuthAlert>

          <div className="border border-line bg-ivory px-4 py-3 text-[11.5px] leading-relaxed text-muted">
            <p className="font-semibold text-ink">{t("Le message n’arrive pas ?")}</p>
            <p className="mt-1">
              {t("Vérifiez le dossier spam, puis assurez-vous que l’adresse saisie est bien")}{' '}
              <span className="font-medium text-ink">{email.trim().toLowerCase()}</span>{t(". Le lien expire au bout de deux heures.")}{' '}</p>
          </div>

          {demoToken ? (
            <Link
              href={`/reinitialiser-mot-de-passe?token=${encodeURIComponent(demoToken)}`}
              className="flex h-10 items-center justify-center border border-clay/30 bg-clay/5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-clay transition-colors hover:bg-clay/10"
            >
              {t("Ouvrir le lien de réinitialisation (mode développement)")}{' '}</Link>
          ) : null}

          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="flex h-10 w-full items-center justify-center border border-line text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-sea hover:text-sea"
          >
            {t("Essayer une autre adresse")}{' '}</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? <AuthAlert>{error}</AuthAlert> : null}

          <TextField
            id="email"
            type="email"
            label={t("Adresse email")}
            placeholder={t("vous@exemple.dz")}
            autoComplete="email"
            icon={Mail}
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldError(undefined);
            }}
            error={fieldError}
          />

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 bg-sea text-[10px] font-bold uppercase tracking-[0.14em] text-ivory transition-colors hover:bg-sea-deep disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? 'Envoi…' : 'Recevoir le lien'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
