'use client'

import GrilleHoraireView from '@/features/timetable/GrilleHoraireView'

export default function SectionGrilleHoraire({ onToast }: { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  return <GrilleHoraireView onToast={onToast} namespace="admin" />
}
