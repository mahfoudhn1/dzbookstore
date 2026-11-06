'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookCover } from '@/components/books/BookCover';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import { selectUser, updateProfile } from '@/lib/store/authSlice';
import {
  fetchBuyerOrders,
  fetchBuyerWishlist,
  toggleWishlist,
  submitSellerReview,
  fetchWilayas
} from '@/lib/api';
import { Order, WishlistItem, Wilaya } from '@/lib/types';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { ZelligeField, ZelligeStar } from '@/components/ui/Ornaments';
import {
  Package, Heart, User, MapPin, Phone, Truck,
  CheckCircle, Star, ExternalLink, RefreshCw, Store
} from 'lucide-react';

export default function BuyerDashboardPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'profile'>('orders');
  
  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightOrderId, setHighlightOrderId] = useState<number | null>(null);

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    wilaya_id: 16,
    address: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedOrders, fetchedWishlist, fetchedWilayas] = await Promise.all([
        fetchBuyerOrders(user?.email),
        fetchBuyerWishlist(user?.id),
        fetchWilayas(),
      ]);
      setOrders(fetchedOrders);
      setWishlist(fetchedWishlist);
      setWilayas(fetchedWilayas);

      if (user) {
        setProfileForm({
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          phone: user.phone || '',
          wilaya_id: user.wilaya_id || 16,
          address: user.address || '',
        });
      }
    } catch (err) {
      console.error('Failed to load buyer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload when the session user changes
    loadData();
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedOrder = Number(params.get('order') ?? '');
    if (Number.isFinite(requestedOrder) && requestedOrder > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deep-link from a notification
      setHighlightOrderId(requestedOrder);
      setActiveTab('orders');
    }
    if (params.get('tab') === 'wishlist') setActiveTab('wishlist');
    if (params.get('tab') === 'profile') setActiveTab('profile');
  }, []);

  useEffect(() => {
    if (!highlightOrderId || orders.length === 0) return;
    const node = document.getElementById(`order-${highlightOrderId}`);
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightOrderId, orders.length]);

  const handleToggleWishlist = async (workId: number) => {
    await toggleWishlist(workId, user?.id);
    const updated = await fetchBuyerWishlist(user?.id);
    setWishlist(updated);
  };

  const handleOpenReviewModal = (order: Order) => {
    setSelectedOrder(order);
    setReviewRating(5);
    setReviewComment('');
    setReviewSuccess(false);
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setReviewSubmitting(true);
    try {
      const firstItem = selectedOrder.items[0];
      await submitSellerReview({
        buyer_id: user?.id,
        seller_type: firstItem ? firstItem.seller_type : 'BOOKSTORE',
        bookstore_id: firstItem && firstItem.seller_type === 'BOOKSTORE' ? parseInt(firstItem.seller_id) : undefined,
        individual_seller_id: firstItem && firstItem.seller_type === 'INDIVIDUAL' ? parseInt(firstItem.seller_id) : undefined,
        rating: reviewRating,
        comment: reviewComment,
      });
      setReviewSuccess(true);
      setTimeout(() => {
        setReviewModalOpen(false);
        setReviewSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await dispatch(
        updateProfile({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
          phone: profileForm.phone,
          wilaya_id: Number(profileForm.wilaya_id),
          address: profileForm.address,
        }),
      ).unwrap();
      setProfileSuccessMsg('Vos coordonnées ont été mises à jour avec succès.');
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setProfileSaving(false);
    }
  };

  const getStatusStepIndex = (status: string) => {
    switch (status) {
      case 'PENDING': return 0;
      case 'CONFIRMED': return 1;
      case 'PREPARING': return 2;
      case 'SHIPPED':
      case 'READY_FOR_PICKUP': return 3;
      case 'DELIVERED': return 4;
      default: return 0;
    }
  };

  return (
    <div className="min-h-screen bg-ivory pb-24">
      {/* Editorial top band */}
      <div className="relative overflow-hidden border-b border-[#1f5745] bg-sea px-4 py-10 text-ivory sm:px-6 lg:px-8 lg:py-14">
        <ZelligeField className="text-ivory" opacity={0.055} />
        <div className="relative mx-auto flex max-w-[1440px] flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 border border-brass-light/35 bg-ivory/[0.06] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-brass-light">
              <ZelligeStar className="h-2.5 w-2.5" />
              {t("Espace Lecteur & Acheteur")}{' '}</div>
            <h1 className="mt-3 font-display text-[2.6rem] leading-[0.98] tracking-[-0.04em] text-ivory">
              {t("Bonjour,")}{' '}{user?.first_name || 'Lecteur'} !
            </h1>
            <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-ivory/60">
              {t("Gérez vos commandes de livres, vos librairies favorites et votre adresse de livraison en Algérie.")}{' '}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!user?.bookstore_profile ? (
              <Link
                href="/dashboard/library"
                className="px-4 py-2.5 bg-clay hover:bg-clay-deep text-ivory rounded-xs text-sm font-bold transition-colors flex items-center gap-2"
              >
                <Store className="w-4 h-4" />
                {t("Ouvrir une librairie")}{' '}</Link>
            ) : (
              <Link
                href="/dashboard/library"
                className="px-4 py-2.5 bg-parchment/10 hover:bg-parchment/20 text-ivory rounded-xs text-sm font-semibold transition-colors flex items-center gap-2 border border-ivory/20"
              >
                <Store className="w-4 h-4" />
                {t("Ma librairie")}{' '}</Link>
            )}
            <Link
              href="/"
              className="px-4 py-2.5 bg-parchment/10 hover:bg-parchment/20 text-ivory rounded-xs text-sm font-semibold transition-colors flex items-center gap-2 border border-ivory/20"
            >
              {t("Découvrir des livres")}{' '}</Link>
            <button
              onClick={loadData}
              className="p-2.5 bg-parchment/10 hover:bg-parchment/20 text-ivory rounded-xs transition-colors"
              title={t("Rafraîchir")}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Editorial underline tabs */}
        <div className="mb-8 flex items-center gap-6 overflow-x-auto border-b border-line pt-8 no-scrollbar">
          {[
            { id: 'orders' as const, label: t('Mes Commandes'), icon: Package, count: orders.length },
            { id: 'wishlist' as const, label: t('Mes Favoris'), icon: Heart, count: wishlist.length },
            { id: 'profile' as const, label: t('Mon Profil'), icon: User, count: null },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex shrink-0 items-center gap-2 pb-3 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                  active ? 'text-sea' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 ? (
                  <span className="border border-line bg-ivory px-1.5 py-0.5 text-[8px] text-muted">
                    {tab.count}
                  </span>
                ) : null}
                <span
                  className={`absolute bottom-0 left-0 h-px w-full bg-clay transition-transform ${
                    active ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {orders.length === 0 ? (
              <div className="bg-parchment rounded-xs p-12 text-center border border-line shadow-card">
                <div className="w-16 h-16 rounded-xs bg-ivory-deep text-muted flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-ink">{t("Aucune commande pour le moment")}</h3>
                <p className="text-muted text-sm max-w-md mx-auto mt-1 mb-6">
                  {t("Vous n'avez pas encore passé de commande. Explorez notre catalogue pour trouver des livres neufs en librairie ou d'occasion.")}{' '}</p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-sea text-ivory font-bold rounded-xs hover:bg-sea-deep transition-colors"
                >
                  {t("Découvrir le catalogue")}{' '}</Link>
              </div>
            ) : (
              orders.map((order) => {
                const step = getStatusStepIndex(order.status);
                return (
                  <div
                    key={order.id}
                    id={`order-${order.id}`}
                    className={`bg-parchment rounded-xs border shadow-card overflow-hidden transition-all hover:shadow-card ${
                      highlightOrderId === order.id
                        ? 'border-clay/60 ring-2 ring-clay/20'
                        : 'border-line'
                    }`}
                  >
                    {/* Header */}
                    <div className="p-5 sm:p-6 bg-ivory-deep/50/70 border-b border-line flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xs bg-emerald-100 text-sea flex items-center justify-center font-bold text-xs">
                          {t("DZ")}{' '}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-ink text-base">{order.order_number}</span>
                            <span className="px-2.5 py-0.5 rounded-xs text-xs font-bold bg-sea/10 text-sea">
                              {order.status_display}
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            {t("Commandé le")}{' '}{new Date(order.created_at).toLocaleDateString('fr-DZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-muted">{t("Total réglé")}</p>
                        <p className="text-xl font-black text-sea">
                          {order.total_amount.toLocaleString()} <span className="text-xs font-bold">{t("DA")}</span>
                        </p>
                      </div>
                    </div>

                    {/* Algerian Real-Time Tracking Stepper */}
                    <div className="p-6 bg-ivory-deep/50/30 border-b border-line">
                      <p className="text-xs font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-clay" />
                        {t("Suivi en temps réel de votre commande")}{' '}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
                        {/* Step 1: Confirmée */}
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xs flex items-center justify-center text-xs font-bold shrink-0 ${
                            step >= 1 ? 'bg-emerald-600 text-ivory' : 'bg-line/30 text-muted'
                          }`}>
                            {step >= 1 ? <CheckCircle className="w-4 h-4" /> : '1'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-ink">{t("1. Confirmée")}</p>
                            <p className="text-[11px] text-muted">{t("Par la librairie")}</p>
                          </div>
                        </div>

                        {/* Step 2: En préparation */}
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xs flex items-center justify-center text-xs font-bold shrink-0 ${
                            step >= 2 ? 'bg-emerald-600 text-ivory' : 'bg-line/30 text-muted'
                          }`}>
                            {step >= 2 ? <CheckCircle className="w-4 h-4" /> : '2'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-ink">{t("2. En préparation")}</p>
                            <p className="text-[11px] text-muted">{t("Emballage sécurisé")}</p>
                          </div>
                        </div>

                        {/* Step 3: Expédiée */}
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xs flex items-center justify-center text-xs font-bold shrink-0 ${
                            step >= 3 ? 'bg-emerald-600 text-ivory' : 'bg-line/30 text-muted'
                          }`}>
                            {step >= 3 ? <CheckCircle className="w-4 h-4" /> : '3'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-ink">
                              {order.delivery_type === 'STORE_PICKUP' ? '3. Prête en magasin' : '3. En expédition'}
                            </p>
                            <p className="text-[11px] text-muted">{t("Yalidine / ZR Express")}</p>
                          </div>
                        </div>

                        {/* Step 4: Livrée */}
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xs flex items-center justify-center text-xs font-bold shrink-0 ${
                            step >= 4 ? 'bg-emerald-600 text-ivory' : 'bg-line/30 text-muted'
                          }`}>
                            {step >= 4 ? <CheckCircle className="w-4 h-4" /> : '4'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-ink">{t("4. Livrée")}</p>
                            <p className="text-[11px] text-muted">{t("Remise au lecteur")}</p>
                          </div>
                        </div>
                      </div>

                      {/* Tracking number badge if available */}
                      {order.tracking_number && (
                        <div className="mt-4 p-3 rounded-xs bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-emerald-700" />
                            <span>{t("Numéro de suivi Yalidine :")}{' '}<strong>{order.tracking_number}</strong></span>
                          </div>
                          <a
                            href={`https://yalidine.com/tracking?tracking=${order.tracking_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 hover:text-emerald-900 font-bold underline flex items-center gap-1"
                          >
                            {t("Suivre le colis")}{' '}<ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {order.seller_notes && (
                        <div className="mt-2 text-xs text-ink-soft bg-amber-50/80 p-2.5 rounded-xs border border-amber-200">
                          <strong>{t("Note de la librairie :")}</strong> {order.seller_notes}
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="p-6">
                      <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                        {t("Articles commandés")} ({order.items.length})
                      </h4>
                      <div className="divide-y divide-stone-100">
                        {order.items.map((item) => (
                          <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="h-14 w-10 shrink-0 overflow-hidden rounded-xs bg-ivory-deep">
                                <BookCover
                                  src={item.offer_cover}
                                  title={item.offer_title}
                                  className="h-full w-full shadow-none"
                                />
                              </div>
                              <div>
                                <p className="font-bold text-ink text-sm">{item.offer_title}</p>
                                <p className="text-xs text-muted">
                                  {t("Vendeur :")}{' '}{item.seller_type === 'BOOKSTORE' ? 'Librairie Partenaire' : 'Particulier'} {t("• Qté :")}{' '}{item.quantity}
                                </p>
                              </div>
                            </div>
                            <span className="font-bold text-ink text-sm">
                              {(item.unit_price * item.quantity).toLocaleString()} {t("DA")}{' '}</span>
                          </div>
                        ))}
                      </div>

                      {/* Delivery address & review button */}
                      <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-clay" />
                          <span>{t("Livraison à :")}{' '}<strong>{order.recipient_name}</strong>, {order.recipient_wilaya_name} ({order.recipient_address})</span>
                        </div>

                        <button
                          onClick={() => handleOpenReviewModal(order)}
                          className="px-4 py-2 bg-ivory-deep hover:bg-sea hover:text-ivory text-ink font-bold rounded-xs transition-all flex items-center gap-1.5 shadow-card"
                        >
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          {t("Laisser un avis sur le vendeur")}{' '}</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: WISHLIST */}
        {activeTab === 'wishlist' && (
          <div>
            {wishlist.length === 0 ? (
              <div className="bg-parchment rounded-xs p-12 text-center border border-line shadow-card">
                <div className="w-16 h-16 rounded-xs bg-rose-50 text-rose-400 flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-ink">{t("Votre liste de favoris est vide")}</h3>
                <p className="text-muted text-sm max-w-md mx-auto mt-1 mb-6">
                  {t("Sauvegardez les livres qui vous intéressent pour être notifié des meilleures offres de librairies à proximité.")}{' '}</p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-sea text-ivory font-bold rounded-xs hover:bg-sea-deep transition-colors"
                >
                  {t("Explorer les livres")}{' '}</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {wishlist.map((item) => (
                  <div
                    key={item.id}
                    className="bg-parchment rounded-xs border border-line overflow-hidden shadow-card hover:shadow-card transition-all flex flex-col justify-between"
                  >
                    <div className="p-5 flex gap-4">
                      <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xs bg-ivory-deep shadow-card">
                        <BookCover
                          src={item.work_cover}
                          title={item.work_title}
                          className="h-full w-full shadow-none"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-ink text-base line-clamp-2 leading-tight">
                          {item.work_title}
                        </h4>
                        <div className="mt-3">
                          <span className="text-[10px] text-muted font-semibold uppercase">{t("Meilleur prix dès")}</span>
                          <p className="text-lg font-black text-sea">
                            {item.min_price ? `${item.min_price.toLocaleString()} DA` : 'Voir les offres'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-3 bg-ivory-deep/50 border-t border-stone-100 flex items-center justify-between">
                      <Link
                        href={`/books/${item.work_slug}`}
                        className="text-xs font-bold text-sea hover:underline"
                      >
                        {t("Comparer les vendeurs →")}{' '}</Link>
                      <button
                        onClick={() => handleToggleWishlist(item.work)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                      >
                        {t("Retirer")}{' '}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROFILE */}
        {activeTab === 'profile' && (
          <div className="bg-parchment rounded-xs border border-line shadow-card p-6 sm:p-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-stone-100">
              <div className="w-12 h-12 rounded-xs bg-emerald-100 text-sea flex items-center justify-center font-bold">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-ink">{t("Mes Informations Personnelles")}</h3>
                <p className="text-xs text-muted">{t("Ces informations facilitent la livraison dans votre wilaya.")}</p>
              </div>
            </div>

            {profileSuccessMsg && (
              <div className="mb-6 p-4 rounded-xs bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-1.5">
                    {t("Prénom")}{' '}</label>
                  <input
                    type="text"
                    required
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-ivory-deep/50 border border-line rounded-xs text-sm focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-1.5">
                    {t("Nom")}{' '}</label>
                  <input
                    type="text"
                    required
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-ivory-deep/50 border border-line rounded-xs text-sm focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-1.5">
                  {t("Numéro de téléphone (Format algérien)")}{' '}</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-muted absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    placeholder="0550 12 34 56"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-ivory-deep/50 border border-line rounded-xs text-sm focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-1.5">
                  {t("Wilaya de résidence (Algérie)")}{' '}</label>
                <select
                  value={profileForm.wilaya_id}
                  onChange={(e) => setProfileForm({ ...profileForm, wilaya_id: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-ivory-deep/50 border border-line rounded-xs text-sm focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                >
                  {wilayas.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} - {w.name_fr} ({w.name_ar})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider mb-1.5">
                  {t("Adresse complète / Commune de livraison")}{' '}</label>
                <textarea
                  rows={3}
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  placeholder={t("Ex: Cité 500 Logements, Bâtiment B, Alger Centre")}
                  className="w-full px-4 py-2.5 bg-ivory-deep/50 border border-line rounded-xs text-sm focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="w-full py-3 bg-sea hover:bg-sea-deep text-ivory font-bold rounded-xs text-sm transition-all shadow-card flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {profileSaving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-parchment rounded-xs max-w-md w-full p-6 shadow-lift border border-line relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-ink mb-1">
              {t("Évaluer la transaction")}{' '}</h3>
            <p className="text-xs text-muted mb-4">
              {t("Commande")}{' '}{selectedOrder.order_number}
            </p>

            {reviewSuccess ? (
              <div className="p-6 text-center text-emerald-700">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-600" />
                <p className="font-bold text-base">{t("Merci pour votre avis !")}</p>
                <p className="text-xs text-muted mt-1">{t("Votre retour aide la communauté de lecteurs algériens.")}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-ink-soft mb-2">
                    {t("Note globale (sur 5 étoiles)")}{' '}</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            star <= reviewRating
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-muted/50'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-ink-soft ml-2">
                      {reviewRating} / 5
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-soft mb-1.5">
                    {t("Votre commentaire sur la librairie ou le vendeur")}{' '}</label>
                  <textarea
                    rows={4}
                    required
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder={t("Livre bien emballé, état conforme à l'annonce, retrait rapide en librairie...")}
                    className="w-full px-3.5 py-2.5 bg-ivory-deep/50 border border-line rounded-xs text-sm focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-ink-soft hover:bg-ivory-deep rounded-xs"
                  >
                    {t("Annuler")}{' '}</button>
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="px-5 py-2.5 bg-sea hover:bg-sea-deep text-ivory font-bold text-xs rounded-xs shadow-card disabled:opacity-50"
                  >
                    {reviewSubmitting ? 'Publication...' : 'Publier mon avis'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
