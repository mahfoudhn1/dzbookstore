# BookstoreDZ — Complete Project Guide

> **Purpose of this file:** hand this document to Claude (or any AI assistant) as the single source of context for the BookstoreDZ project. It describes what the product is, how the code is organized, every feature, every API endpoint, the data model, and the current known gaps. Generated 2026-11-05 from a full read of the codebase.

---

## 1. What the project is

**BookstoreDZ** is an Algerian online **book marketplace** (like a local AbeBooks + used-book market):

- **Two seller types** sell books:
  - **Verified bookstores** (professional sellers, admin-verified with a "registre de commerce" document) — can publish new/used offers and bulk-import inventory via CSV.
  - **Individual sellers** (particuliers) — sell single used copies with photos; gain a public `trust_score` from buyer reviews.
- **Buyers** search a trilingual catalog (French default, Arabic RTL, English), compare **all offers for the same work across sellers** (price/condition/delivery), pick per-seller delivery methods, and check out with **cash on delivery** or **BaridiMob/CCP transfer** (Algerian payment habits).
- One order can span **multiple sellers**: the backend splits it into one `SubOrder` per seller, each confirmed/prepared/shipped independently, with an append-only tracking timeline.
- Geography is Algeria-specific: **58 wilayas** (provinces) + communes, distance search via haversine (no PostGIS), delivery fees are seller-defined flat rates (home delivery / stop-desk relay point / store pickup).
- UI copy and all API error messages are **French**; route slugs are French (`/connexion`, `/recherche`, `/secondhand`, `/vendre`→`/sell`…).

## 2. Repository layout

```
bookstoredz/
├── backend/            # Django 5.2 REST API (Python 3.10, venv inside backend/venv)
│   ├── config/         # settings.py, urls.py, wsgi.py, asgi.py  (the "project" package)
│   ├── accounts/       # User, profiles, auth flow, admin user management
│   ├── geo/            # Wilaya/Commune, haversine distance, seed_algeria command
│   ├── catalog/        # Work/Edition/Author/Publisher/Category/Genre/Language
│   ├── metadata/       # External book-metadata providers (Open Library, Google Books)
│   ├── discovery/      # Search engine (filters, facets, typo tolerance, geo distance)
│   ├── marketplace/    # Offer, checkout, Order/SubOrder lifecycle, reviews, wishlist
│   ├── messaging/      # Buyer↔seller conversations
│   ├── notifications/  # In-app + email notifications, Offer signals
│   ├── backoffice/     # Admin moderation queue + platform analytics (views only)
│   └── common/         # text normalization (Arabic/French), test factories (no AppConfig)
└── frontend/           # Next.js 16 App Router storefront + dashboards
    └── src/
        ├── app/        # pages (French route slugs), dashboard/{buyer,bookstore,seller,admin}
        ├── components/ # Navbar, BookCard, OfferComparison, auth/*, ui/Ornaments (zellige)
        └── lib/        # api.ts, auth-api.ts, store (Redux), cart-context, i18n, wilayas.ts
```

Note: an older create-next-app scaffold used to live at the repo root and was moved into `frontend/` (the root-level deletions in `git status` reflect that migration).

## 3. Tech stack

| Layer | Technology |
|---|---|
| Backend | **Django 5.2.18** + **DRF 3.18.3**, django-filter 26.1, django-cors-headers 4.9, psycopg2-binary (PostgreSQL ≥ 15), Pillow, requests. **No requirements.txt** — packages live in `backend/venv` (Python 3.10). |
| Auth | **DRF TokenAuthentication** (`Authorization: Token <key>`) + SessionAuthentication. **No JWT library.** Single-use `AuthActionToken` rows for email verification / password reset. |
| Database | PostgreSQL, configured **hardcoded in `config/settings.py`** (db `bookstoredz`, localhost:5432). The `DATABASE_URL` env var exists in `.env` but settings.py **ignores it**. |
| Frontend | **Next.js 16.4.3** (App Router, Turbopack), **React 19.3**, TypeScript strict, **Tailwind CSS v4** (CSS-first config in `globals.css` `@theme`), Redux Toolkit + react-redux (auth only), lucide-react icons, clsx + tailwind-merge. No axios — hand-rolled `fetch` wrappers. |
| i18n | Custom, cookie-based, no library. Locales **fr (default) / ar (RTL) / en**; translations are flat JSON maps **keyed by the French sentence** (`ar.json`, `en.json`, 737 keys; no `fr.json` needed). |
| ⚠️ Next.js version | `frontend/AGENTS.md` warns this Next.js version has breaking changes vs. training data — **read `frontend/node_modules/next/dist/docs/` before writing frontend code.** |

## 4. Running the project

```bash
# Backend (from backend/, using the bundled venv)
python manage.py migrate
python manage.py seed_algeria        # seeds 58 wilayas + 15 communes + demo catalog/users/offers
python manage.py runserver           # API at http://127.0.0.1:8000, Django admin at /admin/

# Frontend (from frontend/)
npm install
npm run dev                          # http://localhost:3000
```

