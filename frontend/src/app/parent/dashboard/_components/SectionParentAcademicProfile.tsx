'use client'

import { useState, useCallback, useEffect } from 'react'
import { TrendingUp, Users, BookOpen } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import SectionProfilAcademique from '@/features/student/SectionProfilAcademique'
import type { ChildWithStats } from '../_types'

interface Props {
  userId?: string
  initialStudentId?: string
  onNav?: (section: string) => void
}

export default function SectionParentAcademicProfile({ userId, initialStudentId, onNav }: Props) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '')

  const childrenCacheKey = userId ? `parent:children:${userId}` : ''
  const fetchChildren = useCallback(async () => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
    return (res.data ?? []) as ChildWithStats[]
  }, [userId])

  const { data: childrenRaw, loading } = useCachedFetch<ChildWithStats[]>(childrenCacheKey, fetchChildren)
  const childrenList = childrenRaw ?? []

  useEffect(() => {
    if (!selectedStudentId && childrenList.length > 0) {
      setSelectedStudentId(childrenList[0].studentId)
    }
  }, [selectedStudentId, childrenList])

  const currentChild = childrenList.find(c => c.studentId === selectedStudentId) || childrenList[0]

  if (loading && !childrenList.length) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-xs font-semibold text-[var(--text3)]">
        Chargement du profil académique…
      </div>
    )
  }

  if (!childrenList.length) {
    return (
      <div className="p-6 text-center text-xs text-[var(--text3)]">
        Aucun enfant rattaché à votre compte.
      </div>
    )
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-4 sm:space-y-6 max-w-4xl mx-auto" style={{ overflowY: 'auto', height: '100%' }}>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div>
          <div style={sTitle}>Profil Académique & Évolution Temporelle</div>
          <div style={sSub}>Analyse des moyennes par séquence/trimestre, classification des matières et dynamique d&apos;apprentissage</div>
        </div>
      </div>

      {/* Sélecteur d'enfant */}
      {childrenList.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {childrenList.map((child) => {
            const isSel = child.studentId === currentChild?.studentId
            return (
              <button
                key={child.studentId}
                onClick={() => setSelectedStudentId(child.studentId)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  isSel ? 'shadow-sm text-white' : 'hover:bg-[var(--bg2)] text-[var(--text2)]'
                }`}
                style={{
                  background: isSel ? 'linear-gradient(135deg,var(--primary),var(--accent))' : 'var(--surface)',
                  borderColor: isSel ? 'transparent' : 'var(--border)',
                }}
              >
                <Users size={13} />
                <span>{child.prenom} {child.nom}</span>
                <span className="text-[10px] opacity-80">({child.classeNom || '—'})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Affichage du profil académique pour l'enfant sélectionné */}
      {currentChild && (
        <div className="space-y-4">
          <div className="p-3 sm:p-4 rounded-xl border flex items-center justify-between gap-3 bg-[var(--surface)] border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg,var(--primary),var(--accent))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {currentChild.prenom[0]}{currentChild.nom[0]}
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                  {currentChild.prenom} {currentChild.nom}
                </div>
                <div className="text-xs text-[var(--text3)]">
                  Classe : {currentChild.classeNom || '—'} {currentChild.matricule ? `· Matricule : ${currentChild.matricule}` : ''}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNav?.('health-tracking')}
              className="h-8 px-3 rounded-lg text-xs font-bold border flex items-center gap-1.5 cursor-pointer bg-[var(--bg2)] border-[var(--border2)] text-[var(--text2)]"
            >
              <span>Suivi & Note sur 100</span>
            </button>
          </div>

          <SectionProfilAcademique studentId={currentChild.studentId} />
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
