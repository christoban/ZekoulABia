import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vérification officielle — ZekoulABia',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children
}