- Frontend env var: `NEXT_PUBLIC_API_URL` (in `frontend/.env.local`), default fallback `http://127.0.0.1:8000/api`.
- Backend env vars (root `.env`, loaded via os.environ): see §12.
- Demo login: with `ALLOW_ANONYMOUS_DEMO=true`, `POST /api/auth/login/` with **empty email+password** and `role_emulation` in {`BUYER`,`BOOKSTORE`,`INDIVIDUAL`,`ADMIN`} logs in the first user of that role.

## 5. Core domain model

The central chain is **Work → Edition → Offer**:

- **Work** — the abstract literary work ("Nedjma"). Title, synopsis, cover, M2M authors (through `WorkContributor` with roles: AUTHOR, CO_AUTHOR, TRANSLATOR, EDITOR, ILLUSTRATOR, NARRATOR, PREFACE), categories (self-referencing tree), genres, `normalized_title` (search index column).
- **Edition** — one printing of a work. isbn10/isbn13, publisher, year, format (Poche/Broché/Relié), language (+ ref), page_count, translators (through `EditionContributor`).
- **Offer** (marketplace app) — a seller's listing of an edition. `seller_type` BOOKSTORE|INDIVIDUAL, `price` (DZD), `original_price`, `condition` (NEW, LIKE_NEW, VERY_GOOD, GOOD, ACCEPTABLE) + description + `photos` (JSON list of URLs), `quantity`, `status` (ACTIVE, RESERVED, SOLD, PAUSED), view/sold counters, `last_availability_confirmed_at`, and a delivery block: `has_store_pickup` (fee 0), `has_home_delivery` + `home_delivery_fee` (model default 600, publish flow default 550), `has_stop_desk_delivery` + `stop_desk_fee` (default 350).

**People**

- `accounts.User` (AbstractUser, **login by email**, `USERNAME_FIELD='email'`): `role` ∈ BUYER | BOOKSTORE_SELLER | INDIVIDUAL_SELLER | ADMIN (ADMIN cannot self-register), `phone`, `avatar_url`, `address`, wilaya/commune FKs, `is_suspended`, `email_verified`. Helpers: `is_admin_user` (role ADMIN or superuser), `account_status`.
- `BookstoreProfile` (OneToOne): store_name, slug, address (required), wilaya (PROTECT), lat/lng, opening_hours, logo/banner, whatsapp, **verification** (`is_verified`, `verification_status` PENDING|VERIFIED|REJECTED, document URL, notes).
- `IndividualSellerProfile` (OneToOne): display_name, bio, wilaya, phone, `trust_score` (float 5.0, recomputed from reviews), lat/lng guarded by **`show_exact_location` (default False — a privacy opt-in; otherwise coordinates are never exposed** and the seller is excluded from distance sorts).
- `AuthActionToken`: single-use opaque token (24h verification / 2h reset); issuing a new one invalidates previous unused ones of the same purpose.

**Marketplace persistence** (there is **no Cart model — the cart is client-side**):

- `Order` — buyer, `order_number` (`DZ-YYYYMMDD-` + 6 hex chars), grand totals, `status`, `payment_method` (CASH_ON_DELIVERY, BARIDIMOB_TRANSFER, IN_STORE, DIRECT_ARRANGEMENT, ONLINE_CARD "à venir"), `payment_status` (PENDING, RECEIPT_UPLOADED, VERIFIED, PAID, FAILED — **data-only today, no endpoint mutates it**), `delivery_type` (HOME_DELIVERY, STOP_DESK, STORE_PICKUP), recipient block (name/phone/wilaya FK/address/stop-desk name), tracking number, cancellation_reason.
- `SubOrder` — one seller's slice: own status + timestamps (availability_confirmed_at, shipped_at, delivered_at, cancelled_at), subtotal, delivery_fee, carrier, tracking, seller_notes.
- `OrderItem` — snapshot rows (offer PROTECT, unit_price at purchase time, denormalized seller info + `sub_status` kept in sync).
- `OrderEvent` — append-only timeline (label, status, note, actor) powering tracking.
- `Review` — one per delivered SubOrder (OneToOne), rating 1–5, moderation flags (is_hidden, reported_at/reason/by).
- `Wishlist` (user×work, unique), `FavoriteBookstore`, `FavoriteSeller`, `SavedSearch` (label + JSON `query_params` + `notify` flag).

**Supporting**

- `geo.Wilaya` (explicit PK = official number 1–58, code "01"–"58", name_fr/name_ar), `geo.Commune` (wilaya FK, postal_code; only 15 sample communes seeded for big cities).
- `metadata.ProviderCache` (24h TTL response cache), `metadata.ExternalIdentifier` (import provenance/idempotency), `metadata.SearchLog` (search telemetry used by admin analytics).
- `messaging.Conversation` (buyer × one seller × optional SubOrder, unique per tuple), `Message` (read receipts = `read_at` timestamp), `ConversationReport`.
- `notifications.Notification` (types: ORDER, MESSAGE, WISHLIST, PRICE, LISTING, MODERATION, SYSTEM; `data` JSON; `read_at`; `email_sent`).

