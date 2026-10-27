import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import AppProviders from '@/components/chrome/AppProviders';
import ChromeGate from '@/components/chrome/ChromeGate';
import SiteFooter from '@/components/chrome/SiteFooter';
import SiteHeader from '@/components/chrome/SiteHeader';
import ViewAsBanner from '@/components/chrome/ViewAsBanner';
import { I18nProvider } from '@/components/I18nProvider';
import RouteFocus from '@/components/RouteFocus';
import { getT } from '@/lib/i18n';
import { THEME_INIT_SCRIPT, getThemeChoice } from '@/lib/theme';

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://bai7w0jcu7s8e.space.minimax.io';

// Brand kit assets (apps/web/public/brand/kit, README.md "Recommended usage"); never home-made ones.
const KIT = '/brand/kit';
const OG_IMAGE = `${KIT}/04_Social_GitHub/open_graph_light.png`;

export function generateMetadata(): Metadata {
  const { t } = getT();
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    openGraph: {
      title: t('meta.title'),
      description: t('meta.description'),
      type: 'website',
      url: SITE_URL,
      siteName: 'EvolAI',
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: t('meta.ogAlt') }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('meta.title'),
      description: t('meta.description'),
      images: [OG_IMAGE],
    },
    icons: {
      icon: [
        { url: `${KIT}/02_Icons/favicon.ico`, sizes: 'any' },
        { url: `${KIT}/02_Icons/android-chrome-192x192.png`, sizes: '192x192', type: 'image/png' },
      ],
      apple: `${KIT}/02_Icons/apple-touch-icon.png`,
    },
    manifest: `${KIT}/02_Icons/site.webmanifest`,
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = getT();
  const choice = getThemeChoice();
  return (
    // data-theme comes from the cookie; without one the inline script fills it from the system
    // scheme before the first paint (ADR 0034). suppressHydrationWarning covers that attribute.
    <html lang={locale} data-theme={choice ?? undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AppProviders choice={choice}>
          <I18nProvider locale={locale}>
            <a className="skip-link" href="#main">
              {t('common.skipToContent')}
            </a>
            <RouteFocus />
            <ChromeGate header={<SiteHeader />} banner={<ViewAsBanner />} footer={<SiteFooter />}>
              {children}
            </ChromeGate>
          </I18nProvider>
        </AppProviders>
      </body>
    </html>
  );
}
