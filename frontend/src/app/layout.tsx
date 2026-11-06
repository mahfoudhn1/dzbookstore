import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope, Amiri, Noto_Kufi_Arabic } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ReduxProvider } from '@/lib/store/provider';
import { CartProvider } from '@/lib/cart-context';
import { getT } from '@/lib/i18n/server';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { localeDir } from '@/lib/i18n/config';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const amiri = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-amiri',
  display: 'swap',
});

const notoKufi = Noto_Kufi_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-kufi',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Bookstore.dz — La librairie ouverte d’Algérie',
    template: '%s · Bookstore.dz',
  },
  description:
    "Trouvez n'importe quel livre en Algérie. Comparez les prix des librairies indépendantes vérifiées et des livres d'occasion proposés par des lecteurs, dans les 58 wilayas.",
  applicationName: 'Bookstore.dz',
  keywords: [
    'livres Algérie',
    'librairie Alger',
    'livres occasion Algérie',
    'littérature algérienne',
    'bookstore dz',
  ],
  openGraph: {
    title: 'Bookstore.dz — La librairie ouverte d’Algérie',
    description:
      'Le catalogue vivant du livre en Algérie : librairies indépendantes, éditions nationales et marché de l’occasion.',
    locale: 'fr_DZ',
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#0e3444',
  colorScheme: 'light',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, t } = await getT();

  return (
    <html
      lang={locale}
      dir={localeDir(locale)}
      data-scroll-behavior="smooth"
      className={`${fraunces.variable} ${manrope.variable} ${amiri.variable} ${notoKufi.variable} scroll-smooth`}
    >
      {/*
        Browser extensions (Grammarly, ColorZilla, etc.) add attributes such as
        data-gr-ext-installed and cz-shortcut-listen to <body> before React
        hydrates. Suppress the attribute mismatch for this element only; real
        hydration errors elsewhere are still reported.
      */}
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col bg-ivory text-ink antialiased"
      >
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-sea focus:text-ivory focus:px-4 focus:py-2 focus:text-sm"
        >
          {t('Aller au contenu')}
        </a>
        <I18nProvider initialLocale={locale}>
          <ReduxProvider>
            <CartProvider>
              <Navbar />
              <main id="contenu" className="flex-1">
                {children}
              </main>
              <Footer />
            </CartProvider>
          </ReduxProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
