import {
  Work, Bookstore, Offer, Wilaya, Category, Author,
  Order, WishlistItem, BookstoreStats, BookstoreOrder, LibraryOrder,
  AdminAnalytics, AdminUser, MetadataSearchResponse, MetadataSearchResult,
  Conversation, ConversationMessage, ConversationThread, Notification, NotificationList,
} from './types';

import { getStoredToken } from './auth-storage';

const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://dzbookstore.onrender.com/api').trim();
const API_BASE = rawApiUrl.replace(/\/+$/, '').endsWith('/api')
  ? rawApiUrl.replace(/\/+$/, '')
  : `${rawApiUrl.replace(/\/+$/, '')}/api`;

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Token ${token}` } : {};
}

export async function fetchWorks(params?: {
  search?: string;
  category?: string;
  featured?: boolean;
}): Promise<Work[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.category) query.set('category', params.category);
  if (params?.featured) query.set('featured', 'true');

  try {
    const res = await fetch(`${API_BASE}/works/?${query.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch works');
    const data = await res.json();
    return data.results || data;
  } catch (error) {
    console.error('Error fetching works:', error);
    return [];
  }
}

export async function fetchWorkBySlug(slug: string): Promise<Work | null> {
  try {
    const res = await fetch(`${API_BASE}/works/${slug}/`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`Error fetching work ${slug}:`, error);
    return null;
  }
}

