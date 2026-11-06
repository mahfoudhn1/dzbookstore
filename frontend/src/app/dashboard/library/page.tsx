'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
  MapPin,
  Package,
  Pencil,
  Phone,
  PlusCircle,
  RefreshCw,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { LibraryCreateForm } from '@/components/library/LibraryCreateForm';
import { BookCover } from '@/components/books/BookCover';
import {
  ArchFrame,
  SectionHeading,
  ZelligeBand,
  ZelligeDivider,
  ZelligeField,
  ZelligeStar,
} from '@/components/ui/Ornaments';
import {
  fetchCategories,
  fetchLibraryBooks,
  fetchLibraryOrders,
  fetchMyLibrary,
  fetchWilayas,
  updateBook,
  updateLibraryOrder,
} from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import {
  bootstrapSession,
  selectUser,
} from '@/lib/store/authSlice';
import type {
  Bookstore,
  Category,
  LibraryOrder,
  LibraryOrderStatus,
  Offer,
  Wilaya,
} from '@/lib/types';
import { formatPrice, getLocalizedCategory, getLocalizedWilaya, initials } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/I18nProvider';

type StockFilter = 'ALL' | 'IN' | 'OUT';
type ActiveTab = 'catalog' | 'orders';

interface CatalogFilters {
  search: string;
  categories: string[];
  language: string;
  minPrice: string;
  maxPrice: string;
  stock: StockFilter;
  ordering: string;
}

interface EditBookForm {
  title: string;
  description: string;
  price: string;
  categories: string[];
  language: string;
  stock_quantity: string;
  is_in_stock: boolean;
  regions: number[];
}

const DEFAULT_FILTERS: CatalogFilters = {
  search: '',
  categories: [],
  language: '',
  minPrice: '',
  maxPrice: '',
  stock: 'ALL',
  ordering: '-created_at',
};

const EMPTY_EDIT_FORM: EditBookForm = {
  title: '',
  description: '',
  price: '',
  categories: [],
  language: 'FRENCH',
  stock_quantity: '1',
  is_in_stock: true,
  regions: [],
};

const LANGUAGE_OPTIONS = [
  { value: 'ARABIC', label: 'Arabe' },
  { value: 'FRENCH', label: 'Français' },
  { value: 'ENGLISH', label: 'Anglais' },
  { value: 'TAMAZIGHT', label: 'Tamazight' },
  { value: 'OTHER', label: 'Autre' },
];

const ORDER_STATUS_LABELS: Record<LibraryOrderStatus, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

function orderStatusTone(status: LibraryOrderStatus) {
  if (status === 'DELIVERED') return 'border-emerald-dz/25 bg-emerald-dz/5 text-emerald-deep';
  if (status === 'SHIPPED') return 'border-sea/20 bg-sea/5 text-sea';
  if (status === 'CANCELLED') return 'border-clay/25 bg-clay/5 text-clay-deep';
  if (status === 'CONFIRMED') return 'border-brass/35 bg-brass/5 text-ink-soft';
  return 'border-line bg-ivory text-muted';
}

