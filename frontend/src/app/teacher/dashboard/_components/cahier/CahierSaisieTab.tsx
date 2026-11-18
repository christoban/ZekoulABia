'use client'
import type { ChangeEvent, RefObject } from 'react'
import { Calendar, AlertTriangle, Loader2, Camera, Save, WifiOff, Check } from 'lucide-react'
import { SEL, LBL, AREA, type Chapitre, type Classe, type Subject, type TranslateFn } from './types'

interface Props {
  isOnline: boolean
  classes: Classe[]
  subjects: Subject[]
  chapitres: Chapitre[]
  hasProgramme: boolean | null
  selectedClass: string
  selectedSubject: string
  selectedChapitre: string
  date: string
  contenu: string
  contenuLibre: string
  devoirsOn: boolean
  devoirs: string
  saving: boolean
  isFormValid: boolean
  slotBanner: string | null
  scanBanner: string | null
  scanning: boolean
  cameraRef: RefObject<HTMLInputElement | null>
  onClassChange: (v: string) => void
  onSubjectChange: (v: string) => void
  onChapitreChange: (v: string) => void
  onDateChange: (v: string) => void
  onContenuChange: (v: string) => void
  onContenuLibreChange: (v: string) => void
  onToggleDevoirs: () => void
  onDevoirsChange: (v: string) => void
  onDismissSlotBanner: () => void
  onDismissScanBanner: () => void
  onScanClick: () => void
  onScan: (e: ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
  t: TranslateFn
}

export default function CahierSaisieTab({
  isOnline,
  classes,
  subjects,
  chapitres,
  hasProgramme,
  selectedClass,
  selectedSubject,
  selectedChapitre,
  date,
  contenu,
  contenuLibre,
  devoirsOn,
  devoirs,
  saving,
  isFormValid,
  slotBanner,
  scanBanner,
  scanning,
  cameraRef,
  onClassChange,
  onSubjectChange,
  onChapitreChange,
  onDateChange,
  onContenuChange,
  onContenuLibreChange,
  onToggleDevoirs,
  onDevoirsChange,
  onDismissSlotBanner,
  onDismissScanBanner,
  onScanClick,
  onScan,
  onSave,
  t,
}: Props) {
  return (
    <div className="w-full max-w-xl">
      {slotBanner && (
        <div style={{
          background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 8,
          padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--green)', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><Calendar size={14} strokeWidth={2} /></span>
          <span style={{ flex: 1 }}>{slotBanner}</span>
          <button onClick={onDismissSlotBanner} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {scanBanner && (
        <div style={{
          background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8,
          padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--amber)', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><AlertTriangle size={14} strokeWidth={2} /></span>
          <span style={{ flex: 1 }}>{scanBanner}</span>
          <button onClick={onDismissScanBanner} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber)', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label style={LBL}>{t('cahier_de_texte.class_label')}</label>
            <select value={selectedClass} onChange={e => onClassChange(e.target.value)} style={SEL}>
              <option value="">{t('cahier_de_texte.class_placeholder')}</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label style={LBL}>{t('cahier_de_texte.subject_label')}</label>
            <select value={selectedSubject} onChange={e => onSubjectChange(e.target.value)}
              style={{ ...SEL, opacity: !selectedClass ? 0.5 : 1 }} disabled={!selectedClass}>
              <option value="">{t('cahier_de_texte.subject_placeholder')}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {selectedSubject && hasProgramme !== null && (
          hasProgramme ? (
            <div>
              <label style={LBL}>{t('cahier_de_texte.chapter_label')}</label>
              <select value={selectedChapitre} onChange={e => onChapitreChange(e.target.value)} style={SEL}>
                <option value="">{t('cahier_de_texte.chapter_placeholder')}</option>
                {chapitres.map(c => (
                  <option key={c.id} value={c.id}>Ch.{c.ordre} — {c.titre} ({c.volumeHeuresPrevu}h)</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label style={LBL}>{t('cahier_de_texte.free_text_label')}</label>
              <textarea
                value={contenuLibre} onChange={e => onContenuLibreChange(e.target.value)}
                placeholder={t('cahier_de_texte.free_text_placeholder')}
                rows={3} style={AREA}
                autoFocus
              />
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, fontWeight: 600 }}>
                {t('cahier_de_texte.free_text_hint')}
              </div>
            </div>
          )
        )}

        {hasProgramme !== false && (
          <div>
            <label style={LBL}>{t('cahier_de_texte.content_label')}{hasProgramme === null ? '' : '*'}</label>
            <textarea
              value={contenu} onChange={e => onContenuChange(e.target.value)}
              placeholder={t('cahier_de_texte.content_placeholder')}
              rows={3} style={{ ...AREA, minHeight: 70 }}
            />
          </div>
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: devoirsOn ? 8 : 0 }}>
            <label style={{ ...LBL, marginBottom: 0, flex: 1 }}>{t('cahier_de_texte.homework_label')}</label>
            <button
              onClick={onToggleDevoirs}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: devoirsOn ? 'var(--sidebar)' : 'var(--border)', transition: 'background 0.2s',
                position: 'relative', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: devoirsOn ? 22 : 3,
                width: 20, height: 20, borderRadius: '50%', background: 'var(--surface)',
                transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
          {devoirsOn && (
            <textarea
              value={devoirs} onChange={e => onDevoirsChange(e.target.value)}
              placeholder={t('cahier_de_texte.homework_placeholder')}
              rows={2} style={AREA} autoFocus
            />
          )}
        </div>

        <div>
          <label style={LBL}>{t('cahier_de_texte.date_label')}</label>
          <input type="date" value={date} onChange={e => onDateChange(e.target.value)}
            style={{ ...SEL, paddingTop: 6, paddingBottom: 6 }} />
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <button
          onClick={onScanClick}
          disabled={scanning}
          style={{
            width: '100%', minHeight: 42, padding: '9px 12px', borderRadius: 8,
            border: '1px dashed var(--border2)', background: 'transparent',
            color: 'var(--text3)', fontSize: 12.5, fontWeight: 700,
            fontFamily: 'inherit', cursor: scanning ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {scanning
            ? <><Loader2 size={15} strokeWidth={2} className="animate-spin" /> {t('cahier_de_texte.scan_scanning')}</>
            : <><Camera size={15} strokeWidth={2} /> {t('cahier_de_texte.scan_idle')}</>
          }
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={onScan} />
      </div>

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', paddingTop: 10, paddingBottom: 16 }}>
        <button
          onClick={onSave}
          disabled={saving || !isFormValid}
          style={{
            width: '100%', minHeight: 44, padding: '11px 16px', borderRadius: 8,
            background: (saving || !isFormValid) ? 'var(--border)' : 'var(--sidebar)',
            color: 'white', border: 'none', fontSize: 13.5, fontWeight: 700,
            fontFamily: 'inherit', cursor: (saving || !isFormValid) ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {saving ? <Save size={16} strokeWidth={2} /> : !isOnline ? <WifiOff size={16} strokeWidth={2} /> : <Check size={16} strokeWidth={2} />}
          {saving ? t('cahier_de_texte.save_saving') : !isOnline ? t('cahier_de_texte.save_offline') : t('cahier_de_texte.save_online')}
        </button>
      </div>
    </div>
  )
}