export async function fetchBookstores(params?: {
  wilaya_id?: number;
  search?: string;
}): Promise<Bookstore[]> {
  const query = new URLSearchParams();
  if (params?.wilaya_id) query.set('wilaya_id', params.wilaya_id.toString());
  if (params?.search) query.set('search', params.search);

  try {
    const res = await fetch(`${API_BASE}/bookstores/?${query.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch bookstores');
    const data = await res.json();
    return data.results || data;
  } catch (error) {
    console.error('Error fetching bookstores:', error);
    return [];
  }
}

export async function fetchBookstoreBySlug(slug: string): Promise<Bookstore | null> {
  try {
    const res = await fetch(`${API_BASE}/libraries/${encodeURIComponent(slug)}/`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`Error fetching bookstore ${slug}:`, error);
    return null;
  }
}

// ----------------- LIBRARIES (PUBLIC DIRECTORY) -----------------

export async function fetchLibraries(params?: {
  wilaya_id?: number;
  search?: string;
}): Promise<Bookstore[]> {
  const query = new URLSearchParams();
  if (params?.wilaya_id) query.set('wilaya_id', params.wilaya_id.toString());
  if (params?.search) query.set('search', params.search);

  try {
    const res = await fetch(`${API_BASE}/libraries/?${query.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch libraries');
    const data = await res.json();
    return data.results || data;
  } catch (error) {
    console.error('Error fetching libraries:', error);
    return [];
  }
}

export async function fetchLibrary(identifier: string | number): Promise<Bookstore | null> {
  try {
    const res = await fetch(`${API_BASE}/libraries/${encodeURIComponent(String(identifier))}/`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`Error fetching library ${identifier}:`, error);
    return null;
  }
}

export async function fetchLibraryBooks(
  libraryId: number,
  params?: {
    search?: string;
    category?: string;
    categories?: string[];
    language?: string;
    min_price?: number;
    max_price?: number;
    is_in_stock?: boolean;
    ordering?: string;
    include_unavailable?: boolean;
    page_size?: number;
  },
): Promise<Offer[]> {
  const query = new URLSearchParams({
    bookstore_id: String(libraryId),
    page_size: String(params?.page_size ?? 100),
  });
  if (params?.search) query.set('search', params.search);
  const categoryParam =
    params?.category ||
    (params?.categories?.length ? params.categories.join(',') : undefined);
  if (categoryParam) query.set('category', categoryParam);
  if (params?.language) query.set('language', params.language);
  if (params?.min_price !== undefined) query.set('min_price', String(params.min_price));
  if (params?.max_price !== undefined) query.set('max_price', String(params.max_price));
  if (params?.is_in_stock !== undefined) {
    query.set('is_in_stock', params.is_in_stock ? 'true' : 'false');
  }
  if (params?.ordering) query.set('ordering', params.ordering);
  if (params?.include_unavailable) query.set('include_unavailable', '1');
  try {
    const res = await fetch(`${API_BASE}/books/?${query.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch library books');
    const data = await res.json();
    return data.results || data;
  } catch (error) {
    console.error(`Error fetching books for library ${libraryId}:`, error);
    return [];
  }
}

export interface LibraryProfileInput {
  store_name?: string;
  description?: string;
  address?: string;
  wilaya_id?: number;
  commune_id?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string;
  whatsapp?: string;
  contact_email?: string;
  opening_hours?: string;
  logo_url?: string;
  banner_url?: string;
  verification_document_url?: string;
}

function libraryApiError(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.trim()) return data;
  if (!data || typeof data !== 'object') return fallback;
  const payload = data as Record<string, unknown>;
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail;
  for (const value of Object.values(payload)) {
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value) && value.length) return String(value[0]);
  }
  return fallback;
}

export async function fetchMyLibrary(): Promise<Bookstore | null> {
  try {
    const res = await fetch(`${API_BASE}/libraries/me/`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Error fetching my library:', error);
    return null;
  }
}

export async function createMyLibrary(data: LibraryProfileInput): Promise<Bookstore> {
  const res = await fetch(`${API_BASE}/libraries/me/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  const responseData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(libraryApiError(responseData, 'Impossible de créer la librairie.'));
  }
  return responseData;
}

export async function updateMyLibrary(data: LibraryProfileInput): Promise<Bookstore> {
  const res = await fetch(`${API_BASE}/libraries/me/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  const responseData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(libraryApiError(responseData, 'Impossible de mettre à jour la librairie.'));
  }
  return responseData;
}

export async function fetchLibraryOrders(): Promise<LibraryOrder[]> {
  try {
    const res = await fetch(`${API_BASE}/libraries/me/orders/`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error('Error fetching library orders:', error);
    return [];
  }
}

export async function updateLibraryOrder(
  orderId: number,
  data: {
    status: LibraryOrder['status'];
    tracking_number?: string;
    seller_notes?: string;
  },
): Promise<LibraryOrder> {
  const res = await fetch(`${API_BASE}/libraries/me/orders/${orderId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  const responseData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      libraryApiError(responseData, 'Impossible de mettre à jour la commande.'),
    );
  }
  return responseData;
}

export async function fetchOffers(params?: {
  seller_type?: 'BOOKSTORE' | 'INDIVIDUAL';
  condition?: string;
  wilaya_id?: number;
  bookstore_id?: number;
}): Promise<Offer[]> {
  const query = new URLSearchParams();
  if (params?.seller_type) query.set('seller_type', params.seller_type);
  if (params?.condition) query.set('condition', params.condition);
  if (params?.wilaya_id) query.set('wilaya_id', params.wilaya_id.toString());
  if (params?.bookstore_id) query.set('bookstore_id', params.bookstore_id.toString());

  try {
    const res = await fetch(`${API_BASE}/offers/?${query.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch offers');
    const data = await res.json();
    return data.results || data;
  } catch (error) {
    console.error('Error fetching offers:', error);
    return [];
  }
}

export async function fetchWilayas(): Promise<Wilaya[]> {
  try {
    const res = await fetch(`${API_BASE}/wilayas/`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch wilayas');
    return await res.json();
  } catch (error) {
    console.error('Error fetching wilayas:', error);
    return [];
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_BASE}/categories/`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch categories');
    return await res.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

export async function fetchAuthors(): Promise<Author[]> {
  try {
    const res = await fetch(`${API_BASE}/authors/`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch authors');
    const data = await res.json();
    return data.results || data;
  } catch (error) {
    console.error('Error fetching authors:', error);
    return [];
  }
}

// ----------------- BOOK METADATA API -----------------

export function isIsbnQuery(value: string): boolean {
  const digits = value.replace(/[^0-9Xx]/g, '');
  return digits.length === 10 || digits.length === 13;
}

export async function searchBookMetadata(
  query: string,
  field: 'any' | 'title' | 'author' | 'isbn' | 'publisher' = 'any',
  limit = 10
): Promise<MetadataSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    field,
    limit: String(limit),
  });
  const res = await fetch(`${API_BASE}/catalog/metadata/search/?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Metadata search failed');
  }
  return await res.json();
}

export async function lookupBookByIsbn(isbn: string): Promise<MetadataSearchResult | null> {
  const params = new URLSearchParams({ isbn });
  const res = await fetch(`${API_BASE}/catalog/metadata/isbn/?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('ISBN lookup failed');
  }
  const data = await res.json();
  if (!data?.found) return null;

  // The exact lookup may omit the ISBN that was queried for; keep it so the
  // form can show which edition was selected.
  const digits = isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
  return {
    ...data,
    provider_id: data.provider_id || digits,
    isbn13: data.isbn13 || (digits.length === 13 ? digits : ''),
    isbn10: data.isbn10 || (digits.length === 10 ? digits : ''),
  };
}

// ----------------- CHECKOUT -----------------

export interface CheckoutItemPayload {
  offer_id: number;
  quantity: number;
  expected_price?: number;
}

export interface CheckoutPayload {
  items: CheckoutItemPayload[];
  delivery?: Record<string, string>;
  payment_method?: string;
  delivery_type?: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_wilaya?: number;
  recipient_address?: string;
  notes?: string;
}

export async function createOrder(
  data: CheckoutPayload,
): Promise<{ order: Order; quote: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/checkout/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  const responseData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      libraryApiError(responseData, 'Impossible de finaliser la commande.'),
    );
  }
  return responseData;
}

// ----------------- BUYER PORTAL API -----------------

export async function fetchBuyerOrders(buyerEmail?: string): Promise<Order[]> {
  try {
    const url = buyerEmail
      ? `${API_BASE}/buyer/orders/?buyer_email=${encodeURIComponent(buyerEmail)}`
      : `${API_BASE}/buyer/orders/`;
    const res = await fetch(url, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Error fetching buyer orders:', err);
    return [];
  }
}

export async function fetchBuyerWishlist(userId?: number): Promise<WishlistItem[]> {
  try {
    const url = userId ? `${API_BASE}/buyer/wishlist/?user_id=${userId}` : `${API_BASE}/buyer/wishlist/`;
    const res = await fetch(url, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Error fetching buyer wishlist:', err);
    return [];
  }
}

export async function toggleWishlist(workId: number, userId?: number): Promise<{ saved: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/buyer/wishlist/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ work_id: workId, user_id: userId }),
    });
    if (!res.ok) throw new Error('Failed to toggle wishlist');
    return await res.json();
  } catch (err) {
    console.error('Error toggling wishlist:', err);
    return { saved: false, message: 'Erreur lors de la modification des favoris' };
  }
}

