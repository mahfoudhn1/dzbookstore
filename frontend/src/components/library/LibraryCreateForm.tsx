'use client';

import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Loader2,
  MapPin,
  Phone,
  Store,
  Upload,
} from 'lucide-react';
import { createMyLibrary, uploadImage } from '@/lib/api';
import type { Bookstore, Wilaya } from '@/lib/types';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getLocalizedWilaya } from '@/lib/utils';
import { ZelligeDivider, ZelligeStar } from '@/components/ui/Ornaments';

interface Props {
  wilayas: Wilaya[];
  onCreated: (store: Bookstore) => void;
}

interface FormState {
  store_name: string;
  description: string;
  address: string;
  wilaya_id: number;
  phone: string;
  whatsapp: string;
  opening_hours: string;
  logo_url: string;
}

export function LibraryCreateForm({ wilayas, onCreated }: Props) {
  const { t, locale } = useI18n();
  const [form, setForm] = useState<FormState>({
    store_name: '',
    description: '',
    address: '',
    wilaya_id: 16,
    phone: '',
    whatsapp: '',
    opening_hours: 'Samedi - Jeudi : 09h00 - 19h00',
    logo_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const update = (field: keyof FormState, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const handleLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const result = await uploadImage(file);
      update('logo_url', result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Échec du téléversement de l'image."));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

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
    try {
      const store = await createMyLibrary({
        store_name: form.store_name.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        wilaya_id: Number(form.wilaya_id),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        opening_hours: form.opening_hours.trim(),
        logo_url: form.logo_url.trim(),
      });
      onCreated(store);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Création impossible.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="relative overflow-hidden border border-line bg-parchment">
      <div className="border-b border-line bg-ivory px-5 py-6 sm:px-8">
        <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-label text-clay">
          <ZelligeStar className="h-3 w-3" />
          {t('Ouvrir une librairie')}
        </div>
        <h2 className="mt-3 font-display text-[2rem] leading-[1.02] tracking-[-0.03em] text-ink sm:text-[2.5rem]">
          {t('Ouvrez votre vitrine')}{' '}
          <span className="italic text-clay">{t('sur le réseau.')}</span>
        </h2>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-muted">
          {t('Renseignez votre adresse, votre contact et votre présentation. Votre catalogue sera ensuite relié automatiquement à cette librairie.')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 px-5 py-6 sm:px-8">
        {error ? (
          <div className="border border-clay/25 bg-clay/5 px-4 py-3 text-[12px] text-clay-deep">
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
              {t('Nom de la librairie')} *
            </label>
            <input
              type="text"
              required
              value={form.store_name}
              onChange={(event) => update('store_name', event.target.value)}
              className="w-full rounded-xs border border-line bg-ivory px-3 py-2.5 text-[12px] text-ink focus:border-sea/50 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
              {t('Présentation')}
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder={t('Littérature algérienne, beaux-livres, ouvrages universitaires…')}
              className="w-full rounded-xs border border-line bg-ivory px-3 py-2.5 text-[12px] text-ink focus:border-sea/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
              {t('Wilaya')} *
            </label>
            <select
              value={form.wilaya_id}
              onChange={(event) => update('wilaya_id', Number(event.target.value))}
              className="w-full rounded-xs border border-line bg-ivory px-3 py-2.5 text-[12px] text-ink focus:border-sea/50 focus:outline-none"
            >
              {wilayas.map((wilaya) => (
                <option key={wilaya.id} value={wilaya.id}>
                  {wilaya.code} — {getLocalizedWilaya(wilaya, locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
              {t('Téléphone')} *
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-muted" />
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                className="w-full rounded-xs border border-line bg-ivory py-2.5 pl-9 pr-3 text-[12px] text-ink focus:border-sea/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
              {t('Adresse physique')} *
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                required
                value={form.address}
                onChange={(event) => update('address', event.target.value)}
                placeholder={t("Ex : 1, Place de l'Émir Abdelkader, Alger Centre")}
                className="w-full rounded-xs border border-line bg-ivory py-2.5 pl-9 pr-3 text-[12px] text-ink focus:border-sea/50 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
              {t('WhatsApp')}
            </label>
            <input
              type="tel"
              value={form.whatsapp}
              onChange={(event) => update('whatsapp', event.target.value)}
              className="w-full rounded-xs border border-line bg-ivory px-3 py-2.5 text-[12px] text-ink focus:border-sea/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
              {t("Horaires d'ouverture")}
            </label>
            <input
              type="text"
              value={form.opening_hours}
              onChange={(event) => update('opening_hours', event.target.value)}
              className="w-full rounded-xs border border-line bg-ivory px-3 py-2.5 text-[12px] text-ink focus:border-sea/50 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
              {t('Logo de la librairie')}
            </label>
            <div className="flex items-center gap-4 border border-line bg-ivory p-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-line bg-parchment">
                {form.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Store className="h-6 w-6 text-muted/50" />
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 border border-line px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-ink-soft transition-colors hover:border-sea/40 hover:text-sea">
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {t('Téléverser un logo')}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogo}
                />
              </label>
              <span className="text-[10px] text-muted">
                <ImageIcon className="mr-1 inline h-3 w-3" />
                {t('JPG, PNG ou WebP')}
              </span>
            </div>
          </div>
        </div>

        <ZelligeDivider tone="brass" />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-clay px-5 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-clay-deep disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Store className="h-3.5 w-3.5" />}
            {saving ? t('Création...') : t('Ouvrir ma librairie')}
          </button>
        </div>
      </form>
    </section>
  );
}
