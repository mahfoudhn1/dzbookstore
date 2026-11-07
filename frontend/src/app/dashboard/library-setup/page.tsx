'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Phone,
  Save,
  Store,
  Upload,
} from 'lucide-react';
import {
  createMyLibrary,
  fetchMyLibrary,
  fetchWilayas,
  updateMyLibrary,
  uploadImage,
} from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { bootstrapSession, selectUser } from '@/lib/store/authSlice';
import type { Bookstore, Wilaya } from '@/lib/types';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getMediaUrl } from '@/lib/utils';

interface LibraryForm {
  store_name: string;
  description: string;
  address: string;
  wilaya_id: number;
  commune_id: string;
  phone: string;
  whatsapp: string;
  contact_email: string;
  opening_hours: string;
  logo_url: string;
  banner_url: string;
  latitude: string;
  longitude: string;
  verification_document_url: string;
}

const EMPTY_FORM: LibraryForm = {
  store_name: '',
  description: '',
  address: '',
  wilaya_id: 16,
  commune_id: '',
  phone: '',
  whatsapp: '',
  contact_email: '',
  opening_hours: 'Samedi - Jeudi: 09h00 - 19h00',
  logo_url: '',
  banner_url: '',
  latitude: '',
  longitude: '',
  verification_document_url: '',
};

function toForm(store: Bookstore): LibraryForm {
  return {
    store_name: store.store_name || '',
    description: store.description || '',
    address: store.address || '',
    wilaya_id: store.wilaya_id || 16,
    commune_id: store.commune_id ? String(store.commune_id) : '',
    phone: store.phone || '',
    whatsapp: store.whatsapp || '',
    contact_email: store.contact_email || '',
    opening_hours: store.opening_hours || '',
    logo_url: store.logo_url || '',
    banner_url: store.banner_url || '',
    latitude: store.latitude != null ? String(store.latitude) : '',
    longitude: store.longitude != null ? String(store.longitude) : '',
    verification_document_url: '',
  };
}

