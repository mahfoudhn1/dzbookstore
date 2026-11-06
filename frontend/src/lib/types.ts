export interface Wilaya {
  id: number;
  code: string;
  name_ar: string;
  name_fr: string;
  name_en?: string;
  bookstores_count?: number;
  communes?: Commune[];
}

export interface Commune {
  id: number;
  name_ar: string;
  name_fr: string;
  postal_code?: string;
  wilaya_id: number;
}

export interface Author {
  id: number;
  name: string;
  name_ar?: string;
  slug: string;
  nationality: string;
  biography?: string;
  photo_url?: string;
}

export interface Publisher {
  id: number;
  name: string;
  slug: string;
  country: string;
  logo_url?: string;
  website?: string;
}

export interface Category {
  id: number;
  name_fr: string;
  name_ar: string;
  name_en?: string;
  slug: string;
  icon?: string;
}

export interface Edition {
  id: number;
  isbn10?: string;
  isbn13?: string;
  publisher?: Publisher;
  publication_year?: number;
  edition_title?: string;
  format: string;
  language: string;
  page_count?: number;
  cover_image?: string;
}

export interface Bookstore {
  id: number;
  store_name: string;
  slug: string;
  description?: string;
  address: string;
  wilaya_id: number;
  wilaya_name_fr: string;
  wilaya_name_ar?: string;
  wilaya_name_en?: string;
  wilaya_code: string;
  commune_id?: number;
  commune_name_fr?: string;
  commune_name_ar?: string;
  latitude?: number;
  longitude?: number;
  phone: string;
  whatsapp?: string;
  contact_email?: string;
  opening_hours?: string;
  logo_url?: string;
  banner_url?: string;
  is_verified: boolean;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  offers_count: number;
  in_stock_count?: number;
  rating_average?: number | null;
  reviews_count?: number;
}

export interface IndividualSeller {
  id: number;
  display_name: string;
  bio?: string;
  wilaya_id: number;
  wilaya_name_fr: string;
  wilaya_name_ar?: string;
  wilaya_name_en?: string;
  commune_id?: number;
  commune_name_fr?: string;
  commune_name_ar?: string;
  phone: string;
  whatsapp?: string;
  trust_score: number;
  offers_count: number;
}

export interface Offer {
  id: number;
  seller?: number;
  work_id: number;
  work_title: string;
  work_slug: string;
  work_cover?: string;
  edition_id?: number;
  edition_format?: string;
  edition_publisher?: string;
  edition_year?: number;
  edition_isbn13?: string;
  seller_type: 'BOOKSTORE' | 'INDIVIDUAL';
  seller_type_display: string;
  seller_name: string;
  seller_wilaya_name: string;
  seller_wilaya_name_ar?: string;
  seller_wilaya_name_en?: string;
  seller_wilaya_code: string;
  seller_commune_name?: string;
  seller_commune_name_ar?: string;
  bookstore?: Bookstore;
  individual_seller?: IndividualSeller;
  title?: string | null;
  description?: string | null;
  category?: number | null;
  category_name?: string | null;
  category_slug?: string | null;
  categories?: Category[];
  language?: 'ARABIC' | 'FRENCH' | 'ENGLISH' | 'TAMAZIGHT' | 'OTHER';
  language_display?: string;
  price: number;
  original_price?: number;
  condition: 'NEW' | 'LIKE_NEW' | 'VERY_GOOD' | 'GOOD' | 'ACCEPTABLE';
  condition_display: string;
  condition_description?: string;
  photos: string[];
  stock_quantity: number;
  is_in_stock: boolean;
  in_stock: boolean;
  regions: number[];
  quantity: number;
  status: 'ACTIVE' | 'RESERVED' | 'SOLD' | 'PAUSED';
  has_store_pickup: boolean;
  has_home_delivery: boolean;
  has_stop_desk_delivery: boolean;
  home_delivery_fee?: number;
  stop_desk_fee?: number;
  created_at: string;
}

export interface Work {
  id: number;
  title: string;
  original_title?: string;
  slug: string;
  synopsis: string;
  original_language: string;
  cover_image?: string;
  featured: boolean;
  authors: Author[];
  categories: Category[];
  editions?: Edition[];
  offers?: Offer[];
  min_price?: number;
  offers_count?: number;
  bookstores_count?: number;
}

export interface CartItem {
  offer: Offer;
  quantity: number;
}

export interface OrderItem {
  id: number;
  offer: number;
  offer_title: string;
  offer_cover?: string;
  quantity: number;
  unit_price: number;
  seller_type: 'BOOKSTORE' | 'INDIVIDUAL';
  seller_id: string;
  sub_status: string;
}

