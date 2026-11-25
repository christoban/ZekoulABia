import type { Metadata } from 'next'
import { Nunito, Spectral } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
})

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-spectral',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ZekoulABia — Plateforme scolaire de référence au Cameroun',
  description: 'ZekoulABia centralise la gestion de votre établissement : notes, présences, bulletins, emploi du temps et paiements Mobile Money. Conforme MINESEC.',
  icons: { icon: '/favicon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${nunito.variable} ${spectral.variable}`} suppressHydrationWarning>
      <body className="font-nunito antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