export default function LibrarySetupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);

  const [library, setLibrary] = useState<Bookstore | null>(null);
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [form, setForm] = useState<LibraryForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isUpdate = Boolean(library);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [store, fetchedWilayas] = await Promise.all([
        fetchMyLibrary(),
        fetchWilayas(),
      ]);
      if (cancelled) return;
      setWilayas(fetchedWilayas);
      setLibrary(store);
      if (store) {
        setForm(toForm(store));
      } else if (user) {
        setForm((current) => ({
          ...current,
          store_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || '',
          phone: user.phone || '',
          address: user.address || '',
          wilaya_id: user.wilaya_id || 16,
        }));
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const selectedWilaya = useMemo(
    () => wilayas.find((item) => item.id === Number(form.wilaya_id)),
    [wilayas, form.wilaya_id],
  );

  const update = (field: keyof LibraryForm, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
    setSuccess('');
  };

  const handleUpload = async (
    kind: 'logo' | 'banner',
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    setError('');
    try {
      const result = await uploadImage(file);
      update(kind === 'logo' ? 'logo_url' : 'banner_url', result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Échec du téléversement de l'image."));
    } finally {
      setUploading(null);
      event.target.value = '';
    }
  };

  const payload = () => ({
    store_name: form.store_name.trim(),
    description: form.description.trim(),
    address: form.address.trim(),
    wilaya_id: Number(form.wilaya_id),
    commune_id: form.commune_id ? Number(form.commune_id) : null,
    phone: form.phone.trim(),
    whatsapp: form.whatsapp.trim(),
    contact_email: form.contact_email.trim(),
    opening_hours: form.opening_hours.trim(),
    logo_url: form.logo_url.trim(),
    banner_url: form.banner_url.trim(),
    latitude: form.latitude ? Number(form.latitude) : null,
    longitude: form.longitude ? Number(form.longitude) : null,
    verification_document_url: form.verification_document_url.trim(),
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (form.store_name.trim().length < 2) {
      setError(t('Le nom de la librairie est obligatoire.'));
      return;
    }
    if (!form.address.trim()) {
      setError(t("L'adresse physique est obligatoire."));
      return;
    }
    if (!form.phone.trim()) {
      setError(t('Le téléphone de la librairie est obligatoire.'));
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const saved = isUpdate
        ? await updateMyLibrary(payload())
        : await createMyLibrary(payload());
      setLibrary(saved);
      setForm(toForm(saved));
      await dispatch(bootstrapSession()).unwrap();
      setSuccess(
        isUpdate
          ? 'Votre vitrine librairie a été mise à jour.'
          : 'Votre librairie est ouverte ! Vous pouvez maintenant publier votre catalogue.',
      );
      router.push('/dashboard/library');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Enregistrement impossible.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted">
        <Loader2 className="h-5 w-5 animate-spin text-sea" />
        <span className="text-[11px] uppercase tracking-[0.14em]">{t('Chargement de votre librairie…')}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory pb-24">
      <div className="border-b border-[#1f5745] bg-sea px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-xs border border-emerald-400/30 bg-emerald-900/50 px-3 py-1 text-xs font-semibold text-emerald-200">
              <Store className="h-3.5 w-3.5" />
              {isUpdate ? t('Ma librairie') : t('Ouvrir une librairie')}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              {isUpdate ? form.store_name || library?.store_name : t('Devenez une librairie du réseau.')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-emerald-100">
              {t('Ces informations composent votre vitrine publique sur /libraries et relient automatiquement vos livres à votre catalogue.')}
            </p>
          </div>
          {isUpdate && library?.slug ? (
            <Link
              href={`/libraries/${library.slug}`}
              className="inline-flex items-center gap-2 rounded-xs border border-white/20 bg-parchment/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-parchment/20"
            >
              {t('Voir ma vitrine')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-5xl px-4 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-5 rounded-xs border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mb-5 flex items-start gap-2 rounded-xs border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold">{success}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold">
                <Link href="/dashboard/library" className="text-emerald-800 underline">
                  {t('Gérer mon catalogue')}
                </Link>
                <Link href="/sell" className="text-emerald-800 underline">
                  {t('Ajouter un livre')}
                </Link>
                {library?.slug ? (
                  <Link href={`/libraries/${library.slug}`} className="text-emerald-800 underline">
                    {t('Voir ma vitrine publique')}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-xs border border-line bg-parchment p-6 shadow-card sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-stone-100 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xs bg-blue-100 text-blue-700">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-ink">{t('Identité de la librairie')}</h2>
                <p className="text-xs text-muted">{t('Le nom, la présentation et les visuels affichés aux lecteurs.')}</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t('Nom de la librairie')} *
                </label>
                <input
                  type="text"
                  required
                  value={form.store_name}
                  onChange={(event) => update('store_name', event.target.value)}
                  className="w-full rounded-xs border border-line bg-ivory-deep/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e3444]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t('Présentation / Bio')}
                </label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => update('description', event.target.value)}
                  placeholder={t('Littérature algérienne, beaux-livres, ouvrages universitaires…')}
                  className="w-full rounded-xs border border-line bg-ivory-deep/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e3444]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t('Logo')}
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-line bg-ivory-deep/50">
                    {form.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getMediaUrl(form.logo_url)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted/50" />
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xs border border-line bg-ivory-deep/50 px-3 py-2 text-xs font-bold text-ink-soft transition-colors hover:bg-ivory-deep">
                    {uploading === 'logo' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {t('Téléverser')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleUpload('logo', event)}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t('Bannière')}
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-line bg-ivory-deep/50">
                    {form.banner_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getMediaUrl(form.banner_url)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted/50" />
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xs border border-line bg-ivory-deep/50 px-3 py-2 text-xs font-bold text-ink-soft transition-colors hover:bg-ivory-deep">
                    {uploading === 'banner' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {t('Téléverser')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleUpload('banner', event)}
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xs border border-line bg-parchment p-6 shadow-card sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-stone-100 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xs bg-amber-100 text-amber-700">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-ink">{t('Adresse & contact')}</h2>
                <p className="text-xs text-muted">{t('Les coordonnées qui permettent aux lecteurs de vous rendre visite.')}</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t('Wilaya')} *
                </label>
                <select
                  value={form.wilaya_id}
                  onChange={(event) => update('wilaya_id', Number(event.target.value))}
                  className="w-full rounded-xs border border-line bg-ivory-deep/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e3444]"
                >
                  {wilayas.map((wilaya) => (
                    <option key={wilaya.id} value={wilaya.id}>
                      {wilaya.code} — {wilaya.name_fr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t('Commune')}
                </label>
                <select
                  value={form.commune_id}
                  onChange={(event) => update('commune_id', event.target.value)}
                  className="w-full rounded-xs border border-line bg-ivory-deep/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e3444]"
                >
                  <option value="">{t('Sélectionner une commune')}</option>
                  {(selectedWilaya?.communes || []).map((commune) => (
                    <option key={commune.id} value={commune.id}>
                      {commune.name_fr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t('Adresse physique')} *
                </label>
                <input
                  type="text"
                  required
                  value={form.address}
                  onChange={(event) => update('address', event.target.value)}
                  placeholder={t("Ex: 1, Place de l'Émir Abdelkader, Alger Centre")}
                  className="w-full rounded-xs border border-line bg-ivory-deep/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e3444]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t('Téléphone')} *
                </label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(event) => update('phone', event.target.value)}
                  className="w-full rounded-xs border border-line bg-ivory-deep/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e3444]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t('WhatsApp')}
                </label>
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={(event) => update('whatsapp', event.target.value)}
                  className="w-full rounded-xs border border-line bg-ivory-deep/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e3444]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t('Email de contact')}
                </label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(event) => update('contact_email', event.target.value)}
                  className="w-full rounded-xs border border-line bg-ivory-deep/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e3444]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t("Horaires d'ouverture")}
                </label>
                <input
                  type="text"
                  value={form.opening_hours}
                  onChange={(event) => update('opening_hours', event.target.value)}
                  className="w-full rounded-xs border border-line bg-ivory-deep/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e3444]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t('Latitude')}
                </label>
                <input
                  type="text"
                  value={form.latitude}
                  onChange={(event) => update('latitude', event.target.value)}
                  placeholder="36.7753"
                  className="w-full rounded-xs border border-line bg-ivory-deep/50 px-4 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#0e3444]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {t('Longitude')}
                </label>
                <input
                  type="text"
                  value={form.longitude}
                  onChange={(event) => update('longitude', event.target.value)}
                  placeholder="3.0588"
                  className="w-full rounded-xs border border-line bg-ivory-deep/50 px-4 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#0e3444]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xs border border-line bg-parchment p-6 shadow-card sm:p-8">
            <div className="mb-5 flex items-center gap-3 border-b border-stone-100 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xs bg-emerald-100 text-emerald-700">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-ink">{t('Vérification professionnelle')}</h2>
                <p className="text-xs text-muted">{t('Facultatif : ajoutez le lien de votre registre de commerce pour être vérifié.')}</p>
              </div>
            </div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-soft">
              {t('Document de vérification (URL)')}
            </label>
            <input
              type="url"
              value={form.verification_document_url}
              onChange={(event) => update('verification_document_url', event.target.value)}
              placeholder="https://…"
              className="w-full rounded-xs border border-line bg-ivory-deep/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e3444]"
            />
          </section>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href={isUpdate ? '/dashboard/library' : '/dashboard/buyer'}
              className="rounded-xs border border-line bg-parchment px-5 py-3 text-sm font-bold text-ink-soft transition-colors hover:bg-ivory-deep/50"
            >
              {t('Annuler')}
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xs bg-sea px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0a2632] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isUpdate ? t('Enregistrer les modifications') : t('Ouvrir ma librairie')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
