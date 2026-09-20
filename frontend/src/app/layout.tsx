import type { Metadata } from 'next'
import { Nunito, Spectral } from 'next/font/google'
import './globals.css'
import { SmoothScrollProvider } from '@/components/SmoothScrollProvider'
import { LanguageProvider } from '@/lib/i18n'
import { NotificationProvider } from '@/hooks/NotificationContext'
import { Providers } from './providers'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-nunito',
  display: 'swap',
})

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-spectral',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ZekoulABia',
  description: 'Plateforme de gestion scolaire multi-établissement',
  manifest: '/manifest.json',
  // Référence directe vers public/ (fichier statique) plutôt que la convention app/icon.png —
  // cette dernière fait générer par Next.js une route dynamique dont le loader webpack casse
  // sur les chemins contenant une apostrophe (ex. "God's Grace" dans le chemin du projet) :
  // "Module parse failed: Unexpected token" au build production (voir next build --webpack).
  icons: {
    icon: '/favicon.png',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ZekoulABia',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${nunito.variable} ${spectral.variable}`} suppressHydrationWarning>
      <body className="font-nunito antialiased" suppressHydrationWarning>
        <Providers><LanguageProvider><NotificationProvider><SmoothScrollProvider>{children}</SmoothScrollProvider></NotificationProvider></LanguageProvider></Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