export default function MyLibraryPage() {
  const { t, locale } = useI18n();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);

  const [library, setLibrary] = useState<Bookstore | null | undefined>(undefined);
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<LibraryOrder[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [ordersError, setOrdersError] = useState('');
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);

  const [editOffer, setEditOffer] = useState<Offer | null>(null);
  const [editForm, setEditForm] = useState<EditBookForm>(EMPTY_EDIT_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [orderActionId, setOrderActionId] = useState<number | null>(null);
  const [orderActionError, setOrderActionError] = useState('');
  const [highlightOrderId, setHighlightOrderId] = useState<number | null>(null);

  const openEditModal = useCallback((offer: Offer) => {
    setEditOffer(offer);
    setEditError('');
    setEditForm({
      title: offer.title || offer.work_title || '',
      description: offer.description || '',
      price: String(offer.price ?? ''),
      categories:
        offer.categories?.length
          ? offer.categories.map((category) => String(category.id))
          : offer.category
            ? [String(offer.category)]
            : [],
      language: offer.language || 'FRENCH',
      stock_quantity: String(offer.stock_quantity ?? 1),
      is_in_stock: Boolean(offer.is_in_stock),
      regions: Array.isArray(offer.regions) ? offer.regions : [],
    });
  }, []);

  const loadCatalog = useCallback(
    async (libraryId: number, nextFilters: CatalogFilters) => {
      setCatalogLoading(true);
      setCatalogError('');
      try {
        const data = await fetchLibraryBooks(libraryId, {
          search: nextFilters.search.trim() || undefined,
          category: nextFilters.categories.join(',') || undefined,
          language: nextFilters.language || undefined,
          min_price: nextFilters.minPrice ? Number(nextFilters.minPrice) : undefined,
          max_price: nextFilters.maxPrice ? Number(nextFilters.maxPrice) : undefined,
          is_in_stock:
            nextFilters.stock === 'IN'
              ? true
              : nextFilters.stock === 'OUT'
                ? false
                : undefined,
          ordering: nextFilters.ordering || undefined,
          include_unavailable: true,
        });
        setOffers(data);
        const requestedId = Number(
          new URLSearchParams(window.location.search).get('edit'),
        );
        if (requestedId) {
          const target = data.find((offer) => offer.id === requestedId);
          if (target) {
            openEditModal(target);
            window.history.replaceState({}, '', '/dashboard/library');
          }
        }
      } catch {
        setCatalogError(t('Impossible de charger le catalogue de la librairie.'));
      } finally {
        setCatalogLoading(false);
      }
    },
    [openEditModal, t],
  );

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const data = await fetchLibraryOrders();
      setOrders(data);
    } catch {
      setOrdersError(t('Impossible de charger les commandes entrantes.'));
    } finally {
      setOrdersLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [store, wilayaList, categoryList] = await Promise.all([
        fetchMyLibrary(),
        fetchWilayas(),
        fetchCategories(),
      ]);
      if (cancelled) return;
      setWilayas(wilayaList);
      setCategories(categoryList);
      setLibrary(store);
      setLoading(false);
      if (store) {
        await Promise.all([
          loadCatalog(store.id, DEFAULT_FILTERS),
          loadOrders(),
        ]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [loadCatalog, loadOrders, user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedOrder = Number(params.get('order') ?? '');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deep-link from a notification
    if (params.get('tab') === 'orders' || requestedOrder > 0) setActiveTab('orders');
    if (Number.isFinite(requestedOrder) && requestedOrder > 0) setHighlightOrderId(requestedOrder);
  }, []);

  useEffect(() => {
    if (!highlightOrderId || orders.length === 0) return;
    const node = document.getElementById(`order-${highlightOrderId}`);
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightOrderId, orders.length]);

  const inStockCount = useMemo(
    () => offers.filter((offer) => offer.is_in_stock).length,
    [offers],
  );
  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status === 'PENDING').length,
    [orders],
  );
  const activeFilterCount = [
    filters.search.trim(),
    ...filters.categories,
    filters.language,
    filters.stock !== 'ALL' ? filters.stock : '',
    filters.minPrice,
    filters.maxPrice,
  ].filter(Boolean).length;

  const wilayaName = (id: number) => {
    const w = wilayas.find((wilaya) => wilaya.id === id);
    return w ? getLocalizedWilaya(w, locale) : String(id);
  };

  const handleCreated = async (store: Bookstore) => {
    setLibrary(store);
    try {
      await dispatch(bootstrapSession()).unwrap();
    } catch {
      setLibrary(store);
    }
    await Promise.all([loadCatalog(store.id, DEFAULT_FILTERS), loadOrders()]);
  };

  const handleFilterSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (library) loadCatalog(library.id, filters);
  };

  const applyFilters = (next: Partial<CatalogFilters>) => {
    const merged = { ...filters, ...next };
    setFilters(merged);
    if (library) loadCatalog(library.id, merged);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    if (library) loadCatalog(library.id, DEFAULT_FILTERS);
  };

  const toggleEditRegion = (wilayaId: number) => {
    setEditForm((current) => ({
      ...current,
      regions: current.regions.includes(wilayaId)
        ? current.regions.filter((id) => id !== wilayaId)
        : [...current.regions, wilayaId],
    }));
  };

  const toggleCategoryFilter = (slug: string) => {
    const categories = filters.categories.includes(slug)
      ? filters.categories.filter((item) => item !== slug)
      : [...filters.categories, slug];
    applyFilters({ categories });
  };

  const toggleEditCategory = (categoryId: string) => {
    setEditForm((current) => ({
      ...current,
      categories: current.categories.includes(categoryId)
        ? current.categories.filter((id) => id !== categoryId)
        : [...current.categories, categoryId],
    }));
  };

  const handleSaveBook = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editOffer || editSaving) return;
    const price = parseFloat(editForm.price);
    if (Number.isNaN(price) || price <= 0) {
      setEditError(t('Veuillez indiquer un prix valide.'));
      return;
    }

    setEditSaving(true);
    setEditError('');
    try {
      const stock = Math.max(0, parseInt(editForm.stock_quantity, 10) || 0);
      await updateBook(editOffer.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        price,
        category: editForm.categories.length ? Number(editForm.categories[0]) : null,
        categories: editForm.categories.map(Number),
        language: editForm.language,
        stock_quantity: editForm.is_in_stock ? Math.max(1, stock) : 0,
        is_in_stock: editForm.is_in_stock,
        regions: editForm.regions,
      });
      setEditOffer(null);
      if (library) await loadCatalog(library.id, filters);
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : t('Mise à jour impossible.'),
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleOrderStatus = async (order: LibraryOrder, status: LibraryOrderStatus) => {
    if (orderActionId !== null) return;
    setOrderActionId(order.id);
    setOrderActionError('');
    try {
      await updateLibraryOrder(order.id, { status });
      await loadOrders();
    } catch (error) {
      setOrderActionError(
        error instanceof Error ? error.message : t('Mise à jour impossible.'),
      );
    } finally {
      setOrderActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-ivory text-muted">
        <Loader2 className="h-5 w-5 animate-spin text-sea" />
        <span className="text-[11px] uppercase tracking-[0.14em]">
          {t('Chargement de votre librairie…')}
        </span>
      </div>
    );
  }

  if (!library) {
    return (
      <div className="min-h-screen bg-ivory pb-24">
        <section className="relative overflow-hidden border-b border-line bg-parchment">
          <ZelligeField className="text-sea" opacity={0.035} />
          <div className="relative mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-muted">
              <Link href="/" className="transition-colors hover:text-sea">
                {t('Accueil')}
              </Link>
              <span>/</span>
              <span className="text-ink">{t('Ma librairie')}</span>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-label text-clay">
              <ZelligeStar className="h-3 w-3" />
              {t('Espace librairie')}
            </div>
            <h1 className="mt-3 max-w-3xl text-[2.6rem] leading-[0.98] tracking-[-0.04em] text-ink sm:text-[3.4rem]">
              {t('Ouvrez votre')}{' '}
              <span className="italic text-clay">{t('maison de livres.')}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-[12.5px] leading-relaxed text-muted">
              {t('Créez votre profil librairie pour publier un catalogue, suivre votre stock et recevoir des commandes.')}
            </p>
          </div>
        </section>
        <div className="mx-auto max-w-4xl mt-8 px-4 py-10 sm:px-6 lg:px-8">
          <LibraryCreateForm wilayas={wilayas} onCreated={handleCreated} />
        </div>
      </div>
    );
  }

  const filtersContent = (
    <div className="space-y-8">
      <FilterGroup title={t('Catégories')}>
        <div className="max-h-64 overflow-y-auto pr-1">
          <FilterButton
            active={filters.categories.length === 0}
            onClick={() => applyFilters({ categories: [] })}
          >
            {t('Toutes les catégories')}
          </FilterButton>
          {categories.map((category) => (
            <FilterButton
              key={category.id}
              active={filters.categories.includes(category.slug)}
              onClick={() => toggleCategoryFilter(category.slug)}
            >
              {getLocalizedCategory(category, locale)}
            </FilterButton>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={t('Langue')}>
        <FilterButton
          active={!filters.language}
          onClick={() => applyFilters({ language: '' })}
        >
          {t('Toutes les langues')}
        </FilterButton>
        {LANGUAGE_OPTIONS.map((language) => (
          <FilterButton
            key={language.value}
            active={filters.language === language.value}
            onClick={() => applyFilters({ language: language.value })}
          >
            {language.label}
          </FilterButton>
        ))}
      </FilterGroup>

      <FilterGroup title={t('Disponibilité')}>
        <FilterButton
          active={filters.stock === 'ALL'}
          onClick={() => applyFilters({ stock: 'ALL' })}
        >
          {t('Tous les stocks')}
        </FilterButton>
        <FilterButton
          active={filters.stock === 'IN'}
          onClick={() => applyFilters({ stock: 'IN' })}
        >
          {t('En stock')}
        </FilterButton>
        <FilterButton
          active={filters.stock === 'OUT'}
          onClick={() => applyFilters({ stock: 'OUT' })}
        >
          {t('Rupture de stock')}
        </FilterButton>
      </FilterGroup>

      <FilterGroup title={t('Prix (DA)')}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters({
              minPrice: filters.minPrice,
              maxPrice: filters.maxPrice,
            });
          }}
          className="space-y-2 pt-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              value={filters.minPrice}
              onChange={(event) =>
                setFilters((current) => ({ ...current, minPrice: event.target.value }))
              }
              placeholder={t('Min.')}
              className="w-full rounded-xs border border-line bg-parchment px-2.5 py-2 text-[11px] text-ink focus:border-sea/50 focus:outline-none"
            />
            <input
              type="number"
              min="0"
              value={filters.maxPrice}
              onChange={(event) =>
                setFilters((current) => ({ ...current, maxPrice: event.target.value }))
              }
              placeholder={t('Max.')}
              className="w-full rounded-xs border border-line bg-parchment px-2.5 py-2 text-[11px] text-ink focus:border-sea/50 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-sea px-3 py-2 text-[8.5px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-sea-deep"
          >
            {t('Appliquer le prix')}
          </button>
        </form>
      </FilterGroup>
    </div>
  );

  return (
    <div className="min-h-screen bg-ivory pb-24">
      <section className="relative overflow-hidden bg-sea text-ivory">
        <ZelligeField className="text-ivory" opacity={0.06} />
        <div className="relative mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-ivory/50">
            <Link href="/" className="transition-colors hover:text-brass-light">
              {t('Accueil')}
            </Link>
            <span>/</span>
            <span className="text-ivory/80">{t('Ma librairie')}</span>
          </div>

          <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
              <ArchFrame
                id="my-library-arch"
                className="h-[112px] w-[92px] shrink-0"
                padding="p-[3px]"
              >
                {library.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={library.logo_url}
                    alt={`Logo de ${library.store_name}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-sea-soft">
                    <ZelligeField className="text-brass" opacity={0.2} size="sm" />
                    <span className="relative font-display text-2xl text-ivory">
                      {initials(library.store_name)}
                    </span>
                  </div>
                )}
              </ArchFrame>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 border border-brass-light/35 bg-ivory/[0.06] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-brass-light">
                    <ZelligeStar className="h-2.5 w-2.5" />
                    {library.verification_status === 'VERIFIED'
                      ? t('Librairie vérifiée')
                      : t('En attente de vérification')}
                  </span>
                  <span className="border border-ivory/15 px-2.5 py-1 text-[8px] uppercase tracking-[0.1em] text-ivory/60">
                    {getLocalizedWilaya({ wilaya_name_fr: library.wilaya_name_fr, seller_wilaya_name_ar: library.wilaya_name_ar, seller_wilaya_name_en: library.wilaya_name_en }, locale)}
                  </span>
                </div>
                <h1 className="mt-4 font-display text-[2.5rem] leading-[0.98] tracking-[-0.04em] sm:text-[3.3rem]">
                  {library.store_name}
                </h1>
                <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-ivory/60">
                  {library.description || t('Gérez votre vitrine, votre stock et vos commandes.')}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-ivory/55">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-brass-light" />
                    {library.address}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-brass-light" />
                    {library.phone}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-brass-light" />
                    {library.opening_hours || 'Samedi – Jeudi'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/sell"
                className="inline-flex items-center gap-2 bg-clay px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-clay-deep"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                {t('Ajouter un livre')}
              </Link>
              <Link
                href="/dashboard/library-setup"
                className="inline-flex items-center gap-2 border border-ivory/25 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:border-brass-light hover:text-brass-light"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t('Modifier la fiche')}
              </Link>
              <Link
                href={`/libraries/${library.slug}`}
                className="inline-flex items-center gap-2 border border-ivory/25 px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:border-brass-light hover:text-brass-light"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('Voir la vitrine')}
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (library) {
                    loadCatalog(library.id, filters);
                    loadOrders();
                  }
                }}
                className="border border-ivory/25 p-2.5 text-ivory transition-colors hover:border-brass-light hover:text-brass-light"
                title={t('Rafraîchir')}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    catalogLoading || ordersLoading ? 'animate-spin' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="mt-6 grid grid-cols-2 border border-line bg-parchment shadow-card lg:grid-cols-4">
          {[
            { label: t('Livres'), value: offers.length },
            { label: t('En stock'), value: inStockCount },
            { label: t('Rupture'), value: Math.max(0, offers.length - inStockCount) },
            { label: t('Commandes en attente'), value: pendingOrders },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className={`px-5 py-4 ${index < 3 ? 'border-r border-line' : ''}`}
            >
              <p className="text-[8px] font-semibold uppercase tracking-label text-muted">
                {stat.label}
              </p>
              <p className="mt-1.5 font-display text-[1.6rem] leading-none text-ink">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-6 border-b border-line">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`relative pb-3 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              activeTab === 'catalog' ? 'text-sea' : 'text-muted hover:text-ink'
            }`}
          >
            {t('Catalogue & Stock')}
            <span
              className={`absolute bottom-0 left-0 h-px w-full bg-clay transition-transform ${
                activeTab === 'catalog' ? 'scale-x-100' : 'scale-x-0'
              }`}
            />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`relative pb-3 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              activeTab === 'orders' ? 'text-sea' : 'text-muted hover:text-ink'
            }`}
          >
            {t('Commandes entrantes')}
            {pendingOrders > 0 ? (
              <span className="ml-2 border border-clay/25 bg-clay/5 px-1.5 py-0.5 text-[8px] text-clay">
                {pendingOrders}
              </span>
            ) : null}
            <span
              className={`absolute bottom-0 left-0 h-px w-full bg-clay transition-transform ${
                activeTab === 'orders' ? 'scale-x-100' : 'scale-x-0'
              }`}
            />
          </button>
        </div>

        {activeTab === 'catalog' ? (
          <section className="py-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                eyebrow={t('Le fonds')}
                title={t('Votre catalogue en rayon.')}
                arabic="الرفوف"
                description={t("Filtrez, mettez à jour le stock et ajustez les prix de vos livres.")}
              />
              <Link
                href="/sell"
                className="inline-flex items-center gap-2 bg-sea px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-sea-deep"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                {t('Ajouter un livre à la librairie')}
              </Link>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[236px_1fr] lg:gap-12">
              <aside className="hidden lg:block">
                <div className="sticky top-28 space-y-8 border-t border-line pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[9px] font-semibold uppercase tracking-label text-muted">
                      {t('Filtres')}
                      {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </p>
                    {activeFilterCount > 0 ? (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="text-[9px] uppercase tracking-[0.1em] text-clay hover:underline"
                      >
                        {t('Tout effacer')}
                      </button>
                    ) : null}
                  </div>
                  {filtersContent}
                </div>
              </aside>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
                  <form
                    onSubmit={handleFilterSubmit}
                    className="relative min-w-[220px] flex-1 sm:max-w-sm"
                  >
                    <Search className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-muted" />
                    <input
                      type="search"
                      value={filters.search}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, search: event.target.value }))
                      }
                      placeholder={t('Rechercher un titre ou un auteur…')}
                      className="h-9 w-full border border-line bg-parchment py-2 pl-9 pr-3 text-[11px] text-ink focus:border-sea/50 focus:outline-none"
                    />
                  </form>
                  <div className="flex items-center gap-3">
                    <span className="hidden text-[9px] uppercase tracking-[0.1em] text-muted sm:inline">
                      {t('Trier')}
                    </span>
                    <select
                      value={filters.ordering}
                      onChange={(event) => applyFilters({ ordering: event.target.value })}
                      className="h-9 cursor-pointer border border-line bg-parchment px-2.5 text-[10.5px] font-medium text-ink-soft focus:border-sea/50 focus:outline-none"
                    >
                      <option value="-created_at">{t('Plus récents')}</option>
                      <option value="created_at">{t('Plus anciens')}</option>
                      <option value="price">{t('Prix croissant')}</option>
                      <option value="-price">{t('Prix décroissant')}</option>
                    </select>
                  </div>
                </div>

                <details className="mt-4 border border-line bg-parchment lg:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink marker:content-none">
                    <span className="flex items-center gap-2">
                      <Filter className="h-3.5 w-3.5 text-clay" />
                      {t('Filtres')}
                      {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </span>
                    <span className="text-[8px] text-muted">{t('Ouvrir')}</span>
                  </summary>
                  <div className="border-t border-line px-4 py-4">{filtersContent}</div>
                </details>

                {catalogError ? (
                  <div className="mt-5 border border-clay/25 bg-clay/5 px-4 py-3 text-[12px] text-clay-deep">
                    {catalogError}
                  </div>
                ) : null}

                <div className="mt-6">
              {catalogLoading && offers.length === 0 ? (
                <div className="flex items-center justify-center border border-line bg-parchment py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-sea" />
                </div>
              ) : offers.length === 0 ? (
                <div className="border border-dashed border-line bg-parchment px-6 py-16 text-center">
                  <BookOpen className="mx-auto h-9 w-9 text-brass/60" strokeWidth={1.2} />
                  <h3 className="mt-5 font-display text-[1.8rem] leading-none text-ink">
                    {t('Aucun livre dans ce catalogue.')}
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-[12px] leading-relaxed text-muted">
                    {t('Ajoutez votre premier livre ou modifiez vos filtres pour retrouver votre stock.')}
                  </p>
                  <Link
                    href="/sell"
                    className="mt-5 inline-flex items-center gap-2 bg-clay px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-clay-deep"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    {t('Ajouter un livre à la librairie')}
                  </Link>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {offers.map((offer) => (
                    <article
                      key={offer.id}
                      className="group flex gap-4 border border-line bg-parchment p-4 transition-colors hover:border-sea/30"
                    >
                      <Link
                        href={`/books/${offer.work_slug}`}
                        className="relative block h-32 w-[88px] shrink-0 overflow-hidden border border-line bg-ivory-deep/40 p-2"
                      >
                        <BookCover
                          src={offer.work_cover || offer.photos?.[0]}
                          title={offer.work_title}
                          author={offer.seller_name}
                          className="mx-auto w-[82%] transition-transform duration-500 group-hover:-translate-y-1"
                        />
                      </Link>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/books/${offer.work_slug}`}
                            className="line-clamp-2 font-display text-[1.15rem] leading-[1.08] text-ink transition-colors group-hover:text-sea"
                          >
                            {offer.title || offer.work_title}
                          </Link>
                          <button
                            type="button"
                            onClick={() => openEditModal(offer)}
                            className="shrink-0 border border-line p-1.5 text-muted transition-colors hover:border-sea/40 hover:text-sea"
                            title={t('Modifier le livre')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-label text-clay">
                          {offer.categories?.length
                            ? offer.categories.map((category) => getLocalizedCategory(category, locale)).join(' · ')
                            : offer.category_name || t('Sans catégorie')}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="border border-line bg-ivory px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted">
                            {LANGUAGE_OPTIONS.find(
                              (item) => item.value === offer.language,
                            )?.label || offer.language_display || '—'}
                          </span>
                          <span
                            className={`border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] ${
                              offer.is_in_stock
                                ? 'border-emerald-dz/25 bg-emerald-dz/5 text-emerald-deep'
                                : 'border-clay/25 bg-clay/5 text-clay-deep'
                            }`}
                          >
                            {offer.is_in_stock ? t('En stock') : t('Rupture')}
                          </span>
                          <span className="text-[9px] text-muted">
                            {offer.stock_quantity} {t('ex.')}
                          </span>
                        </div>

                        <p className="mt-2 line-clamp-1 text-[9.5px] text-muted">
                          {offer.regions?.length
                            ? `${t('Livraison')}: ${offer.regions
                                .slice(0, 2)
                                .map(wilayaName)
                                .join(', ')}${
                                offer.regions.length > 2
                                  ? ` +${offer.regions.length - 2}`
                                  : ''
                              }`
                            : t('Toutes les wilayas')}
                        </p>

                        <div className="mt-auto flex items-end justify-between gap-2 border-t border-line/70 pt-3">
                          <p className="font-sans text-sm font-bold tracking-tight text-sea">
                            {formatPrice(offer.price)}
                          </p>
                          <Link
                            href={`/books/${offer.work_slug}`}
                            className="inline-flex items-center gap-1 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-clay transition-colors hover:text-clay-deep"
                          >
                            {t('Voir')}
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="py-8">
            <SectionHeading
              eyebrow={t('Les commandes')}
              title={t('Commandes entrantes.')}
              arabic="الطلبات"
              description={t('Confirmez, expédiez et suivez les commandes destinées à votre librairie.')}
            />

            {orderActionError ? (
              <div className="mt-5 border border-clay/25 bg-clay/5 px-4 py-3 text-[12px] text-clay-deep">
                {orderActionError}
              </div>
            ) : null}
            {ordersError ? (
              <div className="mt-5 border border-clay/25 bg-clay/5 px-4 py-3 text-[12px] text-clay-deep">
                {ordersError}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              {ordersLoading && orders.length === 0 ? (
                <div className="flex items-center justify-center border border-line bg-parchment py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-sea" />
                </div>
              ) : orders.length === 0 ? (
                <div className="border border-dashed border-line bg-parchment px-6 py-16 text-center">
                  <Package className="mx-auto h-9 w-9 text-brass/60" strokeWidth={1.2} />
                  <h3 className="mt-5 font-display text-[1.8rem] leading-none text-ink">
                    {t('Aucune commande entrante.')}
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-[12px] leading-relaxed text-muted">
                    {t('Les commandes destinées à votre librairie apparaîtront ici dès qu’un lecteur valide son panier.')}
                  </p>
                </div>
              ) : (
                orders.map((order) => (
                  <article
                    key={order.suborder_id}
                    id={`order-${order.suborder_id}`}
                    className={`border bg-parchment ${
                      highlightOrderId === order.suborder_id
                        ? 'border-clay/60 ring-2 ring-clay/20'
                        : 'border-line'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-ivory px-5 py-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[13px] font-bold text-ink">
                            {order.order_number}
                          </span>
                          <span
                            className={`border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] ${orderStatusTone(
                              order.status,
                            )}`}
                          >
                            {ORDER_STATUS_LABELS[order.status]}
                          </span>
                        </div>
                        <p className="mt-1 text-[10.5px] text-muted">
                          {order.buyer_name} · {order.wilaya_name} · {order.buyer_phone}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] uppercase tracking-label text-muted">
                          {t('Total')}
                        </p>
                        <p className="font-sans text-[15px] font-bold text-sea">
                          {formatPrice(order.total_amount)}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1.4fr_1fr_auto]">
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 border-b border-line/60 pb-2 text-[11px] last:border-0 last:pb-0"
                          >
                            <Link
                              href={`/books/${item.work_slug}`}
                              className="font-semibold text-ink transition-colors hover:text-sea"
                            >
                              {item.title}
                            </Link>
                            <span className="shrink-0 font-mono text-[10px] text-muted">
                              {item.quantity} × {formatPrice(item.unit_price)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1.5 text-[10px] text-muted">
                        <p className="flex items-start gap-1.5">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-brass" />
                          {order.address}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Truck className="h-3 w-3 shrink-0 text-brass" />
                          {order.delivery_type_display}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0 text-brass" />
                          {new Date(order.created_at).toLocaleDateString('fr-DZ')}
                        </p>
                        {order.tracking_number ? (
                          <p className="font-mono text-[9.5px]">
                            {t('Suivi')}: {order.tracking_number}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-start gap-2 lg:flex-col">
                        {order.allowed_statuses.map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={orderActionId === order.id}
                            onClick={() => handleOrderStatus(order, status)}
                            className={`inline-flex min-w-[126px] items-center justify-center gap-1.5 border px-3 py-2 text-[8px] font-bold uppercase tracking-[0.1em] transition-colors disabled:opacity-50 ${
                              status === 'CANCELLED'
                                ? 'border-clay/25 bg-clay/5 text-clay-deep hover:bg-clay/10'
                                : status === 'DELIVERED'
                                  ? 'border-emerald-dz/25 bg-emerald-dz/5 text-emerald-deep hover:bg-emerald-dz/10'
                                  : 'border-sea/20 bg-sea/5 text-sea hover:bg-sea/10'
                            }`}
                          >
                            {orderActionId === order.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : status === 'DELIVERED' ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <Package className="h-3 w-3" />
                            )}
                            {ORDER_STATUS_LABELS[status]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        <ZelligeDivider className="my-10" tone="brass" />
      </div>

      {editOffer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sea-deep/45 p-4 backdrop-blur-sm">
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-line bg-parchment shadow-lift">
            <ZelligeBand className="text-brass/60" />
            <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
              <div>
                <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-label text-clay">
                  <ZelligeStar className="h-2.5 w-2.5" />
                  {t('Catalogue de la librairie')}
                </div>
                <h3 className="mt-2 font-display text-[1.7rem] leading-none text-ink">
                  {t('Modifier le livre')}
                </h3>
                <p className="mt-1 text-[10.5px] text-muted">{editOffer.work_title}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditOffer(null)}
                className="border border-line p-1.5 text-muted transition-colors hover:border-clay/40 hover:text-clay"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {editError ? (
              <div className="mx-6 mt-5 border border-clay/25 bg-clay/5 px-4 py-3 text-[11.5px] text-clay-deep">
                {editError}
              </div>
            ) : null}

            <form onSubmit={handleSaveBook} className="space-y-5 px-6 py-6">
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
                  {t('Titre affiché')}
                </label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="w-full rounded-xs border border-line bg-ivory px-3 py-2.5 text-[12px] text-ink focus:border-sea/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
                  {t('Description')}
                </label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="w-full rounded-xs border border-line bg-ivory px-3 py-2.5 text-[12px] text-ink focus:border-sea/50 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
                    {t('Prix (DA)')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editForm.price}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, price: event.target.value }))
                    }
                    className="w-full rounded-xs border border-line bg-ivory px-3 py-2.5 text-[12px] font-bold text-ink focus:border-sea/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
                    {t('Langue')}
                  </label>
                  <select
                    value={editForm.language}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, language: event.target.value }))
                    }
                    className="w-full rounded-xs border border-line bg-ivory px-3 py-2.5 text-[11.5px] text-ink focus:border-sea/50 focus:outline-none"
                  >
                    {LANGUAGE_OPTIONS.map((language) => (
                      <option key={language.value} value={language.value}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
                    {t('Catégories')}
                    <span className="ml-1 font-normal normal-case tracking-normal text-muted">
                      {editForm.categories.length > 0
                        ? `(${editForm.categories.length})`
                        : t('(optionnel)')}
                    </span>
                  </label>
                  <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto border border-line bg-ivory p-2.5 sm:grid-cols-3">
                    {categories.map((category) => {
                      const active = editForm.categories.includes(String(category.id));
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => toggleEditCategory(String(category.id))}
                          className={`border px-2 py-1.5 text-left text-[9.5px] transition-colors ${
                            active
                              ? 'border-sea bg-sea text-ivory'
                              : 'border-line bg-parchment text-ink-soft hover:border-sea/40'
                          }`}
                        >
                          {getLocalizedCategory(category, locale)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
                    {t('Quantité en stock')}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      value={editForm.stock_quantity}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          stock_quantity: event.target.value,
                          is_in_stock: (parseInt(event.target.value, 10) || 0) > 0,
                        }))
                      }
                      className="w-24 rounded-xs border border-line bg-ivory px-3 py-2.5 text-[12px] font-bold text-ink focus:border-sea/50 focus:outline-none"
                    />
                    <label className="flex cursor-pointer items-center gap-2 text-[10px] font-semibold text-ink-soft">
                      <input
                        type="checkbox"
                        checked={editForm.is_in_stock}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          const current = parseInt(editForm.stock_quantity, 10) || 0;
                          setEditForm((state) => ({
                            ...state,
                            is_in_stock: checked,
                            stock_quantity:
                              checked && current < 1
                                ? '1'
                                : checked
                                  ? state.stock_quantity
                                  : '0',
                          }));
                        }}
                        className="rounded-xs text-sea"
                      />
                      {t('En stock')}
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-ink-soft">
                  {t('Régions de livraison')}
                  <span className="ml-1 font-normal normal-case tracking-normal text-muted">
                    {editForm.regions.length === 0
                      ? t('(toutes les wilayas)')
                      : `(${editForm.regions.length})`}
                  </span>
                </label>
                <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto border border-line bg-ivory p-3 sm:grid-cols-3">
                  {wilayas.map((wilaya) => {
                    const active = editForm.regions.includes(wilaya.id);
                    return (
                      <button
                        key={wilaya.id}
                        type="button"
                        onClick={() => toggleEditRegion(wilaya.id)}
                        className={`border px-2 py-1.5 text-left text-[9.5px] transition-colors ${
                          active
                            ? 'border-sea bg-sea text-ivory'
                            : 'border-line bg-parchment text-ink-soft hover:border-sea/40'
                        }`}
                      >
                        {wilaya.code} · {getLocalizedWilaya(wilaya, locale)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <ZelligeDivider tone="brass" />

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditOffer(null)}
                  className="border border-line px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted transition-colors hover:border-sea/40 hover:text-ink"
                >
                  {t('Annuler')}
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="inline-flex items-center gap-2 bg-sea px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-sea-deep disabled:opacity-50"
                >
                  {editSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5" />
                  )}
                  {editSaving ? t('Sauvegarde...') : t('Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-3 text-[8.5px] font-bold uppercase tracking-label text-sea">
        {title}
      </h2>
      <div className="space-y-0.5 border-t border-line/70 pt-1.5">{children}</div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'flex w-full items-center justify-between py-1.5 text-left text-[11px] font-semibold text-clay'
          : 'flex w-full items-center justify-between py-1.5 text-left text-[11px] text-ink-soft/80 transition-colors hover:text-sea'
      }
    >
      <span>{children}</span>
      {active ? <ZelligeStar className="h-2.5 w-2.5 shrink-0 text-clay" /> : null}
    </button>
  );
}
