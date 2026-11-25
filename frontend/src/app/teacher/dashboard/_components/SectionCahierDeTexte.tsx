'use client'
import { WifiOff, Pencil, ClipboardList } from 'lucide-react'
import type { UserInfo } from '../_types'
import { useT } from '@/lib/i18n'
import { useCahierData } from './cahier/useCahierData'
import CahierSaisieTab from './cahier/CahierSaisieTab'
import CahierHistoriqueTab from './cahier/CahierHistoriqueTab'
import type { CahierTab } from './cahier/types'

interface Props {
  user: UserInfo | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function SectionCahierDeTexte({ user, onToast }: Props) {
  const t = useT('teacher')
  const c = useCahierData({ user, onToast, t })

  const tabBtn = (tabId: CahierTab, label: string, Icon: typeof Pencil) => (
    <button key={tabId} onClick={() => c.setTab(tabId)} style={{
      minHeight: 38, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700,
      fontFamily: 'inherit', cursor: 'pointer', border: 'none',
      background: c.tab === tabId ? 'var(--sidebar)' : 'var(--bg2)',
      color: c.tab === tabId ? 'white' : 'var(--text2)', transition: 'all 0.15s',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}><Icon size={14} strokeWidth={2} />{label}</button>
  )

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5" style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--bg)' }}>
      {!c.isOnline && (
        <div style={{
          background: 'var(--orange-light)', border: '1px solid var(--orange)', borderRadius: 8,
          padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--orange)', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <WifiOff size={15} strokeWidth={2} />
          {t('cahier_de_texte.offline_banner')}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          {t('cahier_de_texte.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginTop: 2 }}>
          {t('cahier_de_texte.subtitle')}
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {tabBtn('saisie', t('cahier_de_texte.tab_new_entry'), Pencil)}
        {tabBtn('historique', t('cahier_de_texte.tab_history'), ClipboardList)}
      </div>

      {c.tab === 'saisie' && (
        <CahierSaisieTab
          isOnline={c.isOnline}
          classes={c.classes}
          subjects={c.subjects}
          chapitres={c.chapitres}
          hasProgramme={c.hasProgramme}
          selectedClass={c.selectedClass}
          selectedSubject={c.selectedSubject}
          selectedChapitre={c.selectedChapitre}
          date={c.date}
          contenu={c.contenu}
          contenuLibre={c.contenuLibre}
          devoirsOn={c.devoirsOn}
          devoirs={c.devoirs}
          saving={c.saving}
          isFormValid={c.isFormValid}
          slotBanner={c.slotBanner}
          scanBanner={c.scanBanner}
          scanning={c.scanning}
          cameraRef={c.cameraRef}
          onClassChange={c.setSelectedClass}
          onSubjectChange={c.setSelectedSubject}
          onChapitreChange={c.setSelectedChapitre}
          onDateChange={c.setDate}
          onContenuChange={c.setContenu}
          onContenuLibreChange={c.setContenuLibre}
          onToggleDevoirs={() => { c.setDevoirsOn(v => !v); if (c.devoirsOn) c.setDevoirs('') }}
          onDevoirsChange={c.setDevoirs}
          onDismissSlotBanner={() => c.setSlotBanner(null)}
          onDismissScanBanner={() => c.setScanBanner(null)}
          onScanClick={c.handleScanClick}
          onScan={c.handleScan}
          onSave={c.handleSave}
          t={t}
        />
      )}

      {c.tab === 'historique' && (
        <CahierHistoriqueTab
          classes={c.classes}
          filterClass={c.filterClass}
          entries={c.entries}
          loadingEntries={c.loadingEntries}
          pendingEntries={c.pendingEntries}
          onFilterClassChange={c.setFilterClass}
          onReload={c.loadEntries}
          t={t}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
