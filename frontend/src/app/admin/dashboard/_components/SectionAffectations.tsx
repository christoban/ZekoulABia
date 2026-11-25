'use client'

import TeachingAssignmentsView from '@/features/affectations/TeachingAssignmentsView'

export default function SectionAffectations({ onToast }: { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  return <TeachingAssignmentsView onToast={onToast} namespace="admin" allowAutoGenerate={false} />
}