## 6. Roles & permission model

| Role | Can do |
|---|---|
| Anonymous | Browse everything public (works, editions, offers, bookstores, search, wilayas). With `ALLOW_ANONYMOUS_DEMO=true`, additionally: demo login by role, demo-impersonation on many "AllowAny" endpoints via `buyer_id`/`store_id`/`seller_id` params, and raw dev tokens echoed in auth responses. |
| BUYER | Checkout, order detail/tracking/cancel, wishlist/favorites/saved searches, one review per delivered suborder, report reviews, messaging. |
| BOOKSTORE_SELLER | Store portal (stats, order actions, storefront edit), listing management, CSV import, catalog writes **only if verified**. |
| INDIVIDUAL_SELLER | Create/manage own listings, seller suborders feed. |
| ADMIN / staff | Everything + `/api/admin/*`: analytics, bookstore verification, user suspension, moderation. |

Permission classes (`accounts/permissions.py`):

- `IsAdminOrDemo` — staff/ADMIN, **or anyone when `ALLOW_ANONYMOUS_DEMO`**. Used by all admin endpoints.
- `IsCatalogEditorOrDemo` — safe methods always allowed; writes for staff, ADMIN, or a **verified** BOOKSTORE_SELLER; demo mode opens writes too.
- `IsOwnerOrAdmin` — object-level owner (obj.user / obj.buyer) or staff; demo fallback.

**Default DRF settings** (`config/settings.py`): default permission `AllowAny`, auth = Token+Session, `PageNumberPagination` with `PAGE_SIZE=24` (ViewSets only; function views hand-roll), filter backends DjangoFilterBackend + SearchFilter + OrderingFilter. CORS: **allow all origins + credentials**.

## 7. Authentication flow

1. **Register** `POST /api/auth/register/` — body: email, password (≥8), name, role, phone, wilaya_id (default 16 = Alger), address, `store_name` (bookstore role). Creates User (username auto-generated from email), per-role profile inside a transaction, issues DRF token immediately (logged-in before email verified), schedules verification email via `transaction.on_commit`. 503 if geo base not seeded.
2. **Email verification** — email links `{FRONTEND_URL}/verifier-email?token=…`. `POST /api/auth/verify-email/` consumes the token atomically, sets `email_verified=True`. Resend: `POST /api/auth/resend-verification/` (invalidates old tokens).
3. **Login** `POST /api/auth/login/` → `{token, user}`. Suspended/inactive → 403. Demo role login (see §4).
4. **Me** `GET|PUT /api/auth/me/` — profile read/update (names, phone, address, avatar, wilaya/commune). Email & role are read-only.
5. **Password reset** — `POST /api/auth/password-reset/request/` always answers 200 (anti-enumeration) with a 2h token email to `{FRONTEND_URL}/reinitialiser-mot-de-passe?token=…`; `POST /api/auth/password-reset/confirm/` consumes the token, sets the password and **deletes all DRF tokens** (kills sessions), sends a "password changed" notice email.
6. **Logout** `POST /api/auth/logout/` — deletes all the user's DRF tokens.

Emails (`accounts/emails.py`) are plain-text French, `fail_silently=True`, console backend by default. Auth emails are **not** gated by `SEND_NOTIFICATION_EMAILS` (only marketplace/notification emails are).

## 8. API reference (base: `http://127.0.0.1:8000/api`)

### Catalog & metadata (public reads; writes need IsCatalogEditorOrDemo)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/works/`, `/api/works/{slug}/` | GET / POST / PUT / DELETE | ViewSet by slug. List serializer adds `min_price`, `max_price`, `offers_count`, `bookstores_count` from ACTIVE offers. Create returns `{created: bool, work}` — 201 new / 200 deduped-reuse. Search: title/synopsis/authors/ISBN; filters: featured, original_language, categories__slug, genres__slug. |
| `/api/editions/`, `/api/editions/{id}/` | GET / POST… | Filters: work_id, publisher_id, language, format, publication_year. Same `{created, edition}` dedupe pattern (ISBN-13 must be 13 digits, ISBN-10 10 chars). |
| `/api/authors/`, `/api/publishers/`, `/api/categories/`, `/api/genres/`, `/api/languages/` | GET | ReadOnly ViewSets, lookup by slug (languages by code). Categories/genres/languages unpaginated. |
| `/api/catalog/lookup/` | GET | Legacy ISBN lookup (delegates to metadata service). |
| `/api/catalog/upload-csv/` | POST | Multipart bookstore bulk import — see §9.5. |
| `/api/catalog/metadata/search/?q=&field=&limit=` | GET | Local catalog first, then external providers. `field` ∈ any/title/author/isbn/publisher. |
| `/api/catalog/metadata/isbn/?isbn=` | GET | Local edition first, then providers. |
| `/api/catalog/metadata/import/` | POST | Import a provider record into Work+Edition (idempotent via ExternalIdentifier). |
| `/api/catalog/metadata/sources/` | GET | Provider catalog with attribution/licenses. |
| `/api/upload/image/` | POST | **AllowAny** cover-image upload. Key `image`/`file`, ≤10 MB, extensions jpg/jpeg/png/webp/gif, saved to `MEDIA_ROOT/covers/<uuid><ext>`. Returns `{url, relative_url, filename}`. |