export interface Order {
  id: number;
  order_number: string;
  buyer: number;
  total_amount: number;
  delivery_fee: number;
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'READY_FOR_PICKUP' | 'DELIVERED' | 'CANCELLED';
  status_display: string;
  payment_method: 'COD' | 'BARIDIMOB' | 'CIB' | 'IN_STORE';
  payment_method_display: string;
  payment_status: 'UNPAID' | 'PENDING_VERIFICATION' | 'PAID' | 'REFUNDED';
  receipt_url?: string;
  delivery_type: 'HOME' | 'STOP_DESK' | 'STORE_PICKUP';
  delivery_type_display: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_wilaya: number;
  recipient_wilaya_name: string;
  recipient_address: string;
  recipient_stop_desk?: string;
  notes?: string;
  seller_notes?: string;
  tracking_number?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface WishlistItem {
  id: number;
  work: number;
  work_title: string;
  work_slug: string;
  work_cover?: string;
  min_price?: number;
  created_at: string;
}

export interface BookstoreStats {
  store_name: string;
  is_verified: boolean;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  total_revenue_dzd: number;
  total_orders: number;
  active_listings: number;
  low_stock_count: number;
}

export interface BookstoreOrderItem {
  title: string;
  quantity: number;
  unit_price: number;
  sub_status: string;
}

export interface BookstoreOrder {
  id: number;
  order_number: string;
  buyer_name: string;
  buyer_phone: string;
  wilaya_name: string;
  address: string;
  delivery_type: string;
  status: string;
  status_display: string;
  total_amount: number;
  seller_notes?: string;
  tracking_number?: string;
  created_at: string;
  items: BookstoreOrderItem[];
}

export interface LibraryOrderItem {
  id: number;
  offer_id: number;
  work_id: number;
  title: string;
  work_slug: string;
  cover_image?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface LibraryOrder {
  id: number;
  suborder_id: number;
  order_number: string;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  internal_status: string;
  status_display: string;
  allowed_statuses: LibraryOrderStatus[];
  buyer_name: string;
  buyer_phone: string;
  wilaya_name: string;
  address: string;
  delivery_type: string;
  delivery_type_display: string;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  tracking_number?: string | null;
  seller_notes?: string | null;
  created_at: string;
  items: LibraryOrderItem[];
}

export type LibraryOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface AdminAnalytics {
  total_gmv_dzd: number;
  total_orders: number;
  total_users: number;
  buyers_count: number;
  bookstores_count: number;
  verified_bookstores_count: number;
  pending_bookstores_count: number;
  individual_sellers_count: number;
  total_active_offers: number;
  covered_wilayas_count: number;
}

export interface MetadataSource {
  provider: string;
  provider_id: string;
  attribution?: string;
}

export interface MetadataSearchResult {
  provider: string;
  provider_id: string;
  work_id?: number;
  edition_id?: number | null;
  title: string;
  subtitle?: string;
  authors: string[];
  translators?: string[];
  publisher?: string;
  published_date?: string;
  publication_year?: number | null;
  language?: string;
  page_count?: number | null;
  isbn10?: string;
  isbn13?: string;
  cover_image?: string;
  description?: string;
  categories?: string[];
  source_url?: string;
  attribution?: string;
  license?: string;
  found_locally?: boolean;
  sources?: MetadataSource[];
}

export interface MetadataProviderStatus {
  status: string;
  message?: string;
  label?: string;
  count?: number;
  attribution?: string;
}

export interface MetadataSearchResponse {
  query: string;
  field: string;
  local_count: number;
  results: MetadataSearchResult[];
  providers: Record<string, MetadataProviderStatus>;
}

export interface ConversationMessage {
  id: number;
  conversation: number;
  sender: number;
  sender_name: string;
  body: string;
  read_at: string | null;
  is_hidden: boolean;
  is_reported: boolean;
  report_reason?: string | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  buyer: number;
  buyer_name?: string;
  bookstore: number | null;
  bookstore_name?: string | null;
  individual_seller: number | null;
  individual_seller_name?: string | null;
  suborder: number | null;
  subject: string;
  last_message_at: string | null;
  last_message: ConversationMessage | null;
  unread_count: number;
  created_at: string;
}

export interface ConversationThread {
  conversation: Conversation;
  messages: ConversationMessage[];
}

export type NotificationType =
  | 'ORDER'
  | 'MESSAGE'
  | 'WISHLIST'
  | 'PRICE'
  | 'LISTING'
  | 'MODERATION'
  | 'SYSTEM';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationList {
  count: number;
  unread_count: number;
  results: Notification[];
}

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  role_display?: string;
  phone?: string;
  address?: string;
  wilaya_name_fr?: string;
  is_suspended: boolean;
  date_joined: string;
}