export async function submitSellerReview(data: {
  buyer_id?: number;
  seller_type: 'BOOKSTORE' | 'INDIVIDUAL';
  bookstore_id?: number;
  individual_seller_id?: number;
  rating: number;
  comment: string;
}): Promise<unknown> {
  const res = await fetch(`${API_BASE}/buyer/reviews/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  return await res.json();
}

// ----------------- BOOKSTORE PORTAL API -----------------

export async function fetchBookstoreStats(storeId?: number): Promise<BookstoreStats | null> {
  try {
    const url = storeId ? `${API_BASE}/bookstore/stats/?store_id=${storeId}` : `${API_BASE}/bookstore/stats/`;
    const res = await fetch(url, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Error fetching bookstore stats:', err);
    return null;
  }
}

export async function fetchBookstoreOrders(storeId?: number): Promise<BookstoreOrder[]> {
  try {
    const url = storeId ? `${API_BASE}/bookstore/orders/?store_id=${storeId}` : `${API_BASE}/bookstore/orders/`;
    const res = await fetch(url, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Error fetching bookstore orders:', err);
    return [];
  }
}

export async function updateBookstoreOrderAction(
  orderId: number,
  action: 'CONFIRM' | 'PREPARING' | 'SHIPPED' | 'READY_FOR_PICKUP' | 'CANCEL',
  sellerNotes?: string,
  trackingNumber?: string
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/bookstore/orders/${orderId}/action/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      action,
      seller_notes: sellerNotes,
      tracking_number: trackingNumber,
    }),
  });
  return await res.json();
}

export async function fetchMyBookstore(storeId?: number): Promise<Bookstore | null> {
  try {
    const url = storeId ? `${API_BASE}/bookstore/my-store/?store_id=${storeId}` : `${API_BASE}/bookstore/my-store/`;
    const res = await fetch(url, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Error fetching bookstore profile:', err);
    return null;
  }
}

export async function updateMyBookstore(data: Partial<Bookstore>, storeId?: number): Promise<Bookstore | null> {
  try {
    const url = storeId ? `${API_BASE}/bookstore/my-store/?store_id=${storeId}` : `${API_BASE}/bookstore/my-store/`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Error updating bookstore profile:', err);
    return null;
  }
}

// ----------------- INDIVIDUAL SELLER PORTAL API -----------------

export async function fetchSellerListings(sellerId?: number): Promise<Offer[]> {
  try {
    const url = sellerId ? `${API_BASE}/seller/my-listings/?seller_id=${sellerId}` : `${API_BASE}/seller/my-listings/`;
    const res = await fetch(url, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Error fetching seller listings:', err);
    return [];
  }
}

export async function createSellerListing(data: {
  seller_id?: number;
  title: string;
  author?: string;
  price: number;
  condition: string;
  condition_description?: string;
  photos?: string[];
  has_home_delivery?: boolean;
  has_stop_desk_delivery?: boolean;
}): Promise<unknown> {
  const res = await fetch(`${API_BASE}/seller/create-listing/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  return await res.json();
}

export async function toggleSellerListingStatus(
  offerId: number,
  status: 'ACTIVE' | 'RESERVED' | 'SOLD' | 'PAUSED'
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/seller/listings/${offerId}/status/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status }),
  });
  return await res.json();
}