### Discovery / search

| Endpoint | Method | Notes |
|---|---|---|
| `/api/search/offers/` | GET | The main offer search — full filter contract in §9.3. Response `{count, page, page_size, results, facets, meta}`. |
| `/api/search/works/` | GET | Same filters but groups offers per work (≤30 offers embedded per work). |
| `/api/offers/`, `/api/offers/{id}/` | GET | OfferViewSet reuses `apply_offer_filters`; retrieve atomically increments `views_count`. |

### Marketplace — checkout, orders

| Endpoint | Method | Notes |
|---|---|---|
| `/api/checkout/quote/` | POST | Body `{items: [{offer_id, quantity, expected_price?}], delivery: {…per-seller choices}}` → validated quote (400 + `issues` if invalid). |
| `/api/checkout/` | POST | Places the order → 201 `{order, quote}`; 409 on CheckoutError. Requires phone (falls back to buyer profile). |
| `/api/delivery/options/?offer_id=` | GET | `{options: [{method, fee}]}` for an offer. |
| `/api/orders/{id}/` | GET | `{order, role}` (role = buyer/seller/admin). IsAuthenticated. |
| `/api/orders/{id}/tracking/` | GET | `{order_number, status, tracking_number, events[]}`. |
| `/api/orders/{id}/transition/` | POST | `{status, suborder_id?, tracking_number?, carrier?, note?, reason?}` — state machine in §9.4. Buyers may only CANCEL. 409 + `allowed_next` on invalid. |
| `/api/orders/{id}/cancel/` | POST | Cancels all still-cancellable suborders (PENDING_CONFIRMATION/CONFIRMED), restores stock. |
| `/api/buyer/orders/` | GET | Buyer's orders (demo fallback `?buyer_email=`). |

### Buyer extras

| Endpoint | Method | Notes |
|---|---|---|
| `/api/buyer/wishlist/` | GET/POST | POST `{work_id}` **toggles** → `{saved: bool}`. |
| `/api/buyer/favorites/bookstores/` | GET/POST | POST `{bookstore_id}` toggle. |
| `/api/buyer/favorites/sellers/` | GET/POST | POST `{seller_id}` toggle (individual sellers). |
| `/api/buyer/saved-searches/` | GET/POST | Create/list; DELETE `/api/buyer/saved-searches/{id}/`. Powers listing alerts. |
| `/api/buyer/reviews/` | POST | `{suborder_id?, rating 1–5, comment}` — only after DELIVERED, once; recalcs seller trust_score. |
| `/api/buyer/reviews/{id}/report/` | POST | `{reason}` → flags review, notifies staff (in-app). |

### Seller portals

| Endpoint | Method | Notes |
|---|---|---|
| `/api/offers/publish/` | POST | Universal listing creation (bookstore or individual). Creates/ dedupes Work+Edition, defaults condition NEW (bookstore) / VERY_GOOD (individual), delivery flags, fees. 201 `{success, offer_id, work_slug, …}`. |
| `/api/seller/create-listing/` | POST | Individual-seller variant of publish. |
| `/api/seller/my-listings/` | GET | Seller's offers (demo fallback `?seller_id=`). |
| `/api/seller/listings/{id}/status/` | POST | Set status ACTIVE/RESERVED/SOLD/PAUSED (owner or staff). |
| `/api/seller/listings/{id}/confirm-availability/` | POST | Stamps `last_availability_confirmed_at`. |
| `/api/seller/suborders/` | GET | Seller's suborders + order context + `allowed_next`. |
| `/api/bookstore/my-store/` | GET/PUT | Storefront read/edit; setting `verification_document_url` resets verification to PENDING. |
| `/api/bookstore/stats/` | GET | Revenue (total/delivered), orders, active listings, low stock (qty ≤ 2), top 5 books, rating avg, pending suborders. |
| `/api/bookstore/orders/` | GET | Orders containing this store's items (flat list). |
| `/api/bookstore/orders/{id}/action/` | POST | `{action: CONFIRM|PREPARING|SHIPPED|READY_FOR_PICKUP|DELIVERED|CANCEL, tracking_number?, seller_notes?}` → transition_suborder. |

### Messaging

