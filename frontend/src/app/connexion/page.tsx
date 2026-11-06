'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, LockKeyhole, Mail } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthAlert, PasswordField, TextField } from '@/components/auth/Fields';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import {
  clearFeedback,
  login,
  selectAuthError,
  selectAuthInitialized,
  selectIsAuthenticated,
  selectPendingAction,
  selectUser,
} from '@/lib/store/authSlice';
import { dashboardPathForRole } from '@/lib/auth-routes';
import { useI18n } from '@/lib/i18n/I18nProvider';

function LoginContent() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAppSelector(selectUser);
  const authenticated = useAppSelector(selectIsAuthenticated);
  const initialized = useAppSelector(selectAuthInitialized);
  const pendingAction = useAppSelector(selectPendingAction);
  const error = useAppSelector(selectAuthError);
  const loading = pendingAction === 'login';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const nextParam = searchParams.get('next');
  const safeNext =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;

  useEffect(() => {
    dispatch(clearFeedback());
  }, [dispatch]);

  useEffect(() => {
    if (initialized && authenticated && user) {
      router.replace(safeNext ?? dashboardPathForRole(user.role, user.is_staff || user.is_superuser));
    }
  }, [authenticated, initialized, router, safeNext, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = 'Votre adresse email est requise.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Cette adresse email ne semble pas valide.';
    }
    if (!password) errors.password = 'Votre mot de passe est requis.';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const result = await dispatch(
        login({ email: email.trim().toLowerCase(), password }),
      ).unwrap();
      const target =
        safeNext ?? dashboardPathForRole(result.user.role, result.user.is_staff || result.user.is_superuser);
      router.replace(target);
    } catch {
      // The error is exposed through the Redux slice.
    }
  };

  return (
    <AuthShell
      eyebrow={t("Votre espace Bookstore.dz")}
      title={
        <>
          {t("Bon retour parmi")}{' '}<span className="italic text-brass-light">{t("les livres.")}</span>
        </>
      }
      description={t("Connectez-vous pour suivre vos commandes, gérer vos annonces ou retrouver votre librairie.")}
      footer={
        <p>
          {t("Pas encore de compte ?")}{' '}
          <Link href="/inscription" className="font-semibold text-sea underline decoration-sea/30 underline-offset-4 hover:text-clay">
            {t("Créer un compte")}{' '}</Link>
        </p>
      }
    >
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
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />

        <PasswordField
          id="password"
          label={t("Mot de passe")}
          placeholder={t("Votre mot de passe")}
          autoComplete="current-password"
          icon={LockKeyhole}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />

        <div className="flex items-center justify-end">
          <Link
            href="/mot-de-passe-oublie"
            className="text-[10.5px] font-semibold text-muted underline decoration-muted/30 underline-offset-4 hover:text-sea"
          >
            {t("Mot de passe oublié ?")}{' '}</Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 bg-sea text-[10px] font-bold uppercase tracking-[0.14em] text-ivory transition-colors hover:bg-sea-deep disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
