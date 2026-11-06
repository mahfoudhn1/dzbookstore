'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookCopy,
  BookOpen,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Store,
  User,
} from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import {
  AuthAlert,
  PasswordField,
  SelectField,
  TextField,
} from '@/components/auth/Fields';
import { WILAYAS } from '@/lib/wilayas';
import { getLocalizedWilaya } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import {
  clearFeedback,
  register,
  selectAuthError,
  selectAuthNotice,
  selectDemoVerificationToken,
  selectIsAuthenticated,
  selectPendingAction,
  selectUser,
} from '@/lib/store/authSlice';
import { dashboardPathForRole } from '@/lib/auth-routes';
import { useI18n } from '@/lib/i18n/I18nProvider';

type RoleValue = 'BUYER' | 'BOOKSTORE_SELLER' | 'INDIVIDUAL_SELLER';

const ROLE_OPTIONS: {
  value: RoleValue;
  label: string;
  note: string;
  icon: typeof User;
}[] = [
  {
    value: 'BUYER',
    label: 'Lecteur',
    note: 'Acheter, suivre mes commandes et enregistrer mes envies.',
    icon: BookOpen,
  },
  {
    value: 'BOOKSTORE_SELLER',
    label: 'Librairie',
    note: 'Présenter mon catalogue et gérer les commandes de ma boutique.',
    icon: Store,
  },
  {
    value: 'INDIVIDUAL_SELLER',
    label: 'Particulier',
    note: 'Mettre en vente mes livres d’occasion près de chez moi.',
    icon: BookCopy,
  },
];

interface FormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  wilayaId: string;
  storeName: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