| Endpoint | Method | Notes |
|---|---|---|
| `/api/messages/conversations/` | GET/POST | List own threads / create one. POST target: `bookstore_id` or `individual_seller_id` or `suborder_id` (suborder path validates the requester is buyer or seller of it). Threads dedupe per buyer×seller×suborder. Sellers initiating must pass `buyer_id`. |
| `/api/messages/conversations/{id}/` | GET | Participant-only (404 outsiders). **Opening a thread bulk-marks the other party's messages read** (this is the read-receipt mechanism). |
| `/api/messages/conversations/{id}/messages/` | POST | Send message (≤5000 chars), updates `last_message_at`, notifies the other party. |
| `/api/messages/messages/{id}/report/` | POST | `{reason}` → flags message + creates ConversationReport + notifies staff. |
| `/api/messages/unread-count/` | GET | `{unread_count}` across all threads. |

### Notifications

| Endpoint | Method | Notes |
|---|---|---|
| `/api/notifications/` | GET | `?unread_only=1&type=ORDER&limit=` (limit clamp 1–100, default 30) → `{count, unread_count, results}`. |
| `/api/notifications/{id}/read/` | POST | Mark one read (idempotent). |
| `/api/notifications/read-all/` | POST | `{updated: n}`. |
| `/api/notifications/unread-count/` | GET | `{unread_count}`. |

### Geo

| Endpoint | Method | Notes |
|---|---|---|
| `/api/wilayas/` | GET | All 58, unpaginated, nested communes + `bookstores_count`. |
| `/api/communes/` | GET | Filter `?wilaya_id=`. |
| `/api/geo/nearby-bookstores/?lat=&lng=&radius_km=&limit=` | GET | Haversine over bookstore coordinates; radius default 50 (0.5–2000), limit default 30 (1–100). **Bookstores only — individual sellers never appear here** (privacy). |

### Admin / backoffice (permission `IsAdminOrDemo`)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/admin/analytics/` | GET | GMV, order/user/bookstore counts, active offers, covered wilayas. (Used by the admin dashboard.) |
| `/api/admin/overview/` | GET | Bigger payload: completed revenue, popular books (from OrderItems), popular authors, popular searches (SearchLog), geographic distribution, open suborders, reported content counts. |
| `/api/admin/bookstores/` | GET | All bookstore profiles. |
| `/api/admin/bookstores/{id}/verify/` | POST | `{action: VERIFY|REJECT, notes?}` → sets is_verified + verification_status. |
| `/api/admin/users/` | GET | All users (unpaginated). |
| `/api/admin/users/{id}/toggle-suspend/` | POST | Toggles `is_suspended`. |
| `/api/admin/moderation/` | GET | Queue: reported reviews, reported messages, unresolved conversation reports (max 50 each). |
| `/api/admin/moderation/reviews/{id}/` | POST | `{action: HIDE|DISMISS}`. |
| `/api/admin/moderation/messages/{id}/` | POST | `{action: HIDE|DISMISS}`. |
| `/api/admin/moderation/conversations/{id}/` | POST | Resolve conversation report. |

Also: Django admin at `/admin/` (CustomUserAdmin with a "Profil Algérie" section, BookstoreProfile, IndividualSellerProfile, catalog models with EditionInline, Offer/Order/Review, Wilaya/Commune).

## 9. Core business logic

### 9.1 Catalog deduplication (`catalog/services.py`)
- Text normalization (`common/text.py`): lowercase, strip Arabic diacritics/harakat + Latin accents, fold alef/ya/ta-marbuta variants, Arabic-Indic digits → Latin, punctuation collapse. Every Work/Author stores a `normalized_*` column.
- `create_work` — dedupe by normalized title **plus author-name overlap** (title-only matching would collapse distinct works sharing a title). Unknown category/genre slugs silently skipped.
- `create_edition` — dedupe by ISBN13 → ISBN10 → (work + publisher/language/year/format, conservative). On match it **backfills missing fields** on the existing edition rather than duplicating.
- Slugs are uniquified with `-2`, `-3`… suffixes.

### 9.2 External metadata (`metadata/`)
- Providers: **Open Library** (no key, rate 90/min) and **Google Books** (optional `GOOGLE_BOOKS_API_KEY`, 60/min). Sliding-window rate limiting via Django cache; HTTP failures map to typed `ProviderUnavailable` codes.
- Search: local catalog results first (`found_locally`); external providers queried only if local < limit; results deduped across providers (ISBN or title+author) keeping a `sources` provenance list; responses cached 24h in `ProviderCache`.
- Import is **idempotent**: `ExternalIdentifier(provider, identifier)` already existing → returns existing work/edition (`existing: true`) instead of duplicating.

