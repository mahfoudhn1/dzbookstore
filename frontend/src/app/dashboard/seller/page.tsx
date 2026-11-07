'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppSelector } from '@/lib/store/hooks';
import { selectUser } from '@/lib/store/authSlice';
import {
  fetchSellerListings,
  createSellerListing,
  toggleSellerListingStatus,
  uploadImage
} from '@/lib/api';
import { Offer } from '@/lib/types';
import { BookCover } from '@/components/books/BookCover';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getMediaUrl } from '@/lib/utils';
import {
  BookCopy, PlusCircle, CheckCircle, Clock, Star,
  AlertCircle, Camera, ShieldAlert, Sparkles, MapPin, Tag, RefreshCw,
  Upload, Link as LinkIcon, X, Loader2, BookOpen, Store
} from 'lucide-react';

export default function IndividualSellerDashboardPage() {
  const { t } = useI18n();
  const user = useAppSelector(selectUser);
  const [activeTab, setActiveTab] = useState<'listings' | 'create'>('listings');

  // Listings state
  const [listings, setListings] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  // New secondhand book form state
  const [form, setForm] = useState({
    title: '',
    author: '',
    price: '',
    condition: 'VERY_GOOD',
    condition_description: '',
    photos: '',
    has_home_delivery: true,
    has_stop_desk_delivery: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState('');
  const [photoMode, setPhotoMode] = useState<'upload' | 'url'>('upload');

  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setPhotoUploadError(t("L'image dépasse la taille maximale de 10 Mo."));
      return;
    }

    setUploadingPhoto(true);
    setPhotoUploadError('');
    try {
      const res = await uploadImage(file);
      if (res.url) {
        setForm((prev) => ({ ...prev, photos: res.url }));
      }
    } catch (err) {
      setPhotoUploadError(
        err instanceof Error ? err.message : t("Erreur de téléversement"),
      );
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const loadListings = async () => {
    setLoading(true);
    try {
      const sellerId = user?.individual_profile?.id;
      const data = await fetchSellerListings(sellerId);
      setListings(data);
    } catch (err) {
      console.error('Failed to load seller listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload when the session user changes
    loadListings();
  }, [user]);

  const handleStatusChange = async (offerId: number, newStatus: 'ACTIVE' | 'RESERVED' | 'SOLD' | 'PAUSED') => {
    try {
      await toggleSellerListingStatus(offerId, newStatus);
      loadListings();
    } catch (err) {
      console.error('Failed to change listing status:', err);
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const sellerId = user?.individual_profile?.id;
      await createSellerListing({
        seller_id: sellerId,
        title: form.title,
        author: form.author,
        price: parseFloat(form.price),
        condition: form.condition,
        condition_description: form.condition_description,
        photos: form.photos ? form.photos.split(',').map((p) => p.trim()) : [],
        has_home_delivery: form.has_home_delivery,
        has_stop_desk_delivery: form.has_stop_desk_delivery,
      });

      setSuccessMsg('Votre livre d\'occasion a été mis en vente avec succès !');
      setForm({
        title: '',
        author: '',
        price: '',
        condition: 'VERY_GOOD',
        condition_description: '',
        photos: '',
        has_home_delivery: true,
        has_stop_desk_delivery: true,
      });
      loadListings();
      setActiveTab('listings');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Failed to create listing:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f2e7] pb-24">
      {/* Algerian Top Header */}
      <div className="bg-[#0e3444] text-white py-10 px-4 sm:px-6 lg:px-8 border-b border-[#1f5745]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-900/60 text-amber-200 text-xs font-semibold mb-3 border border-amber-400/30">
              <BookCopy className="w-3.5 h-3.5" />
              {t("Espace Particulier — Livres d'Occasion")}{' '}</div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-white tracking-tight">
                {user?.individual_profile?.display_name || user?.first_name || 'Vendeur Particulier'}
              </h1>
              <div className="flex items-center gap-1 px-3 py-1 bg-amber-400/20 text-amber-300 rounded-full text-xs font-bold border border-amber-400/30">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{t("Score Confiance :")}{' '}{user?.individual_profile?.trust_score || '4.9'} / 5</span>
              </div>
            </div>
            <p className="text-emerald-100 text-sm mt-1">
              {t("Donnez une seconde vie à vos livres en Algérie. Vente directe et sécurisée entre lecteurs.")}{' '}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!user?.bookstore_profile ? (
              <Link
                href="/dashboard/library"
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 border border-white/20"
              >
                <Store className="w-4 h-4" />
                {t("Ouvrir une librairie")}{' '}</Link>
            ) : null}
            <button
              onClick={() => setActiveTab('create')}
              className="px-4 py-2.5 bg-[#b4512f] hover:bg-[#a94824] text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              {t("Vendre un livre d'occasion")}{' '}</button>
            <button
              onClick={loadListings}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              title={t("Rafraîchir")}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Notice of Isolation from Bookstore Pro Features */}
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800">
              {t("Règles du compte particulier (Occasion) :")}{' '}</p>
            <p className="text-stone-600 mt-0.5">
              {t("En tant que vendeur particulier, vos annonces concernent des")}{' '}<strong>{t("exemplaires uniques d'occasion")}</strong> {t("avec photos réelles. Les imports massifs CSV, les vitrines professionnelles avec horaires et les registres de commerce sont réservés aux librairies physiques agréées.")}{' '}</p>
          </div>
        </div>

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 shadow-xs">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl p-2 shadow-sm border border-[#e2d6c1] flex items-center gap-2 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('listings')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === 'listings'
                ? 'bg-[#0e3444] text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <BookCopy className="w-4 h-4" />
            <span>{t("Mes Livres en Vente")}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'listings' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
            }`}>
              {listings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === 'create'
                ? 'bg-[#0e3444] text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t("Déposer une nouvelle annonce")}</span>
          </button>
        </div>

        {/* TAB 1: MY SECONDHAND LISTINGS */}
        {activeTab === 'listings' && (
          <div className="space-y-6">
            {listings.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-[#e2d6c1] shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
                  <BookCopy className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-stone-800">{t("Vous n'avez pas encore d'annonces actives")}</h3>
                <p className="text-stone-500 text-sm max-w-md mx-auto mt-1 mb-6">
                  {t("Vendez vos romans, manuels d'études ou essais littéraires qui dorment sur vos étagères à d'autres lecteurs algériens.")}{' '}</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#b4512f] text-white font-bold rounded-xl hover:bg-[#a94824] transition-colors shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  {t("Déposer une annonce d'occasion")}{' '}</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-[#e2d6c1] shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-all"
                  >
                    <div>
                      {/* Photo preview */}
                      <div className="relative h-48 w-full bg-stone-100 overflow-hidden">
                        <BookCover
                          src={item.photos?.[0] || item.work_cover}
                          title={item.work_title}
                          className="h-full w-full shadow-none"
                        />
                        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs ${
                          item.status === 'ACTIVE' ? 'bg-emerald-600 text-white' :
                          item.status === 'RESERVED' ? 'bg-amber-500 text-white' :
                          'bg-stone-800 text-white'
                        }`}>
                          {item.status === 'ACTIVE' ? 'En vente' :
                           item.status === 'RESERVED' ? 'Réservé' : 'Vendu'}
                        </span>

                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 text-stone-800 backdrop-blur-xs">
                          {item.condition_display}
                        </span>
                      </div>

                      <div className="p-5">
                        <Link href={`/books/${item.work_slug}`} className="hover:underline">
                          <h4 className="font-bold text-stone-900 text-base line-clamp-1">{item.work_title}</h4>
                        </Link>
                        {item.condition_description && (
                          <p className="text-xs text-stone-500 mt-1 line-clamp-2 italic">
                            &laquo; {item.condition_description} &raquo;
                          </p>
                        )}
                        <div className="mt-3 flex items-baseline justify-between">
                          <span className="text-xl font-black text-[#0e3444]">
                            {item.price.toLocaleString()} <span className="text-xs">{t("DA")}</span>
                          </span>
                          <span className="text-xs text-stone-400">{t("1 exemplaire")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Management */}
                    <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-stone-500">{t("Statut :")}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleStatusChange(item.id, 'ACTIVE')}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                            item.status === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-white border text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          {t("Actif")}{' '}</button>
                        <button
                          onClick={() => handleStatusChange(item.id, 'RESERVED')}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                            item.status === 'RESERVED' ? 'bg-amber-500 text-white' : 'bg-white border text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          {t("Réservé")}{' '}</button>
                        <button
                          onClick={() => handleStatusChange(item.id, 'SOLD')}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                            item.status === 'SOLD' ? 'bg-stone-800 text-white' : 'bg-white border text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          {t("Vendu")}{' '}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CREATE SECONDHAND LISTING */}
        {activeTab === 'create' && (
          <div className="bg-white rounded-2xl border border-[#e2d6c1] shadow-xs p-6 sm:p-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-stone-100">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-stone-800">{t("Déposer un livre d'occasion")}</h3>
                <p className="text-xs text-stone-400">{t("Renseignez fidèlement l'état et le prix en Dinars Algériens.")}</p>
              </div>
            </div>

            <form onSubmit={handleCreateListing} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  {t("Titre du livre *")}{' '}</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t("Ex: Nedjma, Les Misérables, L'Étranger...")}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-[#e2d6c1] rounded-xl text-sm focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  {t("Auteur (Optionnel)")}{' '}</label>
                <input
                  type="text"
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder={t("Ex: Kateb Yacine")}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-[#e2d6c1] rounded-xl text-sm focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    {t("Prix de vente (DA) *")}{' '}</label>
                  <input
                    type="number"
                    required
                    min="50"
                    step="50"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder={t("Ex: 600")}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-[#e2d6c1] rounded-xl text-sm focus:ring-2 focus:ring-[#0e3444] focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    {t("État de l'exemplaire *")}{' '}</label>
                  <select
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value })}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-[#e2d6c1] rounded-xl text-sm focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                  >
                    <option value="LIKE_NEW">{t("Comme neuf (aucune marque)")}</option>
                    <option value="VERY_GOOD">{t("Très bon état (légère usure)")}</option>
                    <option value="GOOD">{t("Bon état (lu plusieurs fois)")}</option>
                    <option value="ACCEPTABLE">{t("État acceptable (pages jaunies ou plis)")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  {t("Description de l'état réel de votre livre")}{' '}</label>
                <textarea
                  rows={3}
                  value={form.condition_description}
                  onChange={(e) => setForm({ ...form, condition_description: e.target.value })}
                  placeholder={t("Ex: Couverture impeccable, tranche propre, aucune annotation sur les pages...")}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-[#e2d6c1] rounded-xl text-sm focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                />
              </div>

              {/* Photo Upload Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    {t("Photos réelles de votre exemplaire")}
                  </label>
                  {form.photos && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, photos: '' }))}
                      className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{t("Supprimer la photo")}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-4">
                  {form.photos ? (
                    <div className="relative w-24 h-32 rounded-xl border border-[#e2d6c1] overflow-hidden shrink-0 shadow-2xs">
                      <img
                        src={getMediaUrl(form.photos)}
                        alt="Aperçu du livre"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-32 rounded-xl border-2 border-dashed border-[#e2d6c1] bg-stone-50 flex flex-col items-center justify-center p-2 text-center text-stone-400 shrink-0">
                      <Camera className="w-6 h-6 mb-1 opacity-60" />
                      <span className="text-[9px] font-medium leading-tight">{t("Aucune photo")}</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <div className="flex rounded-xl bg-stone-100 p-1 gap-1 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => { setPhotoMode('upload'); setPhotoUploadError(''); }}
                        className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${photoMode === 'upload' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-900'}`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{t("Téléverser")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPhotoMode('url'); setPhotoUploadError(''); }}
                        className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${photoMode === 'url' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-900'}`}
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>{t("URL")}</span>
                      </button>
                    </div>

                    {photoMode === 'upload' ? (
                      <div className="border border-dashed border-stone-300 rounded-xl p-3 text-center bg-stone-50 hover:bg-stone-100/60 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoFileUpload}
                          className="hidden"
                          id="seller-photo-file"
                          disabled={uploadingPhoto}
                        />
                        <label htmlFor="seller-photo-file" className="cursor-pointer block">
                          {uploadingPhoto ? (
                            <div className="flex items-center justify-center gap-2 py-1 text-[#0e3444] text-xs font-bold">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{t("Téléversement...")}</span>
                            </div>
                          ) : (
                            <div className="text-xs font-bold text-stone-700">
                              <Upload className="w-4 h-4 mx-auto mb-1 text-stone-400" />
                              <span>{t("Choisir une image depuis l'appareil")}</span>
                            </div>
                          )}
                        </label>
                      </div>
                    ) : (
                      <input
                        type="url"
                        value={form.photos}
                        onChange={(e) => setForm({ ...form, photos: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-stone-50 border border-[#e2d6c1] rounded-xl text-xs focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                      />
                    )}

                    {photoUploadError && (
                      <p className="text-[11px] text-red-600">{photoUploadError}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#b4512f] hover:bg-[#a94824] text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4" />
                  {submitting ? 'Publication en cours...' : 'Mettre mon livre en vente'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
