'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Upload,
  CheckCircle,
  Store,
  Search,
  FileSpreadsheet,
  AlertCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  X,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { ZelligeField, ZelligeStar } from '@/components/ui/Ornaments';
import {
  isIsbnQuery,
  lookupBookByIsbn,
  searchBookMetadata,
  uploadImage,
  uploadCatalogCsv,
  createBook,
  fetchCategories,
  fetchWilayas,
  BookWritePayload,
} from '@/lib/api';
import { Category, MetadataSearchResult, Wilaya } from '@/lib/types';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useAppSelector } from '@/lib/store/hooks';
import { selectAuthInitialized, selectUser } from '@/lib/store/authSlice';
import { getLocalizedCategory, getLocalizedWilaya } from '@/lib/utils';

const LANGUAGE_OPTIONS = [
  { value: 'ARABIC', label: 'Arabe' },
  { value: 'FRENCH', label: 'Français' },
  { value: 'ENGLISH', label: 'Anglais' },
  { value: 'TAMAZIGHT', label: 'Tamazight' },
  { value: 'OTHER', label: 'Autre' },
];

function languageFromMetadata(value?: string): string {
  const text = (value || '').trim();
  if (!text) return 'FRENCH';
  const code = text.toUpperCase();
  if (LANGUAGE_OPTIONS.some((option) => option.value === code)) return code;
  const normalized = text.toLowerCase();
  // Open Library returns ISO 639-2 codes (fre/ara/eng); Google Books usually
  // returns ISO 639-1 (fr/ar/en). Accept both plus human-readable labels.
  if (
    ['ar', 'ara', 'arabic', 'arabe'].includes(normalized) ||
    normalized.includes('arab') ||
    normalized.includes('عربي') ||
    normalized.includes('العربية')
  ) {
    return 'ARABIC';
  }
  if (
    ['fr', 'fre', 'fra', 'french', 'français', 'francais'].includes(normalized) ||
    normalized.includes('fran')
  ) {
    return 'FRENCH';
  }
  if (
    ['en', 'eng', 'english', 'anglais'].includes(normalized) ||
    normalized.includes('angl')
  ) {
    return 'ENGLISH';
  }
  if (
    ['ber', 'tam', 'kab', 'tamazight', 'amazigh', 'berbère', 'berbere'].includes(
      normalized,
    ) ||
    normalized.includes('tamaz') ||
    normalized.includes('berb') ||
    normalized.includes('amazigh')
  ) {
    return 'TAMAZIGHT';
  }
  return 'OTHER';
}

