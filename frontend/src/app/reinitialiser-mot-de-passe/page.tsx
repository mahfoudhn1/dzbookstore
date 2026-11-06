'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, LockKeyhole } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthAlert, PasswordField } from '@/components/auth/Fields';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  clearFeedback,
  resetPassword,
  selectAuthError,
  selectAuthNotice,
  selectPendingAction,
} from '@/lib/store/authSlice';

function ResetPasswordContent() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const pendingAction = useAppSelector(selectPendingAction);
  const error = useAppSelector(selectAuthError);
  const notice = useAppSelector(selectAuthNotice);
  const loading = pendingAction === 'reset';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    dispatch(clearFeedback());
  }, [dispatch]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: typeof fieldErrors = {};
    if (password.length < 8) {
      errors.password = 'Le mot de passe doit contenir au moins 8 caractères.';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Les deux mots de passe ne correspondent pas.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await dispatch(resetPassword({ token, newPassword: password })).unwrap();
      setCompleted(true);
    } catch {
      // The error is exposed through the Redux slice.
    }
  };

  if (!token) {
    return (
      <AuthShell
        eyebrow={t("Lien incomplet")}
        title={
          <>
            {t("Ce lien n’est pas")}{' '}<span className="italic text-brass-light">{t("valide.")}</span>
          </>
        }
        description={t("Le lien de réinitialisation est incomplet ou a expiré. Demandez un nouveau message pour choisir un mot de passe.")}
        footer={
          <Link
            href="/mot-de-passe-oublie"
            className="font-semibold text-sea underline decoration-sea/30 underline-offset-4 hover:text-clay"
          >
            {t("Demander un nouveau lien")}{' '}</Link>
        }
      >
        <AuthAlert>
          {t("Aucun jeton de réinitialisation n’a été trouvé dans l’adresse. Ouvrez le lien reçu par email, ou recommencez la procédure.")}{' '}</AuthAlert>
      </AuthShell>
    );
  }

  if (completed) {
    return (
      <AuthShell
        eyebrow={t("Mot de passe mis à jour")}
        title={
          <>
            {t("Votre compte est")}{' '}<span className="italic text-brass-light">{t("sécurisé.")}</span>
          </>
        }
        description={t("Vous pouvez maintenant vous connecter avec votre nouveau mot de passe. Toutes les anciennes sessions ont été fermées.")}
        footer={
          <p>
            {t("Besoin d’aide ?")}{' '}
            <Link href="/mot-de-passe-oublie" className="font-semibold text-sea underline decoration-sea/30 underline-offset-4 hover:text-clay">
              {t("Recommencer")}{' '}</Link>
          </p>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-3 border border-emerald-dz/25 bg-emerald-dz/5 px-4 py-4 text-emerald-dz">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-[11.5px] leading-relaxed">
              {notice ?? 'Mot de passe mis à jour. Vous pouvez vous connecter.'}
            </p>
          </div>
          <Link
            href="/connexion"
            className="flex h-11 items-center justify-center bg-sea text-[10px] font-bold uppercase tracking-[0.14em] text-ivory transition-colors hover:bg-sea-deep"
          >
            {t("Se connecter")}{' '}</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow={t("Nouveau mot de passe")}
      title={
        <>
          {t("Choisissez un mot de passe")}{' '}<span className="italic text-brass-light">{t("solide.")}</span>
        </>
      }
      description={t("Utilisez au moins huit caractères. Évitez les mots de passe déjà utilisés sur d’autres sites.")}
      footer={
        <Link
          href="/connexion"
          className="inline-flex items-center gap-1.5 font-semibold text-sea underline decoration-sea/30 underline-offset-4 hover:text-clay"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("Revenir à la connexion")}{' '}</Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? <AuthAlert>{error}</AuthAlert> : null}

        <PasswordField
          id="password"
          label={t("Nouveau mot de passe")}
          hint={t("8 caractères min.")}
          autoComplete="new-password"
          icon={LockKeyhole}
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setFieldErrors((current) => ({ ...current, password: undefined }));
          }}
          error={fieldErrors.password}
        />

        <PasswordField
          id="confirmPassword"
          label={t("Confirmer le mot de passe")}
          autoComplete="new-password"
          icon={LockKeyhole}
          required
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
          }}
          error={fieldErrors.confirmPassword}
        />

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 bg-clay text-[10px] font-bold uppercase tracking-[0.14em] text-ivory transition-colors hover:bg-clay-deep disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? 'Mise à jour…' : 'Enregistrer le mot de passe'}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