### 9.3 Search & discovery (`discovery/search.py`)
- **Not** Postgres FTS/trigram — ORM `icontains` on normalized columns + Python-side typo tolerance.
- One filter contract shared by `/api/search/offers/`, `/api/search/works/` and `/api/offers/`: `q`, `isbn`, `title`, `author`, `publisher`, `category`, `genre`, `language`, `wilaya_id`, `commune_id`, `min_price`, `max_price`, `condition` (comma list), `seller_type`, `bookstore_id`, `individual_seller_id`, `in_stock`, `pickup`/`home_delivery`/`stop_desk`, `status` (default ACTIVE; `include_unavailable=1` to see SOLD etc.), and geo `lat`+`lng`+`radius_km` (annotates `distance_km` via pure-SQL haversine; individual-seller coordinates used **only when `show_exact_location=True`**).
- Sort aliases: `price_asc`, `price_desc`, `newest`, `popular` (units_sold → views), `nearest` (distance then price).
- Query variants (`common/text.py`): folded query + **Latin→Arabic transliteration** (kh→خ, ou→و…) + definite-article stripping (ال, el/al) — so "Nedjma", "ندجمة" and misspellings all hit.
- **Typo fallback**: only when the strict query returns 0 results — scans ≤800 works, difflib similarity (threshold 0.74), sets `meta.typo_fallback=true` + up to 5 `suggestions`.
- Response includes computed **facets** (seller_types, conditions, languages, top-15 wilayas, price_range) and logs the query to `SearchLog`.
- Manual pagination: `page`, `page_size` (default 24, max 60).