function SellPageContent() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const initialized = useAppSelector(selectAuthInitialized);
  const isLibrary = Boolean(user?.bookstore_profile) || user?.role === 'BOOKSTORE_SELLER';

  const [mode, setMode] = useState<'MANUAL' | 'CSV'>('MANUAL');
  
  // Metadata search states (ISBN or title)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<MetadataSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string>('');
  const [selectedBook, setSelectedBook] = useState<MetadataSearchResult | null>(null);
  const selectionToken = useRef(0);

  // Form states
  const [bookTitle, setBookTitle] = useState<string>('');
  const [bookAuthor, setBookAuthor] = useState<string>('');
  const [bookIsbn, setBookIsbn] = useState<string>('');
  const [bookPublisher, setBookPublisher] = useState<string>('');
  const [bookYear, setBookYear] = useState<string>('');
  const [bookLanguage, setBookLanguage] = useState<string>('FRENCH');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [conditionOverride, setConditionOverride] = useState<string | null>(null);
  const condition = conditionOverride ?? (isLibrary ? 'NEW' : 'VERY_GOOD');
  const [conditionNotes, setConditionNotes] = useState<string>('Exemplaire lu avec soin, pages impeccables sans ratures.');
  const [bookDescription, setBookDescription] = useState<string>('');
  const [price, setPrice] = useState<string>('750');
  const [quantity, setQuantity] = useState<string>('1');
  const [inStock, setInStock] = useState<boolean>(true);
  const [regions, setRegions] = useState<number[]>([]);
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [hasPickup, setHasPickup] = useState<boolean>(true);
  const [hasStopDesk, setHasStopDesk] = useState<boolean>(true);
  const [hasHome, setHasHome] = useState<boolean>(true);

  // Cover image states (file upload or URL paste)
  const [coverImage, setCoverImage] = useState<string>('');
  const [coverMode, setCoverMode] = useState<'upload' | 'url'>('upload');
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [uploadingCover, setUploadingCover] = useState<boolean>(false);
  const [coverUploadError, setCoverUploadError] = useState<string>('');

  // Submission states
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [publishError, setPublishError] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [createdOffer, setCreatedOffer] = useState<{
    offer_id: number;
    work_id: number;
    work_slug: string;
    work_title: string;
    price: number;
    cover_image?: string;
  } | null>(null);

  // CSV import states
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState<boolean>(false);
  const [csvResult, setCsvResult] = useState<{
    success: boolean;
    imported_count?: number;
    errors?: string[];
  } | null>(null);

  // A library account must finish its storefront setup before publishing.
  useEffect(() => {
    if (!initialized || !user) return;
    if (isLibrary && !user.bookstore_profile) {
      router.replace('/dashboard/library');
    }
  }, [initialized, isLibrary, router, user]);

  useEffect(() => {
    Promise.all([fetchWilayas(), fetchCategories()]).then(
      ([wilayaList, categoryList]) => {
        setWilayas(wilayaList);
        setCategories(categoryList);
      },
    );
  }, []);

  const normalizeCategoryLabel = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const categoryFromMetadata = (labels: string[]) => {
    if (!labels.length || !categories.length) return [] as string[];
    return categories
      .filter((category) =>
        labels.some((label) => {
          const normalized = normalizeCategoryLabel(label);
          return (
            normalized === category.slug ||
            normalized === normalizeCategoryLabel(category.name_fr) ||
            (category.name_en && normalized === normalizeCategoryLabel(category.name_en)) ||
            label.trim().toLowerCase() === (category.name_ar || '').toLowerCase()
          );
        }),
      )
      .map((category) => String(category.id));
  };

  const toggleCategory = (categoryId: string) => {
    setCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  };

  const toggleRegion = (wilayaId: number) => {
    setRegions((current) =>
      current.includes(wilayaId)
        ? current.filter((item) => item !== wilayaId)
        : [...current, wilayaId],
    );
  };

  const providerLabel = (provider?: string) => {
    if (!provider || provider === 'local') return 'Catalogue BookstoreDZ';
    if (provider === 'open_library') return 'Open Library';
    if (provider === 'google_books') return 'Google Books';
    return provider;
  };

  const handleMetadataSearch = async () => {
    const query = searchQuery.trim();
    if (!query || searchLoading) return;

    setSearchLoading(true);
    setSearchError('');
    setSearchResults([]);
    setSelectedBook(null);

    try {
      if (isIsbnQuery(query)) {
        // ISBNs use the exact lookup endpoint: it is faster and returns the
        // edition identifiers that a free-text search sometimes omits.
        const record = await lookupBookByIsbn(query);
        if (record) {
          setSearchResults([record]);
        } else {
          setSearchError(
            'Aucun livre trouvé pour cet ISBN. Vérifiez le numéro ou saisissez le titre manuellement.'
          );
        }
      } else {
        const response = await searchBookMetadata(query, 'any', 12);
        setSearchResults(response.results);
        if (response.results.length === 0) {
          const externalAnswered = Object.values(response.providers).some(
            (provider) => provider.status === 'ok' || provider.status === 'cached'
          );
          setSearchError(
            externalAnswered
              ? 'Aucun livre trouvé pour ce titre. Essayez un autre titre ou vérifiez l’orthographe.'
              : 'Les sources externes sont momentanément indisponibles. Vous pouvez saisir les informations manuellement.'
          );
        }
      }
    } catch (err) {
      console.error(err);
      setSearchError(
        'Recherche indisponible pour le moment. Vous pouvez saisir les informations manuellement.'
      );
    } finally {
      setSearchLoading(false);
    }
  };

  const applySelectedRecord = (record: MetadataSearchResult) => {
    setSelectedBook(record);
    setBookTitle(record.title || '');
    setBookAuthor((record.authors || []).join(', '));
    setBookIsbn(record.isbn13 || record.isbn10 || '');
    setBookPublisher(record.publisher || '');
    setBookYear(record.publication_year ? String(record.publication_year) : '');
    setBookDescription(record.description || '');
    setBookLanguage(languageFromMetadata(record.language));
    setCategoryIds(categoryFromMetadata(record.categories || []));
    if (record.cover_image) {
      setCoverImage(record.cover_image);
    }
  };

  const handleSelectBook = async (record: MetadataSearchResult) => {
    const token = ++selectionToken.current;
    applySelectedRecord(record);
    setSearchResults([]);
    setSearchError('');

    // Search results describe a work; the ISBN lookup returns the exact
    // edition (publisher, year, pages, cover) so those fields are not lost.
    const isbn = record.isbn13 || record.isbn10;
    if (!isbn) return;

    try {
      const exact = await lookupBookByIsbn(isbn);
      if (!exact || selectionToken.current !== token) return;

      const merged: MetadataSearchResult = {
        ...record,
        ...exact,
        title: exact.title || record.title,
        authors: exact.authors?.length ? exact.authors : record.authors,
        publisher: exact.publisher || record.publisher,
        publication_year: exact.publication_year ?? record.publication_year,
        language: exact.language || record.language,
        page_count: exact.page_count ?? record.page_count,
        cover_image: exact.cover_image || record.cover_image,
        description: exact.description || record.description,
        categories: exact.categories?.length ? exact.categories : record.categories,
        isbn10: exact.isbn10 || record.isbn10,
        isbn13: exact.isbn13 || record.isbn13,
        published_date: exact.published_date || record.published_date,
        translators: exact.translators?.length
          ? exact.translators
          : record.translators,
      };
      applySelectedRecord(merged);
    } catch {
      // The provider search values remain usable when the exact lookup fails.
    }
  };

  const clearSelectedBook = () => {
    setSelectedBook(null);
    setSearchResults([]);
    setSearchError('');
  };

  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setCoverUploadError(t("L'image dépasse la taille maximale autorisée (10 Mo)."));
      return;
    }

    setUploadingCover(true);
    setCoverUploadError('');
    try {
      const res = await uploadImage(file);
      if (res.url) {
        setCoverImage(res.url);
      } else {
        setCoverUploadError(t("Échec du téléversement de l'image."));
      }
    } catch (err: unknown) {
      console.error('Image upload error:', err);
      setCoverUploadError(
        err instanceof Error
          ? err.message
          : t("Erreur lors du téléversement de l'image."),
      );
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleApplyImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setCoverUploadError(t("Veuillez saisir une URL valide commençant par http:// ou https://"));
      return;
    }
    setCoverImage(trimmed);
    setCoverUploadError('');
  };

  const handleResetForm = () => {
    setSubmitted(false);
    setCreatedOffer(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    setSelectedBook(null);
    setBookTitle('');
    setBookAuthor('');
    setBookIsbn('');
    setBookPublisher('');
    setBookYear('');
    setBookLanguage('FRENCH');
    setCoverImage('');
    setImageUrlInput('');
    setCoverUploadError('');
    setPublishError('');
    setBookDescription('');
    setCategoryIds([]);
    setConditionOverride(null);
    setPrice('750');
    setQuantity('1');
    setInStock(true);
    setRegions([]);
  };

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setCsvUploading(true);
    setCsvResult(null);

    const storeId = user?.bookstore_profile?.id;
    if (!storeId) {
      setCsvResult({
        success: false,
        errors: [t('Aucune librairie associée à ce compte.')],
      });
      setCsvUploading(false);
      return;
    }

    try {
      const data = await uploadCatalogCsv(csvFile, storeId);
      setCsvResult(data);
    } catch (err) {
      console.error(err);
      setCsvResult({ success: false, errors: [t('Erreur de connexion au serveur')] });
    } finally {
      setCsvUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setPublishError(t("Veuillez indiquer un prix valide supérieur à 0 DA."));
      return;
    }

    setSubmitting(true);
    setPublishError('');

    try {
      const parsedStock = isLibrary
        ? (inStock ? Math.max(1, parseInt(quantity, 10) || 1) : 0)
        : 1;

      const authorNames = bookAuthor
        .split(/[,;]/)
        .map((name) => name.trim())
        .filter(Boolean);
      const isbnDigits = bookIsbn.replace(/[^0-9Xx]/g, '').toUpperCase();

      const payload: BookWritePayload = {
        title: bookTitle.trim(),
        description: bookDescription.trim() || conditionNotes.trim() || undefined,
        category: categoryIds.length ? Number(categoryIds[0]) : null,
        categories: categoryIds.map(Number),
        author: bookAuthor.trim(),
        authors: authorNames,
        isbn: isbnDigits || undefined,
        publisher: bookPublisher.trim() || undefined,
        publication_year: bookYear ? parseInt(bookYear, 10) : undefined,
        publication_date: selectedBook?.published_date || undefined,
        page_count: selectedBook?.page_count ?? undefined,
        translators: selectedBook?.translators?.length
          ? selectedBook.translators
          : undefined,
        language: bookLanguage.trim() || 'FRENCH',
        price: parsedPrice,
        stock_quantity: parsedStock,
        is_in_stock: parsedStock > 0,
        condition,
        condition_description: conditionNotes,
        regions,
        cover_image: coverImage.trim() || undefined,
        photos: coverImage.trim() ? [coverImage.trim()] : [],
        has_store_pickup: hasPickup,
        has_home_delivery: hasHome,
        has_stop_desk_delivery: hasStopDesk,
        stop_desk_fee: 350,
        home_delivery_fee: 550,
      };

      const created = await createBook(payload);
      setCreatedOffer({
        offer_id: created.id,
        work_id: created.work_id,
        work_slug: created.work_slug,
        work_title: created.work_title,
        price: created.price,
        cover_image: created.work_cover || created.photos?.[0],
      });
      setSubmitted(true);
    } catch (err: unknown) {
      console.error('Publish error:', err);
      setPublishError(
        err instanceof Error
          ? err.message
          : t("Une erreur est survenue lors de la publication de l'offre."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-ivory">
      <section className="relative overflow-hidden border-b border-line bg-parchment">
        <ZelligeField className="text-sea" opacity={0.035} />
        <div className="relative mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-muted">
            <Link href="/" className="hover:text-sea">{t("Accueil")}</Link>
            <span>/</span>
            <span className="text-ink">{t("Vendre")}</span>
          </div>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-label text-clay">
                <ZelligeStar className="h-3 w-3" />
                {t("Espace vendeur · Algérie")}{' '}</div>
              <h1 className="mt-3 max-w-2xl text-[2.6rem] leading-[0.98] tracking-[-0.04em] sm:text-[3.3rem]">
                {t("Mettre un livre")}{' '}<span className="italic text-clay">{t("en circulation.")}</span>
              </h1>
              <p className="mt-4 max-w-xl text-[12.5px] leading-relaxed text-muted">
                {t("Rattachez votre exemplaire à la fiche centrale de l’œuvre. Votre offre rejoint immédiatement le comparateur, aux côtés des librairies et des autres lecteurs.")}{' '}</p>
            </div>
            <div className="border border-line bg-ivory p-5">
              <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">{t("Bon à savoir")}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
                {t("Une fiche claire, une photo réelle et un prix juste : c’est ce qui fait vendre un livre d’occasion.")}{' '}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-10 space-y-8 sm:px-6 lg:px-8">
      {submitted && createdOffer ? (
        <div className="bg-parchment rounded-sm border border-[#e2d6c1] p-8 sm:p-10 text-center space-y-6 shadow-xs animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-2xl font-display font-normal text-ink">
              {t("Votre offre est en ligne avec succès !")}{' '}
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              {t("Votre exemplaire de")}{' '}
              <strong>{createdOffer.work_title || bookTitle}</strong>{' '}
              {t("a été rattaché au catalogue central au tarif de")}{' '}
              <strong className="text-ink font-mono font-bold text-sm">
                {createdOffer.price || price} {t("DA")}
              </strong>
              {isLibrary
                ? t(". Il apparaît dès maintenant dans l'inventaire de votre librairie et sur le comparateur.")
                : t(". Les acheteurs de votre Wilaya peuvent désormais vous contacter.")}
            </p>
          </div>

          {createdOffer.cover_image && (
            <div className="flex justify-center">
              <img
                src={createdOffer.cover_image}
                alt={createdOffer.work_title || bookTitle}
                className="h-40 w-28 object-cover rounded-xs border border-line shadow-sm"
              />
            </div>
          )}

          <div className="pt-2 flex flex-wrap justify-center gap-3">
            {createdOffer.work_slug && (
              <Link
                href={`/books/${createdOffer.work_slug}`}
                className="px-5 py-2.5 bg-[#0e3444] text-ivory text-xs font-bold rounded-xs hover:bg-[#0a2632] transition-colors flex items-center gap-1.5"
              >
                <span>{t("Voir la fiche du livre")}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            {isLibrary ? (
              <Link
                href="/dashboard/library"
                className="px-5 py-2.5 bg-emerald-700 text-white text-xs font-bold rounded-xs hover:bg-emerald-800 transition-colors flex items-center gap-1.5"
              >
                <Store className="w-3.5 h-3.5" />
                <span>{t("Voir mon catalogue librairie")}</span>
              </Link>
            ) : (
              <Link
                href="/dashboard/seller"
                className="px-5 py-2.5 bg-[#b4512f] text-white text-xs font-bold rounded-xs hover:bg-[#93401f] transition-colors flex items-center gap-1.5"
              >
                <span>{t("Voir mes livres d'occasion")}</span>
              </Link>
            )}

            <button
              type="button"
              onClick={handleResetForm}
              className="px-5 py-2.5 bg-ivory border border-line text-ink-soft text-xs font-bold rounded-xs hover:bg-sand/40 transition-colors"
            >
              {t("Ajouter un autre livre")}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-parchment rounded-sm border border-[#e2d6c1] p-6 sm:p-10 shadow-xs space-y-8">
          
          <div className="rounded-sm border border-line bg-ivory px-4 py-3 text-[11px] leading-relaxed text-muted">
            {isLibrary ? (
              <p>
                <strong className="text-ink">{t('Compte librairie')}</strong>{' '}
                {t('— votre livre sera automatiquement relié à votre vitrine et au comparateur.')}
              </p>
            ) : (
              <p>
                <strong className="text-ink">{t('Compte particulier')}</strong>{' '}
                {t("— votre annonce sera publiée comme un exemplaire d'occasion unique.")}
              </p>
            )}
          </div>

          {/* Mode Switch for Library: Single listing vs CSV Bulk upload */}
          {isLibrary && (
            <div className="flex border-b border-line gap-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setMode('MANUAL')}
                className={`pb-3 border-b-2 transition-colors ${mode === 'MANUAL' ? 'border-[#0e3444] text-[#0e3444]' : 'border-transparent text-muted/70 hover:text-ink-soft'}`}
              >
                {t("Ajout unitaire (ISBN / Titre)")}{' '}</button>
              <button
                type="button"
                onClick={() => setMode('CSV')}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${mode === 'CSV' ? 'border-[#0e3444] text-[#0e3444]' : 'border-transparent text-muted/70 hover:text-ink-soft'}`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                {t("Import massif Catalogue (CSV / Excel)")}{' '}</button>
            </div>
          )}

          {/* CSV Bulk Upload Mode */}
          {isLibrary && mode === 'CSV' ? (
            <form onSubmit={handleCsvUpload} className="space-y-6">
              <div className="bg-ivory rounded-sm p-6 border border-line space-y-3">
                <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#0e3444]" />
                  {t("Téléversement de votre fichier de stock")}{' '}</h3>
                <p className="text-xs text-muted leading-relaxed">
                  {t("Exportez votre inventaire depuis votre logiciel de caisse au format CSV. Le catalogue central fera la correspondance automatique avec les fiches existantes via l'ISBN.")}{' '}</p>
                <div className="text-[11px] font-mono bg-parchment p-3 rounded-xs border border-line text-muted">
                  {t("Colonnes requises :")}{' '}<strong>{t("isbn, title, author, price, quantity, condition")}</strong>
                </div>
              </div>

              <div className="border-2 border-dashed border-line-dark rounded-sm p-8 text-center hover:border-stone-400 transition-colors">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="csv-file-input"
                />
                <label htmlFor="csv-file-input" className="cursor-pointer space-y-2 block">
                  <Upload className="w-8 h-8 text-muted/70 mx-auto" />
                  <p className="text-xs font-bold text-ink">
                    {csvFile ? csvFile.name : 'Cliquez pour sélectionner votre fichier CSV'}
                  </p>
                  <p className="text-[11px] text-muted/70">
                    {t("Taille maximale : 10 Mo")}{' '}</p>
                </label>
              </div>

              {csvResult && (
                <div className={`p-4 rounded-sm border text-xs ${csvResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  {csvResult.success ? (
                    <p className="font-bold">
                      {t("✓ Import réussi :")}{' '}{csvResult.imported_count} {t("ouvrages importés et rattachés à votre librairie !")}{' '}</p>
                  ) : (
                    <p className="font-bold">
                      {t("Erreur lors de l'import :")}{' '}{csvResult.errors?.join(', ')}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!csvFile || csvUploading}
                className="w-full py-3 bg-[#0e3444] text-ivory text-xs font-bold rounded-xs hover:bg-[#0a2632] disabled:opacity-50 transition-all"
              >
                {csvUploading ? 'Importation en cours...' : 'Importer le catalogue CSV'}
              </button>
            </form>
          ) : (
            /* Manual / ISBN Lookup Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Step 1: ISBN / title search & auto-fill */}
              <div className="space-y-4">
                <h3 className="text-sm font-display font-normal text-ink flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#0e3444] text-ivory flex items-center justify-center text-xs">1</span>
                  {t("Rechercher un livre par ISBN ou par titre")}{' '}</h3>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t("ISBN ou titre (ex: 9789961892813, Nedjma)...")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleMetadataSearch();
                      }
                    }}
                    className="flex-1 p-3 bg-ivory border border-line rounded-xs text-xs font-mono focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleMetadataSearch}
                    disabled={searchLoading || !searchQuery.trim()}
                    className="px-4 py-3 bg-[#0e3444] text-ivory text-xs font-bold rounded-xs hover:bg-[#0a2632] disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>{searchLoading ? 'Recherche...' : 'Rechercher'}</span>
                  </button>
                </div>

                <p className="text-[11px] leading-relaxed text-muted/80">
                  {t("Le catalogue BookstoreDZ est interrogé en premier, puis Open Library et Google Books. Cliquez sur un résultat pour remplir automatiquement la fiche.")}{' '}</p>

                {searchError && (
                  <div className="bg-amber-50 border border-amber-200 rounded-sm p-3 text-xs text-amber-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{searchError}</span>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="overflow-hidden rounded-sm border border-line bg-ivory">
                    <div className="border-b border-line bg-parchment px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {searchResults.length} {t("résultat")}{searchResults.length > 1 ? 's' : ''} {t("— cliquez pour sélectionner")}{' '}</div>
                    <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                      {searchResults.map((record, index) => (
                        <li key={`${record.provider}-${record.provider_id}-${index}`}>
                          <button
                            type="button"
                            onClick={() => handleSelectBook(record)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sand/40"
                          >
                            {record.cover_image ? (
                              <img
                                src={record.cover_image}
                                alt=""
                                className="h-14 w-10 shrink-0 rounded-xs border border-line object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-xs border border-line bg-parchment text-muted/60">
                                <BookOpen className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-ink">{record.title}</p>
                              <p className="truncate text-[11px] text-muted">
                                {(record.authors || []).join(', ') || 'Auteur inconnu'}
                                {record.publisher ? ` • ${record.publisher}` : ''}
                                {record.publication_year ? ` (${record.publication_year})` : ''}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] font-mono text-muted/70">
                                {record.isbn13 || record.isbn10 || 'ISBN non renseigné'}
                                <span className="ml-2 font-sans font-semibold uppercase tracking-wider text-sea/70">
                                  {providerLabel(record.provider)}
                                </span>
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-clay">
                              {t("Choisir")}{' '}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedBook && (
                  <div className="flex items-start gap-4 rounded-sm border border-emerald-200 bg-emerald-50 p-4">
                    {selectedBook.cover_image ? (
                      <img
                        src={selectedBook.cover_image}
                        alt={selectedBook.title}
                        className="h-20 w-14 shrink-0 rounded-xs border border-emerald-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xs border border-emerald-200 bg-white text-emerald-700/50">
                        <BookOpen className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        {t("✓ Fiche sélectionnée ·")}{' '}{providerLabel(selectedBook.provider)}
                      </p>
                      <h4 className="mt-0.5 font-bold text-ink">{selectedBook.title}</h4>
                      <p className="mt-0.5 text-muted">
                        {(selectedBook.authors || []).join(', ') || 'Auteur inconnu'}
                        {selectedBook.publisher ? ` • ${selectedBook.publisher}` : ''}
                        {selectedBook.publication_year ? ` (${selectedBook.publication_year})` : ''}
                      </p>
                      <p className="mt-1 text-[10px] text-muted/80">
                        {selectedBook.isbn13 || selectedBook.isbn10
                          ? `ISBN ${selectedBook.isbn13 || selectedBook.isbn10}`
                          : 'ISBN non renseigné'}
                        {selectedBook.language ? ` · Langue ${selectedBook.language}` : ''}
                        {selectedBook.page_count ? ` · ${selectedBook.page_count} pages` : ''}
                      </p>
                      {selectedBook.categories?.length ? (
                        <p className="mt-1 text-[10px] font-medium text-emerald-800">
                          {t('Catégories source')} : {selectedBook.categories.join(', ')}
                        </p>
                      ) : null}
                      {selectedBook.description && (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
                          {selectedBook.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {selectedBook.source_url && (
                          <a
                            href={selectedBook.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-semibold text-sea hover:underline"
                          >
                            {t("Voir la source")}{' '}</a>
                        )}
                        <button
                          type="button"
                          onClick={clearSelectedBook}
                          className="text-[10px] font-semibold text-muted hover:text-ink"
                        >
                          {t("Changer de livre")}{' '}</button>
                        {(selectedBook.attribution || selectedBook.license) && (
                          <span className="text-[9px] text-muted/70">
                            {[selectedBook.attribution, selectedBook.license].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      {t("Titre de l'ouvrage")}{' '}</label>
                    <input
                      type="text"
                      value={bookTitle}
                      onChange={(e) => setBookTitle(e.target.value)}
                      required
                      className="w-full p-2.5 bg-ivory border border-line rounded-xs text-xs font-bold text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      {t("Auteur(s)")}{' '}</label>
                    <input
                      type="text"
                      value={bookAuthor}
                      onChange={(e) => setBookAuthor(e.target.value)}
                      required
                      className="w-full p-2.5 bg-ivory border border-line rounded-xs text-xs text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      {t("ISBN")}{' '}</label>
                    <input
                      type="text"
                      value={bookIsbn}
                      onChange={(e) => setBookIsbn(e.target.value)}
                      placeholder={t("Rempli automatiquement")}
                      className="w-full p-2.5 bg-ivory border border-line rounded-xs text-xs font-mono text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      {t("Éditeur")}{' '}</label>
                    <input
                      type="text"
                      value={bookPublisher}
                      onChange={(e) => setBookPublisher(e.target.value)}
                      placeholder={t("Rempli automatiquement")}
                      className="w-full p-2.5 bg-ivory border border-line rounded-xs text-xs text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      {t("Année de publication")}{' '}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={bookYear}
                      onChange={(e) => setBookYear(e.target.value)}
                      placeholder={t("Rempli automatiquement")}
                      className="w-full p-2.5 bg-ivory border border-line rounded-xs text-xs text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      {t("Langue")}{' '}</label>
                    <select
                      value={bookLanguage}
                      onChange={(e) => setBookLanguage(e.target.value)}
                      className="w-full p-2.5 bg-ivory border border-line rounded-xs text-xs font-medium text-ink focus:ring-2 focus:ring-sea focus:outline-none"
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.label)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-muted mb-1">
                      {t("Catégories du livre")}
                      <span className="ml-1 font-normal text-muted/70">
                        {categoryIds.length > 0 ? `(${categoryIds.length})` : t('(optionnel)')}
                      </span>
                    </label>
                    <div className="max-h-44 overflow-y-auto border border-line bg-ivory p-2">
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {categories.map((category) => {
                          const active = categoryIds.includes(String(category.id));
                          return (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => toggleCategory(String(category.id))}
                              className={`rounded-xs border px-2.5 py-2 text-left text-[10.5px] transition-colors ${
                                active
                                  ? 'border-sea bg-sea text-ivory'
                                  : 'border-line bg-parchment/50 text-ink-soft hover:border-sea/40 hover:text-sea'
                              }`}
                            >
                              {getLocalizedCategory(category, locale)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {categoryIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setCategoryIds([])}
                        className="mt-1.5 text-[10px] uppercase tracking-[0.08em] text-clay hover:underline"
                      >
                        {t('Tout effacer')}
                      </button>
                    ) : null}
                    {selectedBook?.categories?.length && !categoryIds.length ? (
                      <p className="mt-1 text-[10.5px] text-amber-700">
                        {t('Aucune catégorie du catalogue ne correspond exactement aux sujets externes. Choisissez-en une ci-dessus.')}
                      </p>
                    ) : null}
                  </div>
                </div>

                  {/* COVER PHOTO UPLOAD / URL PASTE SECTION */}
                  <div className="pt-4 border-t border-line space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted/70">
                        {t("Photo de couverture du livre")}
                      </label>
                      {coverImage && (
                        <button
                          type="button"
                          onClick={() => {
                            setCoverImage('');
                            setImageUrlInput('');
                          }}
                          className="text-[11px] text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{t("Supprimer la couverture")}</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4 items-start">
                      {/* Thumbnail Preview */}
                      <div className="flex flex-col items-center">
                        {coverImage ? (
                          <div className="relative group w-28 h-36 rounded-sm border border-line bg-parchment overflow-hidden shadow-xs">
                            <img
                              src={coverImage}
                              alt={bookTitle || 'Couverture'}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setCoverImage('');
                                  setImageUrlInput('');
                                }}
                                className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded-xs shadow"
                              >
                                {t("Retirer")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="w-28 h-36 rounded-sm border-2 border-dashed border-line bg-parchment/60 flex flex-col items-center justify-center p-2 text-center text-muted/60">
                            <ImageIcon className="w-7 h-7 mb-1 stroke-[1.5]" />
                            <span className="text-[10px] font-medium leading-tight">
                              {t("Aucune photo")}
                            </span>
                          </div>
                        )}
                        <span className="text-[9px] text-muted mt-1 text-center">
                          {coverImage ? t("Aperçu actif") : t("Optionnel mais recommandé")}
                        </span>
                      </div>

                      {/* Upload / URL Options */}
                      <div className="space-y-3">
                        <div className="flex rounded-sm bg-sand/30 p-1 border border-line gap-1 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setCoverMode('upload');
                              setCoverUploadError('');
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                              coverMode === 'upload'
                                ? 'bg-ivory text-ink shadow-xs'
                                : 'text-muted hover:text-ink'
                            }`}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{t("Téléverser un fichier")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCoverMode('url');
                              setCoverUploadError('');
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                              coverMode === 'url'
                                ? 'bg-ivory text-ink shadow-xs'
                                : 'text-muted hover:text-ink'
                            }`}
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                            <span>{t("Coller une URL d'image")}</span>
                          </button>
                        </div>

                        {/* File Upload Mode */}
                        {coverMode === 'upload' && (
                          <div className="border-2 border-dashed border-line-dark rounded-sm p-4 text-center hover:border-sea/60 transition-colors bg-ivory">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/jpg,image/gif"
                              onChange={handleCoverFileUpload}
                              className="hidden"
                              id="book-cover-input"
                              disabled={uploadingCover}
                            />
                            <label htmlFor="book-cover-input" className="cursor-pointer space-y-1 block">
                              {uploadingCover ? (
                                <div className="flex flex-col items-center py-2 text-sea">
                                  <Loader2 className="w-6 h-6 animate-spin mb-1.5" />
                                  <p className="text-xs font-bold">{t("Téléversement de l'image en cours...")}</p>
                                </div>
                              ) : (
                                <>
                                  <Upload className="w-6 h-6 text-muted/70 mx-auto" />
                                  <p className="text-xs font-bold text-ink">
                                    {t("Cliquez pour choisir une photo (JPG, PNG, WebP)")}
                                  </p>
                                  <p className="text-[10px] text-muted/70">
                                    {t("Photo depuis votre téléphone ou ordinateur (Max 10 Mo)")}
                                  </p>
                                </>
                              )}
                            </label>
                          </div>
                        )}

                        {/* Paste URL Mode */}
                        {coverMode === 'url' && (
                          <div className="space-y-2 bg-ivory p-3 rounded-sm border border-line">
                            <label className="block text-[11px] font-semibold text-muted">
                              {t("Lien web direct vers l'image (URL)")}
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                placeholder="https://..."
                                value={imageUrlInput}
                                onChange={(e) => setImageUrlInput(e.target.value)}
                                className="flex-1 p-2 bg-parchment/60 border border-line rounded-xs text-xs font-mono focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={handleApplyImageUrl}
                                disabled={!imageUrlInput.trim()}
                                className="px-3 py-2 bg-[#0e3444] text-ivory text-xs font-bold rounded-xs hover:bg-[#0a2632] disabled:opacity-50 transition-all shrink-0"
                              >
                                {t("Appliquer")}
                              </button>
                            </div>
                            <p className="text-[10px] text-muted">
                              {t("Exemple : lien Google Images, Unsplash ou site éditeur")}
                            </p>
                          </div>
                        )}

                        {coverUploadError && (
                          <div className="p-2.5 rounded-xs bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{coverUploadError}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Condition, Description & Pricing */}
                <div className="space-y-4 pt-4 border-t border-stone-100">
                  <h3 className="text-sm font-display font-normal text-ink flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#0e3444] text-ivory flex items-center justify-center text-xs">2</span>
                    {t("État de l'exemplaire & Prix de vente (DZD)")}{' '}</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">
                        {t("État du livre")}{' '}</label>
                      <select
                        value={condition}
                        onChange={(e) => setConditionOverride(e.target.value)}
                        className="w-full p-2.5 bg-ivory border border-line rounded-xs text-xs font-medium focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                      >
                        <option value="NEW">{t("Neuf (Exemplaire scellé / Librairie)")}</option>
                        <option value="LIKE_NEW">{t("Comme neuf (Lu une fois, aucune trace)")}</option>
                        <option value="VERY_GOOD">{t("Très bon état (Légères marques d'usage)")}</option>
                        <option value="GOOD">{t("Bon état (Pages propres, reliure solide)")}</option>
                        <option value="ACCEPTABLE">{t("État convenable (Usure visible)")}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">
                        {t("Prix en Dinars Algériens (DA)")}{' '}</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder={t("Ex: 850")}
                          required
                          min="50"
                          className="w-full p-2.5 pr-12 bg-ivory border border-line rounded-xs text-sm font-bold focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                        />
                        <span className="absolute right-3.5 top-3 text-xs font-bold text-muted/70">
                          {t("DA")}{' '}</span>
                      </div>
                    </div>

                    {isLibrary && (
                      <div className="sm:col-span-2 rounded-sm border border-line bg-ivory p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-ink">{t("Stock de la librairie")}</p>
                            <p className="text-[11px] text-muted">
                              {t("Le statut en stock est calculé automatiquement à partir de la quantité.")}
                            </p>
                          </div>
                          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-soft">
                            <input
                              type="checkbox"
                              checked={inStock}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setInStock(checked);
                                if (checked && (parseInt(quantity, 10) || 0) < 1) setQuantity('1');
                                if (!checked) setQuantity('0');
                              }}
                              className="rounded text-[#0e3444]"
                            />
                            {t("Disponible en stock")}
                          </label>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <input
                            type="number"
                            min="0"
                            value={quantity}
                            onChange={(e) => {
                              setQuantity(e.target.value);
                              setInStock((parseInt(e.target.value, 10) || 0) > 0);
                            }}
                            className="w-32 p-2.5 bg-parchment/60 border border-line rounded-xs text-sm font-bold focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                          />
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            (parseInt(quantity, 10) || 0) > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {(parseInt(quantity, 10) || 0) > 0 ? t("En stock") : t("Rupture de stock")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      {t("Description du livre")}{' '}
                    </label>
                    <textarea
                      rows={3}
                      value={bookDescription}
                      onChange={(e) => setBookDescription(e.target.value)}
                      placeholder={t("Présentez le livre, son état, son édition…")}
                      className="w-full p-2.5 bg-ivory border border-line rounded-xs text-xs text-ink focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                    />
                  </div>

                  {!isLibrary && (
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">
                        {t("Notes sur l'état de l'exemplaire")}{' '}
                      </label>
                      <textarea
                        rows={2}
                        value={conditionNotes}
                        onChange={(e) => setConditionNotes(e.target.value)}
                        className="w-full p-2.5 bg-ivory border border-line rounded-xs text-xs text-ink focus:ring-2 focus:ring-[#0e3444] focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Step 3: Delivery regions & logistics */}
                <div className="space-y-4 pt-4 border-t border-stone-100">
                  <h3 className="text-sm font-display font-normal text-ink flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#0e3444] text-ivory flex items-center justify-center text-xs">3</span>
                    {t("Régions de livraison & Modes d'expédition")}{' '}</h3>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-muted">
                        {t("Wilayas desservies")}{' '}
                        <span className="font-normal text-muted/70">
                          {regions.length === 0
                            ? t("(toutes les wilayas)")
                            : `(${regions.length} ${t("sélectionnée(s)")})`}
                        </span>
                      </label>
                      {regions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setRegions([])}
                          className="text-[10px] font-semibold text-clay hover:underline"
                        >
                          {t("Toutes les wilayas")}
                        </button>
                      )}
                    </div>
                    <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto rounded-sm border border-line bg-ivory p-3 sm:grid-cols-3">
                      {wilayas.map((item) => {
                        const active = regions.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleRegion(item.id)}
                            className={`rounded-xs border px-2 py-1.5 text-left text-[10px] transition-colors ${
                              active
                                ? 'border-sea bg-sea text-ivory'
                                : 'border-line bg-parchment/50 text-ink-soft hover:border-sea/40 hover:text-sea'
                            }`}
                          >
                            {item.code} · {getLocalizedWilaya(item, locale)}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[10.5px] text-muted">
                      {t("Laissez vide pour livrer dans les 58 wilayas.")}
                    </p>
                  </div>

                  <div className="space-y-2 pt-1 text-xs text-ink-soft">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasPickup}
                        onChange={(e) => setHasPickup(e.target.checked)}
                        className="rounded text-[#0e3444]"
                      />
                      <span>{t("Retrait direct / Remise en main propre locale (Gratuit)")}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasStopDesk}
                        onChange={(e) => setHasStopDesk(e.target.checked)}
                        className="rounded text-[#0e3444]"
                      />
                      <span>{t("Expédition Stop-Desk (Bureau Yalidine / ZR Express : 350 DA)")}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasHome}
                        onChange={(e) => setHasHome(e.target.checked)}
                        className="rounded text-[#0e3444]"
                      />
                      <span>{t("Livraison à domicile (550 DA)")}</span>
                    </label>
                  </div>
                </div>

                {publishError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-sm text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{publishError}</span>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-3.5 text-ivory font-bold text-xs rounded-xs transition-all shadow-md flex items-center justify-center gap-2 ${
                      isLibrary
                        ? 'bg-[#0e3444] hover:bg-[#0a2632]'
                        : 'bg-[#b4512f] hover:bg-[#93401f]'
                    } disabled:opacity-50`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t("Publication en cours...")}</span>
                      </>
                    ) : (
                      <span>
                        {isLibrary
                          ? t("Publier dans le catalogue de la librairie")
                          : t("Publier l'offre sur Bookstore.dz")}
                      </span>
                    )}
                  </button>
                </div>

              </form>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

export default function SellPage() {
  return (
    <Suspense fallback={<div className="bg-ivory min-h-screen" />}>
      <SellPageContent />
    </Suspense>
  );
}
