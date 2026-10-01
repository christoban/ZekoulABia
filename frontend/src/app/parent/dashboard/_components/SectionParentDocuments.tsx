'use client'

import { useState, useCallback } from 'react'
import { FileText, CreditCard, Download, Loader2, ShieldCheck, WifiOff, User, CheckCircle2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useT } from '@/lib/i18n'
import type { ChildWithStats } from '../_types'

interface Props {
  childrenList?: ChildWithStats[]
  userId?: string
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function SectionParentDocuments({ childrenList, userId, onToast }: Props) {
  const t = useT('parent')
  const isOnline = useOnlineStatus()
  const [selectedChildIndex, setSelectedChildIndex] = useState(0)
  const [downloading, setDownloading] = useState<'certificat' | 'carte' | null>(null)

  const childrenCacheKey = userId ? `parent:children:${userId}` : 'parent:children:documents'
  const fetchChildrenFn = useCallback(async (): Promise<ChildWithStats[]> => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' })
    const d = await res.json()
    if (!d.success) return []
    return d.data || []
  }, [])
  const { data: cachedChildren } = useCachedFetch<ChildWithStats[]>(
    childrenList ? '' : childrenCacheKey,
    fetchChildrenFn
  )
  const effectiveChildren = childrenList ?? cachedChildren ?? []

  const currentChild = effectiveChildren[selectedChildIndex] ?? null
  const studentId = currentChild?.studentId
  const childName = currentChild ? `${currentChild.prenom}_${currentChild.nom}` : 'eleve'

  const downloadDoc = async (type: 'certificat' | 'carte') => {
    if (!studentId) return
    if (!isOnline) {
      onToast(t('documents.offlineNotice'), 'warning')
      return
    }

    setDownloading(type)
    try {
      const endpoint =
        type === 'certificat'
          ? `/api/v2/students/${studentId}/certificat`
          : `/api/v2/students/${studentId}/carte`

      const res = await fetchApi(endpoint, { credentials: 'include' })
      if (!res.ok) {
        throw new Error('Erreur de téléchargement')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_${childName}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onToast(t('documents.downloadSuccess'), 'success')
    } catch {
      onToast(t('documents.downloadError'), 'error')
    } finally {
      setDownloading(null)
    }
  }

  if (effectiveChildren.length === 0) {
    return (
      <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          {t('documents.title')}
        </div>
        <div
          className="p-8 rounded-2xl border text-center space-y-2 shadow-xs"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <User size={36} className="mx-auto text-[var(--text3)]" />
          <div className="text-sm font-bold text-[var(--text)]">{t('documents.emptyChild')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            {t('documents.title')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
            {t('documents.subtitle')}
          </div>
        </div>

        {/* Sélecteur d'enfant */}
        {effectiveChildren.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {effectiveChildren.map((child, idx) => {
              const isSelected = idx === selectedChildIndex
              return (
                <button
                  key={child.studentId}
                  onClick={() => setSelectedChildIndex(idx)}
                  className={`flex-1 sm:flex-none h-9 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer shadow-xs whitespace-nowrap ${
                    isSelected
                      ? 'text-white border-transparent'
                      : 'text-[var(--text2)] border-[var(--border)] hover:bg-[var(--bg2)]'
                  }`}
                  style={{
                    background: isSelected ? 'var(--sidebar)' : 'var(--surface)',
                  }}
                >
                  <User size={12} className="inline mr-1" />
                  {child.prenom} {child.nom}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Bannière de certification QR Code */}
      <div
        className="p-3 sm:p-3.5 rounded-xl border flex items-center gap-2.5 shadow-2xs"
        style={{
          background: 'var(--green-light)',
          borderColor: 'rgba(16, 185, 129, 0.25)',
          color: 'var(--green)',
        }}
      >
        <ShieldCheck size={18} className="shrink-0" />
        <span className="text-xs font-bold leading-snug">{t('documents.securityBadge')}</span>
      </div>

      {/* Récapitulatif enfant */}
      {currentChild && (
        <div
          className="p-3.5 sm:p-4 rounded-xl border flex items-center justify-between gap-3 shadow-xs"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: 'linear-gradient(135deg,var(--blue),var(--purple))' }}
            >
              {currentChild.prenom[0]}{currentChild.nom[0]}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[var(--text)] truncate">
                {currentChild.prenom} {currentChild.nom}
              </div>
              <div className="text-xs text-[var(--text3)] font-semibold mt-0.5">
                {currentChild.classeNom || 'Classe non assignée'}
              </div>
            </div>
          </div>
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-[var(--green-light)] text-[var(--green)] shrink-0">
            Inscrit actif
          </span>
        </div>
      )}

      {/* Grille des 2 documents officiels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Document 1 : Certificat de scolarité */}
        <div
          className="p-4 sm:p-5 rounded-2xl border flex flex-col justify-between gap-4 shadow-xs"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <FileText size={20} strokeWidth={2} />
            </div>
            <div className="text-sm sm:text-base font-bold text-[var(--text)]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif' }}>
              {t('documents.certificatTitle')}
            </div>
            <div className="text-xs text-[var(--text2)] leading-relaxed font-medium">
              {t('documents.certificatDesc')}
            </div>
          </div>

          <button
            onClick={() => downloadDoc('certificat')}
            disabled={downloading === 'certificat'}
            className="w-full h-10 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-transform active:scale-[0.98] border-none"
            style={{
              background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
              opacity: downloading === 'certificat' ? 0.7 : 1,
            }}
          >
            {downloading === 'certificat' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{t('documents.downloading')}</span>
              </>
            ) : isOnline ? (
              <>
                <Download size={14} strokeWidth={2} />
                <span>{t('documents.downloadPdf')}</span>
              </>
            ) : (
              <>
                <WifiOff size={14} strokeWidth={2} />
                <span>Hors-ligne</span>
              </>
            )}
          </button>
        </div>

        {/* Document 2 : Carte d'identité scolaire */}
        <div
          className="p-4 sm:p-5 rounded-2xl border flex flex-col justify-between gap-4 shadow-xs"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <CreditCard size={20} strokeWidth={2} />
            </div>
            <div className="text-sm sm:text-base font-bold text-[var(--text)]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif' }}>
              {t('documents.carteTitle')}
            </div>
            <div className="text-xs text-[var(--text2)] leading-relaxed font-medium">
              {t('documents.carteDesc')}
            </div>
          </div>

          <button
            onClick={() => downloadDoc('carte')}
            disabled={downloading === 'carte'}
            className="w-full h-10 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-transform active:scale-[0.98] border-none"
            style={{
              background: 'linear-gradient(135deg,var(--purple),var(--accent))',
              opacity: downloading === 'carte' ? 0.7 : 1,
            }}
          >
            {downloading === 'carte' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{t('documents.downloading')}</span>
              </>
            ) : isOnline ? (
              <>
                <Download size={14} strokeWidth={2} />
                <span>{t('documents.downloadPdf')}</span>
              </>
            ) : (
              <>
                <WifiOff size={14} strokeWidth={2} />
                <span>Hors-ligne</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
