'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Search,
  ShoppingBag,
  Store,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/lib/store/hooks';
import {
  logout,
  selectAuthInitialized,
  selectUser,
} from '@/lib/store/authSlice';
import { ROLE_LABEL, dashboardPathForRole } from '@/lib/auth-routes';
import { useCart } from '@/lib/cart-context';
import { fetchUnreadMessageCount } from '@/lib/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Wordmark, BrandMark } from '@/components/Brand';
import { SearchBar } from '@/components/SearchBar';
import { MessagesLink } from '@/components/MessagesLink';
import { NotificationsBell } from '@/components/NotificationsBell';
import { cn, initials } from '@/lib/utils';
import { ZelligeStar } from '@/components/ui/Ornaments';

const NAV = [
  { href: '/recherche', label: 'Explorer' },
  { href: '/libraries', label: 'Librairies' },
  { href: '/secondhand', label: 'Occasion' },
  { href: '/#auteurs', label: 'Auteurs' },
  { href: '/#nouveautes', label: 'Nouveautés' },
];

const SECTIONS: [string, string][] = [
  ['Littérature algérienne', 'litterature-algerienne'],
  ['Histoire & Révolution', 'histoire-et-revolution'],
  ['Pensée & Philosophie', 'pensee-et-philosophie'],
  ['Romans & Fictions', 'romans-et-fictions'],
  ['Scolaire & Universitaire', 'scolaire-universitaire'],
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { t } = useI18n();
  const user = useAppSelector(selectUser);
  const initialized = useAppSelector(selectAuthInitialized);
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Unread badge for the drawer's messages tile. Only fetched while the drawer
  // is open, so a closed menu costs nothing.
  useEffect(() => {
    if (!user || !menuOpen) return;
    let active = true;
    fetchUnreadMessageCount().then((value) => {
      if (active) setUnreadMessages(value);
    });
    return () => {
      active = false;
    };
  }, [user, menuOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMenuOpen(false);
      setAccountOpen(false);
      setMobileSearchOpen(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href.startsWith('/#')) return false;
    return pathname.startsWith(href);
  };

  const goToDashboard = (href: string) => {
    setAccountOpen(false);
    setMenuOpen(false);
    router.push(href);
  };

  const handleLogout = async () => {
    setAccountOpen(false);
    setMenuOpen(false);
    await dispatch(logout());
    router.push('/');
  };

  const firstName = user?.first_name?.trim();
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
    user?.username ||
    firstName ||
    t('Lecteur·rice');
  const displayInitials = user ? initials(displayName) : '';
  const roleLabel = user ? t(ROLE_LABEL[user.role]) : t('Lecteur');
  const dashboardHref = user
    ? dashboardPathForRole(user.role, user.is_staff || user.is_superuser)
    : '/dashboard/buyer';

  return (
    <>
      <header className="sticky top-0 z-50">
        {/* Trust ribbon — the only saturated blue band in the chrome */}
        <div className="hidden bg-sea text-ivory/80 md:block">
          <div className="mx-auto flex h-8 max-w-[1440px] items-center justify-between px-6 text-[9px] font-medium uppercase tracking-[0.14em] lg:px-10">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2">
                <span className="h-1 w-1 bg-brass-light" />
                {t("Livraison dans les 58 wilayas")}{' '}</span>
              <span className="text-ivory/25">/</span>
              <span>{t("Paiement à la livraison")}</span>
              <span className="text-ivory/25">/</span>
              <span className="hidden lg:inline">{t("Librairies vérifiées")}</span>
            </div>
            <div className="flex items-center gap-5">
              <span className="hidden normal-case tracking-normal text-ivory/55 lg:inline">
                {t("La librairie ouverte d’Algérie")}{' '}</span>
              <span className="font-kufi text-[10px] normal-case tracking-[0.08em] text-brass-light" dir="rtl">
                الجزائر تقرأ
              </span>
            </div>
          </div>
        </div>

        <div className="border-b border-line bg-ivory/95 backdrop-blur-md">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="flex h-[68px] items-center gap-5 lg:h-[76px] lg:gap-8">
              <Wordmark compact className="shrink-0" />

              <nav className="hidden items-center gap-6 lg:flex xl:gap-7" aria-label={t("Navigation principale")}>
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative py-2 text-[10.5px] font-semibold uppercase tracking-[0.13em] transition-colors',
                      isActive(item.href) ? 'text-sea' : 'text-ink-soft/80 hover:text-clay',
                    )}
                  >
                    {t(item.label)}
                    <span
                      className={cn(
                        'absolute -bottom-[1px] left-0 h-px w-full origin-left scale-x-0 bg-clay transition-transform duration-300',
                        isActive(item.href) && 'scale-x-100',
                      )}
                    />
                  </Link>
                ))}
              </nav>

              <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
                <SearchBar variant="compact" className="hidden w-[220px] xl:block" />

                <button
                  type="button"
                  onClick={() => setMobileSearchOpen((value) => !value)}
                  aria-label={t("Ouvrir la recherche")}
                  className="flex h-9 w-9 items-center justify-center text-ink-soft transition-colors hover:text-clay xl:hidden"
                >
                  <Search className="h-[17px] w-[17px]" />
                </button>

                <LanguageSwitcher className="hidden sm:flex" />

                <MessagesLink />
                <NotificationsBell />

                <div className="relative hidden sm:block">
                  {user ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setAccountOpen((value) => !value)}
                        aria-expanded={accountOpen}
                        aria-label={t("Mon compte")}
                        className="flex h-9 items-center gap-1.5 px-1 text-ink-soft transition-colors hover:text-clay"
                      >
                        <User className="h-[17px] w-[17px]" />
                        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.1em] xl:inline">
                          {firstName || roleLabel}
                        </span>
                        <ChevronDown className="hidden h-3 w-3 text-muted xl:block" />
                      </button>

                      {accountOpen && (
                        <>
                          <button
                            type="button"
                            aria-label={t("Fermer le menu")}
                            onClick={() => setAccountOpen(false)}
                            className="fixed inset-0 z-40 cursor-default bg-sea-deep/10"
                          />
                          <div className="absolute end-0 top-[calc(100%+14px)] z-50 w-[288px] border border-line bg-parchment p-2 shadow-[0_30px_70px_-30px_rgba(10,38,50,0.45)]">
                            <div className="border-b border-line/80 px-3 py-2.5">
                              <p className="text-[9px] uppercase tracking-label text-muted">{t("Connecté comme")}</p>
                              <p className="mt-1 font-display text-lg leading-none text-ink">
                                {firstName || 'Lecteur·rice'}
                              </p>
                              <p className="mt-1 truncate text-[10px] text-muted">{user.email}</p>
                              <p className="mt-1.5 inline-flex border border-line px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-ink-soft">
                                {roleLabel}
                              </p>
                            </div>
                            <div className="py-1.5">
                              <button
                                type="button"
                                onClick={() => goToDashboard(dashboardHref)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-ink-soft transition-colors hover:bg-ivory-deep hover:text-sea"
                              >
                                <LayoutDashboard className="h-3.5 w-3.5" />
                                {t("Mon espace")}{' '}</button>
                              <Link
                                href="/messages"
                                onClick={() => setAccountOpen(false)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-ink-soft transition-colors hover:bg-ivory-deep hover:text-sea"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                {t("Mes messages")}{' '}</Link>
                              <Link
                                href={user.bookstore_profile ? '/dashboard/library' : '/dashboard/library-setup'}
                                onClick={() => setAccountOpen(false)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-ink-soft transition-colors hover:bg-ivory-deep hover:text-sea"
                              >
                                <Store className="h-3.5 w-3.5" />
                                {user.bookstore_profile ? t("Ma librairie") : t("Ouvrir une librairie")}{' '}</Link>
                              {!user.email_verified ? (
                                <Link
                                  href="/verifier-email"
                                  onClick={() => setAccountOpen(false)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-clay transition-colors hover:bg-ivory-deep"
                                >
                                  <UserPlus className="h-3.5 w-3.5" />
                                  {t("Vérifier mon email")}{' '}</Link>
                              ) : null}
                            </div>
                            <div className="border-t border-line/80 px-3 py-2.5">
                              <Link
                                href="/sell"
                                onClick={() => setAccountOpen(false)}
                                className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-clay"
                              >
                                <Plus className="h-3.5 w-3.5" /> {t("Mettre un livre en vente")}{' '}</Link>
                            </div>
                            <div className="border-t border-line/80 px-3 py-2.5">
                              <button
                                type="button"
                                onClick={handleLogout}
                                className="flex w-full items-center gap-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-clay"
                              >
                                <LogOut className="h-3.5 w-3.5" /> {t("Se déconnecter")}{' '}</button>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  ) : initialized ? (
                    <div className="flex items-center gap-2">
                      <Link
                        href="/connexion"
                        className="flex h-9 items-center px-2 text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:text-clay"
                      >
                        {t("Connexion")}{' '}</Link>
                      <Link
                        href="/inscription"
                        className="flex h-9 items-center border border-sea/25 px-3 text-[9.5px] font-bold uppercase tracking-[0.12em] text-sea transition-colors hover:border-sea hover:bg-sea/5"
                      >
                        {t("S’inscrire")}{' '}</Link>
                    </div>
                  ) : (
                    <span className="flex h-9 w-9" aria-hidden="true" />
                  )}
                </div>

                <Link
                  href="/cart"
                  aria-label={count > 0 ? `${t("Panier")} (${count})` : t("Panier")}
                  className="relative flex h-9 w-9 items-center justify-center text-ink-soft transition-colors hover:text-clay"
                >
                  <ShoppingBag className="h-[18px] w-[18px]" />
                  {count > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[8px] font-bold text-ivory">
                      {count}
                    </span>
                  )}
                </Link>

                <Link
                  href="/sell"
                  className="ms-1 hidden h-9 items-center gap-1.5 bg-clay px-4 text-[9.5px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-clay-deep sm:flex"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("Vendre")}{' '}</Link>

                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  aria-label={t("Ouvrir le menu")}
                  aria-expanded={menuOpen}
                  className="ms-0.5 flex h-9 w-9 items-center justify-center text-ink transition-colors hover:text-clay lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Mobile search stays visible: search is the primary gesture. */}
            <div className="pb-3 lg:hidden">
              {mobileSearchOpen ? (
                <SearchBar
                  variant="large"
                  suggestions={[
                    { label: t('Kateb Yacine'), href: '/recherche?q=Kateb%20Yacine' },
                    { label: t('Littérature algérienne'), href: '/recherche?category=litterature-algerienne' },
                    { label: t('Occasion'), href: '/secondhand' },
                  ]}
                />
              ) : (
                <SearchBar variant="compact" />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile / tablet drawer */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[70] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t("Menu principal")}
        >
          <div
            className="absolute inset-0 animate-drawer-fade bg-sea-deep/45 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 end-0 flex w-full max-w-[420px] animate-drawer-panel flex-col bg-ivory shadow-[0_0_80px_-20px_rgba(10,38,50,0.6)]">
            {/* Header — pinned so the close control is always reachable */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5"
              >
                <BrandMark className="h-9 w-9 text-sea" />
                <div>
                  <p className="font-display text-lg leading-none text-ink">{t("Bookstore.dz")}</p>
                  <p className="mt-1 font-kufi text-[8px] tracking-[0.16em] text-muted" dir="rtl">
                    المكتبة المفتوحة
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t("Fermer le menu")}
                className="flex h-9 w-9 items-center justify-center border border-line text-ink transition-colors hover:border-clay hover:text-clay"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* Signed-in account block — first thing in the drawer, because
                  a logged-in reader opens this menu to reach their own space. */}
              {user && (
                <div className="border-b border-line bg-parchment/70 px-5 py-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brass/40 bg-sea font-display text-[13px] tracking-[0.02em] text-ivory">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        displayInitials
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[15px] leading-tight text-ink">
                        {displayName}
                      </p>
                      <p className="mt-0.5 truncate text-[10.5px] text-muted">{user.email}</p>
                    </div>
                    <span className="shrink-0 border border-line bg-ivory px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-ink-soft">
                      {roleLabel}
                    </span>
                  </div>

                  {!user.email_verified && (
                    <Link
                      href="/verifier-email"
                      onClick={() => setMenuOpen(false)}
                      className="mt-3 flex items-center gap-2 border border-clay/30 bg-clay/[0.06] px-3 py-2 text-[10.5px] text-clay transition-colors hover:bg-clay/10"
                    >
                      <UserPlus className="h-3.5 w-3.5 shrink-0" />
                      {t("Vérifier mon email")}
                    </Link>
                  )}

                  <Link
                    href={dashboardHref}
                    onClick={() => setMenuOpen(false)}
                    className="mt-3 flex h-10 items-center justify-between gap-2 bg-sea px-3.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-sea-deep"
                  >
                    <span className="flex items-center gap-2">
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      {t("Mon espace")}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Link
                      href="/messages"
                      onClick={() => setMenuOpen(false)}
                      className="flex h-10 items-center gap-2 border border-line bg-ivory px-3 text-[10.5px] text-ink-soft transition-colors hover:border-sea/40 hover:text-sea"
                    >
                      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t("Mes messages")}</span>
                      {unreadMessages > 0 && (
                        <span className="ms-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-emerald-dz px-1 text-[8px] font-bold text-ivory">
                          {unreadMessages > 9 ? '9+' : unreadMessages}
                        </span>
                      )}
                    </Link>
                    <Link
                      href={user.bookstore_profile ? '/dashboard/library' : '/dashboard/library-setup'}
                      onClick={() => setMenuOpen(false)}
                      className="flex h-10 items-center gap-2 border border-line bg-ivory px-3 text-[10.5px] text-ink-soft transition-colors hover:border-sea/40 hover:text-sea"
                    >
                      <Store className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {user.bookstore_profile ? t("Ma librairie") : t("Ouvrir une librairie")}
                      </span>
                    </Link>
                  </div>
                </div>
              )}

              <div className="px-5 pt-5">
                <SearchBar variant="compact" />
              </div>

              <nav className="px-5 pb-8 pt-6" aria-label={t("Navigation mobile")}>
                <p className="mb-3 text-[9px] font-semibold uppercase tracking-label text-muted">
                  {t("Explorer")}
                </p>
                <ul className="border-t border-line/80">
                  {NAV.map((item, index) => (
                    <li key={item.href} className="border-b border-line/80">
                      <Link
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="group flex items-center justify-between gap-3 py-4"
                      >
                        <span className="flex items-baseline gap-4">
                          <span className="font-display text-[11px] text-brass">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="font-display text-[1.55rem] leading-none tracking-[-0.02em] text-ink transition-colors group-hover:text-sea">
                            {t(item.label)}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-clay/70 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ul>

                <p className="mb-3 mt-8 text-[9px] font-semibold uppercase tracking-label text-muted">
                  {t("Rayons")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SECTIONS.map(([label, slug]) => (
                    <Link
                      key={slug}
                      href={`/recherche?category=${slug}`}
                      onClick={() => setMenuOpen(false)}
                      className="border border-line px-3 py-2 text-[10.5px] text-ink-soft transition-colors hover:border-sea/40 hover:text-sea"
                    >
                      {t(label)}
                    </Link>
                  ))}
                </div>

                <p className="mb-3 mt-8 text-[9px] font-semibold uppercase tracking-label text-muted">
                  {t("Langue")}
                </p>
                <LanguageSwitcher variant="segmented" />

                <div className="mt-8 grid grid-cols-2 gap-2 border-t border-line/80 pt-6">
                  <Link
                    href="/sell"
                    onClick={() => setMenuOpen(false)}
                    className="flex h-11 items-center justify-center gap-1.5 bg-clay text-[9.5px] font-bold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-clay-deep"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("Vendre un livre")}
                  </Link>
                  <Link
                    href="/cart"
                    onClick={() => setMenuOpen(false)}
                    className="flex h-11 items-center justify-center gap-1.5 border border-line text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-sea/40 hover:text-sea"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    {t("Panier")}
                    {count > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[8px] font-bold text-ivory">
                        {count}
                      </span>
                    )}
                  </Link>
                </div>

                {user ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-5 flex w-full items-center justify-center gap-2 border border-line/80 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:border-clay/40 hover:text-clay"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {t("Se déconnecter")}
                  </button>
                ) : (
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <Link
                      href="/connexion"
                      onClick={() => setMenuOpen(false)}
                      className="flex h-11 items-center justify-center gap-1.5 border border-line text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:border-sea/40 hover:text-sea"
                    >
                      <User className="h-3.5 w-3.5" />
                      {t("Se connecter")}
                    </Link>
                    <Link
                      href="/inscription"
                      onClick={() => setMenuOpen(false)}
                      className="flex h-11 items-center justify-center gap-1.5 border border-sea/25 text-[9.5px] font-bold uppercase tracking-[0.12em] text-sea transition-colors hover:border-sea hover:bg-sea/5"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {t("Créer un compte")}
                    </Link>
                  </div>
                )}
              </nav>
            </div>

            {/* Footer band — pinned */}
            <div className="shrink-0 border-t border-line bg-sea px-5 py-4 text-ivory">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-kufi text-[10px] tracking-[0.08em]" dir="rtl">
                  <ZelligeStar className="h-3.5 w-3.5 text-brass-light" />
                  الجزائر تقرأ
                </span>
                <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-ivory/55">
                  <MapPin className="h-3 w-3 text-brass-light" />
                  {t("58 wilayas")}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