export async function uploadImage(file: File): Promise<{
  success: boolean;
  url: string;
  relative_url: string;
  filename: string;
}> {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${API_BASE}/upload/image/`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur lors du téléversement de l’image' }));
    throw new Error(err.error || 'Erreur lors du téléversement de l’image');
  }

  return await res.json();
}

export interface CatalogCsvResult {
  success: boolean;
  imported_count?: number;
  bookstore?: string;
  errors?: string[];
}

export async function uploadCatalogCsv(
  file: File,
  bookstoreId: number,
): Promise<CatalogCsvResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bookstore_id', String(bookstoreId));

  const res = await fetch(`${API_BASE}/catalog/upload-csv/`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errors = Array.isArray(data?.errors)
      ? data.errors
      : [data?.error || 'Erreur lors de l’import CSV.'];
    return { success: false, errors, ...data };
  }
  return data;
}

// ----------------- BOOK LISTINGS (LIBRARY + SECOND-HAND) -----------------

export interface BookWritePayload {
  title?: string;
  listing_title?: string;
  description?: string;
  category?: number | null;
  category_id?: number | null;
  category_slug?: string;
  categories?: number[];
  category_ids?: number[];
  author?: string;
  authors?: string[];
  isbn?: string;
  isbn10?: string;
  isbn13?: string;
  publisher?: string;
  publication_year?: number | string | null;
  publication_date?: string;
  edition_title?: string;
  page_count?: number;
  language?: string;
  format?: string;
  translator?: string;
  translators?: string[];
  work_id?: number | null;
  edition_id?: number | null;
  price?: number;
  original_price?: number | null;
  stock_quantity?: number;
  is_in_stock?: boolean;
  condition?: string;
  condition_description?: string;
  regions?: number[];
  photos?: string[];
  cover_image?: string;
  has_store_pickup?: boolean;
  has_home_delivery?: boolean;
  has_stop_desk_delivery?: boolean;
  stop_desk_fee?: number;
  home_delivery_fee?: number;
}

export async function createBook(data: BookWritePayload): Promise<Offer> {
  const res = await fetch(`${API_BASE}/books/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  const responseData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(libraryApiError(responseData, 'Impossible de publier le livre.'));
  }
  return responseData;
}

export async function fetchBook(id: number): Promise<Offer | null> {
  try {
    const res = await fetch(`${API_BASE}/books/${id}/`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`Error fetching book ${id}:`, error);
    return null;
  }
}

export async function updateBook(id: number, data: BookWritePayload): Promise<Offer> {
  const res = await fetch(`${API_BASE}/books/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  const responseData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(libraryApiError(responseData, 'Impossible de mettre à jour le livre.'));
  }
  return responseData;
}

export async function deleteBook(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/books/${id}/`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const responseData = await res.json().catch(() => ({}));
    throw new Error(libraryApiError(responseData, 'Impossible de supprimer le livre.'));
  }
}

