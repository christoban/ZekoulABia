'use client'

import { ScrollText, Package, User, BookOpen } from 'lucide-react'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'
import BulletinModalLight from '@/components/bulletin/BulletinModalLight'
import { useParentGrades } from './grades/useParentGrades'
import ContinuousGradesTab from './grades/ContinuousGradesTab'
import BulletinsTab from './grades/BulletinsTab'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
}

function CacheBadge({ cachedAt }: { cachedAt: number | null }) {
  const t = useT('common')
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div
      style={{
        background: 'var(--amber-light)',
        border: '1px solid var(--amber)',
        borderRadius: 8,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--amber)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
      }}
    >
      <Package size={13} strokeWidth={2} />
      <span>{t('cacheBadge', { date })}</span>
    </div>
  )
}

export default function SectionParentGrades({ onToast, userId }: Props) {
  const t = useT('parent')
  const {
    isOnline,
    selectedChildIndex,
    setSelectedChildIndex,
    activeTab,
    setActiveTab,
    downloading,
    selectedBulletin,
    setSelectedBulletin,
    schoolInfo,
    sequences,
    selectedSequenceId,
    setSelectedSequenceId,
    loading,
    error,
    fromCache,
    cachedAt,
    refetch,
    children,
    selectedName,
    filteredBulletins,
    continuousGrades,
    continuousAverage,
    seqLoading,
    downloadPdf,
  } = useParentGrades({ onToast, userId })

  if (loading) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5 flex items-center justify-center h-full">
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{t('loading')}</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (error) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5 h-full overflow-y-auto">
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button
            onClick={refetch}
            style={{
              padding: '6px 13px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              background: 'var(--surface)',
              color: 'var(--text2)',
              border: '1.5px solid var(--border2)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-4 h-full overflow-y-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            {t('grades.title')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
            {t('grades.subtitle')}
          </div>
        </div>

        {/* Sélecteur d'enfant */}
        {children.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {children.map((c, i) => {
              const isSelected = selectedChildIndex === i
              return (
                <button
                  key={c.studentId}
                  type="button"
                  onClick={() => setSelectedChildIndex(i)}
                  className={`flex-1 sm:flex-none min-w-[100px] h-9 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer shadow-xs whitespace-nowrap ${
                    isSelected ? 'text-white border-transparent' : 'text-[var(--text2)] border-[var(--border)] hover:bg-[var(--bg2)]'
                  }`}
                  style={{
                    background: isSelected ? 'var(--sidebar)' : 'var(--surface)',
                  }}
                >
                  <User size={12} className="inline mr-1" />
                  {c.prenom} {c.nom}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      {/* Onglets : Évaluations continues vs Bulletins officiels */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] w-fit">
        <button
          onClick={() => setActiveTab('continuous')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border-none flex items-center gap-1.5 ${
            activeTab === 'continuous'
              ? 'bg-[var(--primary)] text-white shadow-2xs'
              : 'bg-transparent text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <BookOpen size={13} />
          <span>{t('continuousGrades.title')}</span>
        </button>
        <button
          onClick={() => setActiveTab('bulletins')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border-none flex items-center gap-1.5 ${
            activeTab === 'bulletins'
              ? 'bg-[var(--primary)] text-white shadow-2xs'
              : 'bg-transparent text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <ScrollText size={13} />
          <span>Bulletins officiels ({filteredBulletins.length})</span>
        </button>
      </div>

      {activeTab === 'continuous' && (
        <ContinuousGradesTab
          sequences={sequences}
          selectedSequenceId={selectedSequenceId}
          onSelectSequence={setSelectedSequenceId}
          continuousAverage={continuousAverage}
          continuousGrades={continuousGrades}
          seqLoading={seqLoading}
        />
      )}

      {activeTab === 'bulletins' && (
        <BulletinsTab
          bulletins={filteredBulletins}
          selectedName={selectedName}
          isOnline={isOnline}
          downloading={downloading}
          onSelectBulletin={(b) => {
            const child = children[selectedChildIndex]
            const studentName = child ? `${child.prenom} ${child.nom}`.trim() : 'Élève'
            setSelectedBulletin({
              ...b,
              studentName,
              schoolName: schoolInfo?.name,
              schoolLogoUrl: schoolInfo?.logoUrl,
            })
          }}
          onDownloadPdf={downloadPdf}
        />
      )}

      <BulletinModalLight bulletin={selectedBulletin} onClose={() => setSelectedBulletin(null)} />
    </div>
  )
}