### 9.4 Checkout & order lifecycle (`marketplace/checkout.py`)
- **Quote** (`build_quote`): validates every line against the DB (offer exists & ACTIVE, quantity in stock, optional `expected_price` must match within 0.01 → else "Le prix a changé…"), resolves the delivery method per seller (must be enabled on the offer), groups lines **per seller**. One delivery fee per seller (the **max** among that seller's lines). Everything recomputed server-side; client prices never trusted.
- **Placement** (`place_order`, atomic): locks offer rows `select_for_update`, creates Order + one SubOrder per seller + OrderItems (price snapshot) + initial OrderEvents, **decrements stock (0 → status SOLD)**, increments `units_sold`, notifies each seller and the buyer (ORDER type).
- **State machine** (`ALLOWED_TRANSITIONS`):

```
PENDING_CONFIRMATION → CONFIRMED | CANCELLED
CONFIRMED            → PREPARING | CANCELLED
PREPARING            → SHIPPED | READY_FOR_PICKUP | CANCELLED
SHIPPED              → DELIVERED
READY_FOR_PICKUP     → DELIVERED | CANCELLED
DELIVERED / CANCELLED → (terminal)
```

- `transition_suborder` stamps timestamps, appends an OrderEvent with a French label, bulk-syncs OrderItem.sub_status, **restores stock on CANCELLED**, recomputes the parent Order status from its suborders (all delivered → DELIVERED, any shipped → SHIPPED, …), and notifies the buyer. All transitions route through this one function (from `/api/orders/*/transition/`, `/api/bookstore/orders/*/action/`, and cancel). Invalid → 409 with `{current_status, allowed}`.
- `cancel_order` — only PENDING_CONFIRMATION/CONFIRMED suborders are cancellable; a multi-seller order can be **partially cancelled**.

### 9.5 CSV bulk import (`POST /api/catalog/upload-csv/`)
Bookstore bulk inventory: multipart `file` (+ `bookstore_id`, demo fallback = first store). Columns: `isbn, title, author, price, quantity, condition` (condition column parsed but **ignored — offers always NEW**; format Broché, language Français). Reuses create_work/create_edition so stores share catalog records; upserts Offer keyed on (work, bookstore, seller_type). Per-row errors don't abort the import; response `{imported_count, errors[]}`.

### 9.6 Reviews & trust
One review per delivered SubOrder (server-verified). Submitting recalculates the **individual seller's** cached `trust_score` (avg of non-hidden ratings). Bookstores use `BookstoreProfileSerializer.rating_average` computed at read time.

### 9.7 Notifications & signals (`notifications/`)
- `notify(user, type, title, message, data, email=True)` — persists in-app; email copy gated by `SEND_NOTIFICATION_EMAILS` (default true) and **fail-silent by design** ("email must never block an order").
- **Signals watch only `marketplace.Offer`** (pre_save snapshot + post_save via `transaction.on_commit`):
  - new ACTIVE offer with stock → wishlist owners (WISHLIST) + matching saved searches (LISTING);
  - restock (qty 0→>0) → wishlist owners;
  - **price drop only** → wishlist owners (PRICE).
- Direct calls elsewhere: order created (buyer + each seller), suborder transitions (buyer) — all ORDER; new message (MESSAGE); reported content → staff (MODERATION, in-app only); review hidden → author (MODERATION). **Verification/reset emails do NOT go through this app** (accounts sends its own).

### 9.8 Geo (`geo/`)
`haversine_expression` builds the great-circle formula in pure ORM/SQL on float columns — **no PostGIS required**. `seed_algeria` seeds all 58 wilayas (incl. the 10 post-2019 southern ones), 15 sample communes, plus a full demo dataset: 5 categories, 5 publishers (Barzakh, Casbah, ENAG…), 5 authors (Kateb Yacine, Yasmina Khadra…), canonical works/editions, 4 verified bookstores with coordinates, 3 individual sellers, offers.

## 10. Frontend guide

### 10.1 Route map (App Router; French slugs)

| Route | Type | Who | What |
|---|---|---|---|
| `/` | Server (force-dynamic) | public | Homepage: hero + search, featured works, categories, bookstores, new releases, secondhand teaser, clickable SVG Algeria map → `/recherche?wilaya_id=` |
| `/recherche` | Server | public | Search: `?q=&category=&wilaya_id=&seller_type=&condition=&sort=` — URL-state facets (no client filtering), offer-intersection filtering, all results rendered (no pagination UI) |
| `/books/[slug]` | Server | public | Book detail: buy box (cheapest offer), edition facts, synopsis, editions table, **OfferComparison** (tabs by seller type, per-offer condition/photos/delivery fees, AddToCart + ContactSeller), related works |
| `/bookstores`, `/bookstores/[slug]` | Server | public | Directory with wilaya/search GET-form; storefront page with contact (tel/WhatsApp), hours, inventory grid |
| `/secondhand` | Server | public | Used-book market: INDIVIDUAL offers with condition/wilaya filters, trust score, ContactSellerButton |
| `/sell` | Client | sellers | Listing creation: seller-type picker; bookstore CSV import mode; ISBN/metadata autofill via metadata search; **see gap G2 below** |
| `/cart` | Client | buyers | Multi-seller cart: per-seller groups, per-group delivery method (pickup free / stop-desk 350 / home 550), totals, COD vs BaridiMob form — **see gap G1 below** |
| `/connexion`, `/inscription` | Client | guests | Login (redirects to role dashboard or `?next=`); registration with role picker + wilaya + store_name for bookstores |
| `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`, `/verifier-email` | Client | guests | Auth email flows reading `?token=` |
| `/dashboard/{buyer,bookstore,seller,admin}` | Client | per role | See 10.4. Layout wraps children in RequireAuth + EmailVerificationBanner. |
| `/not-found`, `/loading` | — | — | Editorial 404; skeleton loading page. |

### 10.2 API client & auth state
- `lib/api.ts` — `API_BASE = NEXT_PUBLIC_API_URL || http://127.0.0.1:8000/api`; `authHeaders()` attaches `Authorization: Token <…>` read from **localStorage key `bookstoredz.auth.token`**. List helpers catch errors and return empty arrays; mutations throw French errors parsed from DRF responses. Pagination convention: `data.results || data`.
- `lib/auth-api.ts` — typed auth calls + `ApiError`; maps DRF field errors to French messages.
- Redux Toolkit slice `auth` (only slice): `user`, `token`, `initialized`, `pendingAction`, `error/notice`, demo token echoes. Thunks: login, register, **bootstrapSession** (stored token → `/auth/me/`, clears on 401/403), logout, updateProfile, verifyEmail, resendVerification, requestPasswordReset, resetPassword. Only the token is persisted — the user is always re-fetched.
- Guards: `auth-routes.ts` (`DASHBOARD_PATH` per role; staff/ADMIN → admin dashboard; `canAccessDashboard`), `RequireAuth` (spinner → redirect to `/connexion?next=…` or own dashboard), dashboard layout maps URL segment → allowed roles. `EmailVerificationBanner` shows when `!user.email_verified` (with dev "Lien de test" shortcut).

### 10.3 Cart (client-side, no backend)
React Context (`cart-context.tsx`), persisted to **localStorage `bookstoredz.cart.v1`**; quantity clamped to stock. Cart page groups lines per seller, computes delivery per group (fees: max of lines, fallbacks 350/550), grand total.

### 10.4 Dashboards
- **Buyer** — tabs Orders (tracking stepper, Yalidine tracking link, review modal → `buyer/reviews/`), Wishlist (toggle → `buyer/wishlist/`), Profile (PUT `/auth/me/`).
- **Bookstore** — KPI cards from `bookstore/stats/`; tabs Orders (status-conditional action buttons → `bookstore/orders/{id}/action/`, tracking-number modal for shipping), Storefront (edit form → PUT `bookstore/my-store/`), Inventory (offers table, low-stock badges, CTAs to `/sell`).
- **Seller (individual)** — listings list with status switcher (ACTIVE/RESERVED/SOLD → `seller/listings/{id}/status/`); create-listing form → `seller/create-listing/`.
- **Admin** — KPIs from `admin/analytics/`; tabs Analytics (user-type bars, average basket), Bookstores (verify/reject with notes → `admin/bookstores/{id}/verify/`), Users (search, suspend/reactivate → `admin/users/{id}/toggle-suspend/`).

### 10.5 i18n & design
- Cookie-based locale (`bookstoredz.locale`, 1 year): server components read it via `next/headers`; `LanguageSwitcher` sets it client-side, updates `<html lang/dir>` and calls `router.refresh()`. `ar` is RTL (Tailwind mirrors + Amiri/Noto Kufi Arabic fonts).
- Translation = `messages[locale][frenchKey] ?? frenchKey` — French copy is written inline in JSX and doubles as the key; ar.json/en.json hold 737 translated keys.
- Tailwind v4 theme in `globals.css`: ivory/parchment/terracotta/sea-blue palette, Fraunces + Manrope + Arabic fonts, zellige (Moorish star) SVG ornament utilities (`.zellige-lattice`, `ArchFrame`…), `.skeleton`, fade-up animations, reduced-motion handling. Storefront = editorial style; dashboards = denser "app" style.

## 11. Environment variables

| Var | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend `.env` | ⚠️ present but **not read** by settings.py (DB is hardcoded there) |
| `FRONTEND_URL` | backend | Base for verification/reset email links (default http://localhost:3000) |
| `EMAIL_BACKEND`, `DEFAULT_FROM_EMAIL`, `EMAIL_HOST*` | backend | Console backend by default; SMTP for production |
| `SEND_NOTIFICATION_EMAILS` | backend | Gate marketplace/notification emails (default true) |
| `ALLOW_ANONYMOUS_DEMO` | backend | Demo mode — **defaults to True while DEBUG**; must be false in production |
| `METADATA_PROVIDERS` | backend | Provider priority (default `open_library,google_books`) |
| `GOOGLE_BOOKS_API_KEY`, `METADATA_HTTP_TIMEOUT` | backend | Google Books key (optional), HTTP timeout 5s |
| `NEXT_PUBLIC_API_URL` | frontend `.env.local` | API base URL |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | root `.env` | Present but **unused** (no NextAuth in the code) |

## 12. Current state — known gaps & TODOs

These are important for anyone (human or AI) modifying the project:

1. **G1 — Checkout is simulated on the frontend.** The cart page's submit only sets state + clears the cart; it never calls `/api/checkout/` (the full backend flow exists and is tested). Order lifecycle is only visible in dashboards for backend-created orders.
2. **G2 — `/sell` manual submit is local-only.** `publishListing()` (`/api/offers/publish/`) and `uploadImage()` exist in `lib/api.ts` but have **no caller**; the sell page shows a mock success screen. The CSV path bypasses `NEXT_PUBLIC_API_URL` with a hardcoded `http://127.0.0.1:8000/api/catalog/upload-csv/` and hardcoded `bookstore_id: '1'`.
3. `toggleSuspendUser()` in `lib/api.ts` is the only admin mutation that **omits the Authorization header**.
4. `payment_status` / `receipt_url` (BaridiMob receipt flow) have **no endpoints** yet — data-only fields.
5. Search telemetry (`SearchLog`) is written but there is **no rate limiting/throttling anywhere** in the API.
6. Messaging list endpoints are unpaginated and serializers have N+1 patterns (last message / unread count per conversation).
7. i18n: ar/en complete; French copy inline as keys; a few wilaya selectors are hardcoded to 8 options (sell page) while others use the full 58.
8. `NewsletterForm` is a fake submit (no API).
9. Demo mode (`ALLOW_ANONYMOUS_DEMO` defaults on in DEBUG) intentionally weakens auth: role-login, impersonation params, raw tokens in responses, open admin/catalog writes. **Never enable in production.**
10. Production-readiness debt: `SECRET_KEY` hardcoded, `DEBUG=True`, `ALLOWED_HOSTS=['*']`, `CORS_ALLOW_ALL_ORIGINS=True`, DB credentials hardcoded in `settings.py` (value intentionally not reproduced in this doc), media served only when DEBUG.

## 13. Testing

- Per-app test suites: `accounts/tests.py`, `catalog/tests.py`, `discovery/tests.py`, `marketplace/tests.py`, `messaging/tests.py`, `notifications/tests.py`, `backoffice/tests.py` (DRF `APIClient`).
- Shared factories in `common/testing.py`: `make_geo/make_user/make_bookstore/make_individual_seller/make_work/make_edition/make_offer/token_for/authenticate` (Token header helper). Tests run with `ALLOW_ANONYMOUS_DEMO=True, SEND_NOTIFICATION_EMAILS=False` via overrides; notification tests force `transaction.on_commit` callbacks.
- Run: `python manage.py test` (from `backend/`).

## 14. Conventions

- **All user-facing strings are French** (API errors included) — keep new ones French, and add ar/en translations to `frontend/src/lib/i18n/locales/*.json` keyed by the exact French sentence.
- Money is DZD floats rounded to 2 decimals (`formatPrice` renders `fr-DZ` + "DA").
- IDs by slug in public APIs (works, authors, bookstores, categories…); by pk elsewhere.
- Serializer "detail" payloads embed sellers with wilaya/commune names; `OfferSerializer` exposes computed `is_available`, `delivery_options`, `distance_km`.
- New backend endpoints: function-based `@api_view` for portals/actions, ViewSets for resource CRUD; explicit `permission_classes` even when AllowAny.
- Before writing **frontend** code, consult `frontend/node_modules/next/dist/docs/` (this Next.js version deviates from training data — see `frontend/AGENTS.md`).
