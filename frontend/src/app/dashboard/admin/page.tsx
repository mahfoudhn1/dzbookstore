'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppSelector } from '@/lib/store/hooks';
import { selectUser } from '@/lib/store/authSlice';
import {
  fetchAdminAnalytics,
  fetchAdminBookstores,
  verifyBookstore,
  fetchAdminUsers,
  toggleSuspendUser
} from '@/lib/api';
import { AdminAnalytics, Bookstore, AdminUser } from '@/lib/types';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  ShieldAlert, ShieldCheck, Users, Store, BookOpen,
  DollarSign, Search, CheckCircle, XCircle,
  RefreshCw
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const user = useAppSelector(selectUser);
  const [activeTab, setActiveTab] = useState<'analytics' | 'bookstores' | 'users'>('analytics');

  // Data states
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [bookstores, setBookstores] = useState<Bookstore[]>([]);
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & search
  const [userSearch, setUserSearch] = useState('');
  const [bookstoreFilter, setBookstoreFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED'>('ALL');

  // Verify modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Bookstore | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedAnalytics, fetchedBookstores, fetchedUsers] = await Promise.all([
        fetchAdminAnalytics(),
        fetchAdminBookstores(),
        fetchAdminUsers(),
      ]);
      setAnalytics(fetchedAnalytics);
      setBookstores(fetchedBookstores);
      setUsersList(fetchedUsers);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial dashboard load
    loadData();
  }, []);

  const handleVerify = async (storeId: number) => {
    setProcessingAction(true);
    try {
      await verifyBookstore(storeId, 'VERIFY', 'Librairie certifiée après vérification des pièces justificatives.');
      loadData();
    } catch (err) {
      console.error('Failed to verify bookstore:', err);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleOpenRejectModal = (store: Bookstore) => {
    setSelectedStore(store);
    setRejectionNotes('Registre de commerce illisible ou informations non conformes.');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore) return;
    setProcessingAction(true);
    try {
      await verifyBookstore(selectedStore.id, 'REJECT', rejectionNotes);
      setRejectModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Failed to reject bookstore:', err);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleToggleSuspend = async (userId: number) => {
    try {
      await toggleSuspendUser(userId);
      loadData();
    } catch (err) {
      console.error('Failed to toggle user suspension:', err);
    }
  };

  const filteredBookstores = bookstores.filter((s) => {
    if (bookstoreFilter === 'PENDING') return s.verification_status === 'PENDING';
    if (bookstoreFilter === 'VERIFIED') return s.is_verified;
    return true;
  });

  const filteredUsers = usersList.filter((u) => {
    const term = userSearch.toLowerCase();
    return (
      u.email.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      u.first_name.toLowerCase().includes(term) ||
      u.last_name.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-[#f7f2e7] pb-24">
      {/* Algerian Top Bar */}
      <div className="bg-[#0e3444] text-white py-10 px-4 sm:px-6 lg:px-8 border-b border-[#1f5745]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-900/60 text-purple-200 text-xs font-semibold mb-3 border border-purple-400/30">
              <ShieldAlert className="w-3.5 h-3.5 text-purple-300" />
              {t("Supervision Nationale — Backoffice Administrateur")}{' '}</div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              {t("Tableau de Bord Plateforme Bookstore.dz")}{' '}</h1>
            <p className="text-emerald-100 text-sm mt-1">
              {t("Pilotage des flux de commandes, agrément des librairies professionnelles et modération des comptes.")}{' '}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 border border-white/20"
            >
              <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
              {t("Actualiser les données")}{' '}</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        {/* KPI Platform Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-[#e2d6c1] shadow-xs">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">{t("Volume d'Affaires Global")}</p>
            <p className="text-2xl font-black text-[#0e3444] mt-1">
              {analytics?.total_gmv_dzd ? analytics.total_gmv_dzd.toLocaleString() : '0'} <span className="text-sm">{t("DA")}</span>
            </p>
            <p className="text-[11px] text-stone-500 mt-1">{t("Sur l'ensemble des 58 Wilayas")}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#e2d6c1] shadow-xs">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">{t("Commandes Totales")}</p>
            <p className="text-2xl font-black text-stone-900 mt-1">
              {analytics?.total_orders || 0}
            </p>
            <p className="text-[11px] text-stone-500 mt-1">{t("Passées via le checkout multi-vendeurs")}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#e2d6c1] shadow-xs">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">{t("Librairies Agréées")}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-black text-blue-700">
                {analytics?.verified_bookstores_count || 0}
              </span>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {analytics?.pending_bookstores_count || 0} {t("en attente")}{' '}</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">{t("Sur")}{' '}{analytics?.bookstores_count || 0} {t("enseignes inscrites")}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#e2d6c1] shadow-xs">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">{t("Couverture Territoriale")}</p>
            <p className="text-2xl font-black text-[#b4512f] mt-1">
              {analytics?.covered_wilayas_count || 0} <span className="text-sm">{t("/ 58 Wilayas")}</span>
            </p>
            <p className="text-[11px] text-stone-500 mt-1">{t("Points de retrait et vendeurs actifs")}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl p-2 shadow-sm border border-[#e2d6c1] flex items-center gap-2 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('analytics')}
            className={activeTab === 'analytics' ? 'flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap bg-[#0e3444] text-white shadow-sm' : 'flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap text-stone-600 hover:bg-stone-100'}
          >
            <DollarSign className="w-4 h-4" />
            <span>{t("Vue Générale & Ratios")}</span>
          </button>

          <button
            onClick={() => setActiveTab('bookstores')}
            className={activeTab === 'bookstores' ? 'flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap bg-[#0e3444] text-white shadow-sm' : 'flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap text-stone-600 hover:bg-stone-100'}
          >
            <Store className="w-4 h-4" />
            <span>{t("Vérification des Librairies")}</span>
            <span className={activeTab === 'bookstores' ? 'px-2 py-0.5 rounded-full text-xs bg-white/20 text-white' : 'px-2 py-0.5 rounded-full text-xs bg-stone-100 text-stone-600'}>
              {bookstores.filter((b) => b.verification_status === 'PENDING').length} {t("en attente")}{' '}</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={activeTab === 'users' ? 'flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap bg-[#0e3444] text-white shadow-sm' : 'flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap text-stone-600 hover:bg-stone-100'}
          >
            <Users className="w-4 h-4" />
            <span>{t("Comptes & Modération")}</span>
            <span className={activeTab === 'users' ? 'px-2 py-0.5 rounded-full text-xs bg-white/20 text-white' : 'px-2 py-0.5 rounded-full text-xs bg-stone-100 text-stone-600'}>
              {usersList.length}
            </span>
          </button>
        </div>

        {/* TAB 1: ANALYTICS DETAIL */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e2d6c1] p-6 shadow-xs">
              <h3 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0e3444]" />
                {t("Répartition des Acteurs de la Plateforme")}{' '}</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-stone-700">{t("Lecteurs / Acheteurs")}</span>
                    <span className="text-[#0e3444]">{analytics?.buyers_count || 0} {t("utilisateurs")}</span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0e3444] rounded-full"
                      style={{ width: `${Math.min(100, Math.round(((analytics?.buyers_count || 1) / (analytics?.total_users || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-stone-700">{t("Librairies Partenaires Professionnelles")}</span>
                    <span className="text-blue-700">{analytics?.bookstores_count || 0} {t("magasins")}</span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${Math.min(100, Math.round(((analytics?.bookstores_count || 1) / (analytics?.total_users || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-stone-700">{t("Vendeurs Particuliers (Livres d'occasion)")}</span>
                    <span className="text-[#b4512f]">{analytics?.individual_sellers_count || 0} {t("vendeurs")}</span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#b4512f] rounded-full"
                      style={{ width: `${Math.min(100, Math.round(((analytics?.individual_sellers_count || 1) / (analytics?.total_users || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-stone-100 grid grid-cols-2 gap-4 text-center">
                <div className="p-4 rounded-xl bg-stone-50">
                  <p className="text-xs text-stone-400 font-bold uppercase">{t("Offres de livres en ligne")}</p>
                  <p className="text-2xl font-black text-stone-900 mt-1">{analytics?.total_active_offers || 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-stone-50">
                  <p className="text-xs text-stone-400 font-bold uppercase">{t("Panier Moyen Estimé")}</p>
                  <p className="text-2xl font-black text-[#0e3444] mt-1">
                    {analytics?.total_orders && analytics?.total_gmv_dzd
                      ? Math.round(analytics.total_gmv_dzd / analytics.total_orders).toLocaleString()
                      : '1 850'} {t("DA")}{' '}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e2d6c1] p-6 shadow-xs">
              <h3 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                {t("Normes & Conformité Algérie")}{' '}</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {t("Toutes les librairies partenaires affichant le badge")}{' '}<strong>{t("Vérifiée")}</strong> {t("doivent fournir leur numéro de Registre du Commerce (RC) et leur Numéro d'Identification Fiscale (NIF).")}{' '}</p>

              <div className="mt-6 space-y-3">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t("Prix plafonnés en DZD conformes aux mentions éditeurs")}</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{t("Bordereaux de livraison traçables Yalidine & ZR Express")}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{t("Modération proactive des annonces d'occasion")}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BOOKSTORES VERIFICATION QUEUE */}
        {activeTab === 'bookstores' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#e2d6c1] shadow-xs">
              <div>
                <h3 className="font-bold text-stone-800 text-base">{t("File de Modération des Librairies")}</h3>
                <p className="text-xs text-stone-400">{t("Examen des fiches établissements et validation de conformité")}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBookstoreFilter('ALL')}
                  className={bookstoreFilter === 'ALL' ? 'px-3 py-1.5 text-xs font-bold rounded-xl transition-colors bg-[#0e3444] text-white' : 'px-3 py-1.5 text-xs font-bold rounded-xl transition-colors bg-stone-100 text-stone-600'}
                >
                  {t("Toutes")} ({bookstores.length})
                </button>
                <button
                  onClick={() => setBookstoreFilter('PENDING')}
                  className={bookstoreFilter === 'PENDING' ? 'px-3 py-1.5 text-xs font-bold rounded-xl transition-colors bg-amber-600 text-white' : 'px-3 py-1.5 text-xs font-bold rounded-xl transition-colors bg-stone-100 text-stone-600'}
                >
                  {t("En attente")}{' '}</button>
                <button
                  onClick={() => setBookstoreFilter('VERIFIED')}
                  className={bookstoreFilter === 'VERIFIED' ? 'px-3 py-1.5 text-xs font-bold rounded-xl transition-colors bg-emerald-600 text-white' : 'px-3 py-1.5 text-xs font-bold rounded-xl transition-colors bg-stone-100 text-stone-600'}
                >
                  {t("Certifiées")}{' '}</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e2d6c1] shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-[#e2d6c1] text-stone-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="p-4">{t("Librairie")}</th>
                    <th className="p-4">{t("Wilaya & Adresse")}</th>
                    <th className="p-4">{t("Téléphone")}</th>
                    <th className="p-4">{t("Statut Actuel")}</th>
                    <th className="p-4 text-right">{t("Décision Modération")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredBookstores.map((s) => (
                    <tr key={s.id} className="hover:bg-stone-50/50">
                      <td className="p-4 font-bold text-stone-900">
                        <Link href={`/libraries/${s.slug}`} className="hover:underline text-[#0e3444]">
                          {s.store_name}
                        </Link>
                      </td>
                      <td className="p-4 text-stone-600">
                        <span className="font-bold text-stone-800">{s.wilaya_code} - {s.wilaya_name_fr}</span>
                        <p className="text-[11px] text-stone-400 truncate max-w-xs">{s.address}</p>
                      </td>
                      <td className="p-4 font-mono text-stone-700">{s.phone}</td>
                      <td className="p-4">
                        {s.is_verified ? (
                          <span className="px-2.5 py-1 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {t("Certifiée")}{' '}</span>
                        ) : s.verification_status === 'REJECTED' ? (
                          <span className="px-2.5 py-1 rounded-full font-bold text-[11px] bg-rose-100 text-rose-800 flex items-center gap-1 w-fit">
                            <XCircle className="w-3.5 h-3.5" />
                            {t("Refusée")}{' '}</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full font-bold text-[11px] bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            {t("À Vérifier")}{' '}</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!s.is_verified && (
                            <button
                              onClick={() => handleVerify(s.id)}
                              disabled={processingAction}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              {t("Valider")}{' '}</button>
                          )}
                          <button
                            onClick={() => handleOpenRejectModal(s)}
                            disabled={processingAction}
                            className="px-3 py-1.5 bg-stone-100 hover:bg-rose-50 text-rose-700 font-bold rounded-lg transition-colors flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {t("Rejeter")}{' '}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: USER ACCOUNTS & SUSPENSION */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#e2d6c1] shadow-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder={t("Rechercher par nom, email ou prénom...")}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-[#e2d6c1] rounded-xl text-xs focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                />
              </div>

              <div className="text-xs text-stone-500">
                {t("Total :")}{' '}<strong>{filteredUsers.length}</strong> {t("comptes")}{' '}</div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e2d6c1] shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-[#e2d6c1] text-stone-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="p-4">{t("Utilisateur")}</th>
                    <th className="p-4">{t("Rôle Plateforme")}</th>
                    <th className="p-4">{t("Wilaya")}</th>
                    <th className="p-4">{t("Statut")}</th>
                    <th className="p-4 text-right">{t("Action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-stone-50/50">
                      <td className="p-4">
                        <p className="font-bold text-stone-900">{u.first_name} {u.last_name}</p>
                        <p className="text-[11px] text-stone-400">{u.email}</p>
                      </td>
                      <td className="p-4">
                        <span className={
                          u.role === 'BUYER' ? 'px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800' :
                          u.role === 'BOOKSTORE_SELLER' ? 'px-2 py-0.5 rounded-full font-bold text-[10px] bg-blue-100 text-blue-800' :
                          u.role === 'INDIVIDUAL_SELLER' ? 'px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-100 text-amber-800' :
                          'px-2 py-0.5 rounded-full font-bold text-[10px] bg-purple-100 text-purple-800'
                        }>
                          {u.role_display || u.role}
                        </span>
                      </td>
                      <td className="p-4 text-stone-600">{u.wilaya_name_fr || 'Alger'}</td>
                      <td className="p-4">
                        {u.is_suspended ? (
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-rose-100 text-rose-800">
                            {t("Suspendu")}{' '}</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                            {t("Actif")}{' '}</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleSuspend(u.id)}
                          className={
                            u.is_suspended
                              ? 'px-3 py-1.5 font-bold rounded-lg text-xs transition-colors bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'px-3 py-1.5 font-bold rounded-lg text-xs transition-colors bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          }
                        >
                          {u.is_suspended ? 'Réactiver' : 'Suspendre'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectModalOpen && selectedStore && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#e2d6c1] relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-stone-900 mb-1">
              {t("Refuser l'agrément")}{' '}</h3>
            <p className="text-xs text-stone-500 mb-4">
              {t("Librairie :")}{' '}{selectedStore.store_name}
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  {t("Motif du refus notifié à la librairie")}{' '}</label>
                <textarea
                  rows={4}
                  required
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-[#e2d6c1] rounded-xl text-sm focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  {t("Annuler")}{' '}</button>
                <button
                  type="submit"
                  disabled={processingAction}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50"
                >
                  {processingAction ? 'En cours...' : 'Confirmer le refus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}