const initialForm: FormState = {
  name: '',
  email: '',
  phone: '',
  address: '',
  wilayaId: '16',
  storeName: '',
  password: '',
  confirmPassword: '',
  terms: false,
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

export default function RegisterPage() {
  const { t, locale } = useI18n();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const authenticated = useAppSelector(selectIsAuthenticated);
  const pendingAction = useAppSelector(selectPendingAction);
  const error = useAppSelector(selectAuthError);
  const notice = useAppSelector(selectAuthNotice);
  const demoToken = useAppSelector(selectDemoVerificationToken);
  const loading = pendingAction === 'register';

  const [role, setRole] = useState<RoleValue>('BUYER');
  const [form, setForm] = useState<FormState>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [registered, setRegistered] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    dispatch(clearFeedback());
  }, [dispatch]);

  useEffect(() => {
    if (authenticated && user && !startedRef.current && !registered) {
      router.replace(dashboardPathForRole(user.role, user.is_staff || user.is_superuser));
    }
  }, [authenticated, registered, router, user]);

  const update = (field: keyof FormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (form.name.trim().length < 2) errors.name = 'Indiquez au moins deux caractères.';
    if (!form.email.trim()) errors.email = 'Votre adresse email est requise.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Cette adresse email ne semble pas valide.';
    }
    if (form.phone.trim() && !/^0[5-7][0-9\s.-]{7,}$/.test(form.phone.trim())) {
      errors.phone = 'Saisissez un numéro algérien valide (05, 06 ou 07).';
    }
    if (role === 'BOOKSTORE_SELLER' && form.storeName.trim().length < 2) {
      errors.storeName = 'Le nom de la librairie est requis.';
    }
    if (form.password.length < 8) {
      errors.password = 'Le mot de passe doit contenir au moins 8 caractères.';
    }
    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Les deux mots de passe ne correspondent pas.';
    }
    if (!form.terms) errors.terms = 'Veuillez accepter les conditions d’utilisation.';
    return errors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startedRef.current = true;
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await dispatch(
        register({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          name: form.name.trim(),
          role,
          phone: form.phone.trim(),
          address: form.address.trim(),
          wilaya_id: Number(form.wilayaId),
          store_name: role === 'BOOKSTORE_SELLER' ? form.storeName.trim() : undefined,
        }),
      ).unwrap();
      setRegistered(true);
    } catch {
      // The error is exposed through the Redux slice.
    }
  };

  if (registered) {
    return (
      <AuthShell
        eyebrow={t("Bienvenue dans la communauté")}
        title={
          <>
            {t("Votre compte est")}{' '}<span className="italic text-brass-light">{t("créé.")}</span>
          </>
        }
        description={t("Vous pouvez dès maintenant explorer le catalogue, publier vos livres ou préparer votre vitrine de librairie.")}
        footer={
          <p>
            {t("Un problème ?")}{' '}
            <Link href="/connexion" className="font-semibold text-sea underline decoration-sea/30 underline-offset-4 hover:text-clay">
              {t("Se connecter")}{' '}</Link>
          </p>
        }
      >
        <div className="space-y-4">
          <AuthAlert tone="success">
            {notice ?? 'Compte créé avec succès. Vérifiez votre boîte mail pour confirmer votre adresse.'}
          </AuthAlert>

          <div className="border border-line bg-ivory px-4 py-3 text-[11.5px] leading-relaxed text-muted">
            <p className="font-semibold text-ink">{t("Prochaine étape : vérifier votre email")}</p>
            <p className="mt-1">
              {t("Un message a été envoyé à")}{' '}<span className="font-medium text-ink">{form.email}</span>{' '}
              {t("(ou s’affiche dans les logs du serveur en développement). Le lien reste valable 24 heures.")}{' '}</p>
          </div>

          {demoToken ? (
            <Link
              href={`/verifier-email?token=${encodeURIComponent(demoToken)}`}
              className="flex h-10 items-center justify-center border border-clay/30 bg-clay/5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-clay transition-colors hover:bg-clay/10"
            >
              {t("Vérifier mon email (mode développement)")}{' '}</Link>
          ) : null}

          <button
            type="button"
            onClick={() =>
              router.push(
                dashboardPathForRole(
                  (user?.role ?? role) as RoleValue,
                  user?.is_staff || user?.is_superuser,
                ),
              )
            }
            className="flex h-11 w-full items-center justify-center bg-sea text-[10px] font-bold uppercase tracking-[0.14em] text-ivory transition-colors hover:bg-sea-deep"
          >
            {t("Accéder à mon espace")}{' '}</button>

          <Link
            href="/"
            className="flex h-10 items-center justify-center border border-line text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-sea hover:text-sea"
          >
            {t("Continuer la découverte")}{' '}</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow={t("Créer un compte")}
      title={
        <>
          {t("Rejoignez la librairie")}{' '}<span className="italic text-brass-light">{t("ouverte.")}</span>
        </>
      }
      description={t("Un seul compte pour acheter, vendre vos livres d’occasion ou gérer votre librairie.")}
      footer={
        <p>
          {t("Vous avez déjà un compte ?")}{' '}
          <Link href="/connexion" className="font-semibold text-sea underline decoration-sea/30 underline-offset-4 hover:text-clay">
            {t("Se connecter")}{' '}</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? <AuthAlert>{error}</AuthAlert> : null}

        <fieldset>
          <legend className="mb-2 text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
            {t("Je crée ce compte en tant que")}{' '}</legend>
          <div className="grid grid-cols-3 gap-2">
            {ROLE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = role === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRole(option.value)}
                  aria-pressed={active}
                  title={option.note}
                  className={
                    active
                      ? 'flex flex-col items-center gap-2 border border-sea bg-sea/5 px-2 py-3 text-sea'
                      : 'flex flex-col items-center gap-2 border border-line bg-ivory px-2 py-3 text-muted transition-colors hover:border-sea/40 hover:text-sea'
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em]">
                    {t(option.label)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 min-h-4 text-[10.5px] leading-relaxed text-muted">
            {t(ROLE_OPTIONS.find((option) => option.value === role)?.note || '')}
          </p>
        </fieldset>

        <TextField
          id="name"
          label={role === 'BOOKSTORE_SELLER' ? t('Nom du responsable') : t('Nom complet')}
          placeholder={t("Votre nom")}
          autoComplete="name"
          icon={User}
          required
          value={form.name}
          onChange={(event) => update('name', event.target.value)}
          error={fieldErrors.name}
        />

        {role === 'BOOKSTORE_SELLER' ? (
          <TextField
            id="storeName"
            label={t("Nom de la librairie")}
            placeholder={t("Librairie El Feth")}
            icon={Store}
            required
            value={form.storeName}
            onChange={(event) => update('storeName', event.target.value)}
            error={fieldErrors.storeName}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="email"
            type="email"
            label={t("Adresse email")}
            placeholder={t("vous@exemple.dz")}
            autoComplete="email"
            icon={Mail}
            required
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            error={fieldErrors.email}
          />
          <TextField
            id="phone"
            type="tel"
            label={t("Téléphone")}
            hint={t("optionnel")}
            placeholder="0550 00 00 00"
            autoComplete="tel"
            icon={Phone}
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
            error={fieldErrors.phone}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="wilaya"
            label={t("Wilaya")}
            required
            value={form.wilayaId}
            onChange={(event) => update('wilayaId', event.target.value)}
          >
            {WILAYAS.map((wilaya) => (
              <option key={wilaya.id} value={wilaya.id}>
                {wilaya.code} — {getLocalizedWilaya(wilaya, locale)}
              </option>
            ))}
          </SelectField>
          <TextField
            id="address"
            label={t("Adresse")}
            hint={t("optionnel")}
            placeholder={t("Rue, quartier")}
            autoComplete="street-address"
            icon={MapPin}
            value={form.address}
            onChange={(event) => update('address', event.target.value)}
            error={fieldErrors.address}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            id="password"
            label={t("Mot de passe")}
            hint={t("8 caractères min.")}
            autoComplete="new-password"
            icon={LockKeyhole}
            required
            value={form.password}
            onChange={(event) => update('password', event.target.value)}
            error={fieldErrors.password}
          />
          <PasswordField
            id="confirmPassword"
            label={t("Confirmer")}
            autoComplete="new-password"
            icon={LockKeyhole}
            required
            value={form.confirmPassword}
            onChange={(event) => update('confirmPassword', event.target.value)}
            error={fieldErrors.confirmPassword}
          />
        </div>

        <label className="flex items-start gap-2.5 text-[11px] leading-relaxed text-muted">
          <input
            type="checkbox"
            checked={form.terms}
            onChange={(event) => update('terms', event.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-[#0e3444]"
          />
          <span>
            {t("J’accepte les conditions d’utilisation et la politique de confidentialité de Bookstore.dz.")}{' '}</span>
        </label>
        {fieldErrors.terms ? (
          <p className="-mt-2 text-[10.5px] text-clay">{fieldErrors.terms}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 bg-clay text-[10px] font-bold uppercase tracking-[0.14em] text-ivory transition-colors hover:bg-clay-deep disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>
    </AuthShell>
  );
}