export interface PublishListingPayload {
  seller_type: 'BOOKSTORE' | 'INDIVIDUAL';
  bookstore_id?: number;
  seller_id?: number;
  title: string;
  author?: string;
  authors?: string[];
  isbn?: string;
  isbn10?: string;
  isbn13?: string;
  publisher?: string;
  publication_year?: number | string;
  publication_date?: string;
  edition_title?: string;
  page_count?: number;
  language?: string;
  format?: string;
  translator?: string;
  translators?: string[];
  price: number;
  quantity?: number;
  condition?: string;
  condition_description?: string;
  cover_image?: string;
  photos?: string[];
  has_store_pickup?: boolean;
  has_home_delivery?: boolean;
  has_stop_desk_delivery?: boolean;
  stop_desk_fee?: number;
  home_delivery_fee?: number;
}

export async function publishListing(data: PublishListingPayload): Promise<{
  success: boolean;
  offer_id: number;
  work_id: number;
  work_slug: string;
  work_title: string;
  price: number;
  cover_image?: string;
  message?: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/offers/publish/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });

  const responseData = await res.json();
  if (!res.ok) {
    throw new Error(responseData.error || 'Erreur lors de la publication de l’offre');
  }
  return responseData;
}

// ----------------- ADMIN DASHBOARD API -----------------

export async function fetchAdminAnalytics(): Promise<AdminAnalytics | null> {
  try {
    const res = await fetch(`${API_BASE}/admin/analytics/`, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Error fetching admin analytics:', err);
    return null;
  }
}

export async function fetchAdminBookstores(): Promise<Bookstore[]> {
  try {
    const res = await fetch(`${API_BASE}/admin/bookstores/`, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Error fetching admin bookstores:', err);
    return [];
  }
}

export async function verifyBookstore(
  storeId: number,
  action: 'VERIFY' | 'REJECT',
  notes?: string
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/admin/bookstores/${storeId}/verify/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ action, notes }),
  });
  return await res.json();
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  try {
    const res = await fetch(`${API_BASE}/admin/users/`, { cache: 'no-store', headers: authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Error fetching admin users:', err);
    return [];
  }
}

export async function toggleSuspendUser(userId: number): Promise<unknown> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/toggle-suspend/`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return await res.json();
}

// ----------------- MESSAGING -----------------

export interface StartConversationPayload {
  bookstore_id?: number;
  individual_seller_id?: number;
  suborder_id?: number;
  subject?: string;
  body?: string;
  buyer_id?: number;
}

async function messagingError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return libraryApiError(data, fallback);
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE}/messages/conversations/`, {
    cache: 'no-store',
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await messagingError(res, 'Impossible de charger les conversations.'));
  }
  return await res.json();
}

export async function fetchConversation(conversationId: number): Promise<ConversationThread> {
  const res = await fetch(`${API_BASE}/messages/conversations/${conversationId}/`, {
    cache: 'no-store',
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await messagingError(res, 'Impossible de charger la conversation.'));
  }
  return await res.json();
}

export async function startConversation(
  payload: StartConversationPayload,
): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/messages/conversations/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await messagingError(res, 'Impossible de démarrer la conversation.'));
  }
  return await res.json();
}

export async function sendConversationMessage(
  conversationId: number,
  body: string,
): Promise<ConversationMessage> {
  const res = await fetch(`${API_BASE}/messages/conversations/${conversationId}/messages/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    throw new Error(await messagingError(res, "Impossible d'envoyer le message."));
  }
  return await res.json();
}

export async function reportConversationMessage(
  messageId: number,
  reason: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/messages/messages/${messageId}/report/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    throw new Error(await messagingError(res, 'Impossible de signaler ce message.'));
  }
}

export async function fetchUnreadMessageCount(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/messages/unread-count/`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data.unread_count) || 0;
  } catch {
    return 0;
  }
}

// ----------------- NOTIFICATIONS -----------------

export async function fetchNotifications(params?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<NotificationList> {
  const query = new URLSearchParams();
  if (params?.unreadOnly) query.set('unread_only', 'true');
  if (params?.limit) query.set('limit', String(params.limit));

  try {
    const res = await fetch(`${API_BASE}/notifications/?${query.toString()}`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!res.ok) {
      return { count: 0, unread_count: 0, results: [] };
    }
    return await res.json();
  } catch {
    return { count: 0, unread_count: 0, results: [] };
  }
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/notifications/unread-count/`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data.unread_count) || 0;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(notificationId: number): Promise<Notification | null> {
  try {
    const res = await fetch(`${API_BASE}/notifications/${notificationId}/read/`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function markAllNotificationsRead(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/notifications/read-all/`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data.updated) || 0;
  } catch {
    return 0;
  }
}
