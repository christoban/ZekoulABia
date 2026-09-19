'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react'
import PushNotificationToggle from '@/components/PushNotificationToggle'
import MfaSettings from '@/components/MfaSettings'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface DiplomeAnalyse {
  intitule: string | null
  institution: string | null
  anneeObtention: string | null
  suggestionTermeOfficiel: string | null
  confidence: 'high' | 'medium' | 'low'
}

interface EmployeeFile {
  dateNaissance: string | null
  gender: string | null
  diplomes: string[] | null
  numeroCNPS: string | null
  typeContrat: string | null
  echelonActuel: string | null
  documentsUrls: { type: string; label: string; url: string; uploadedAt: string }[] | null
  selfServiceCompletedAt: string | null
}

const DOCUMENT_TYPES = [
  { value: 'DIPLOME_ACADEMIQUE', labelKey: 'docDiplomeAcademique' },
  { value: 'DIPLOME_PROFESSIONNEL', labelKey: 'docDiplomeProfessionnel' },
  { value: 'PIECE_IDENTITE', labelKey: 'docPieceIdentite' },
  { value: 'AUTRE', labelKey: 'docAutre' },
]

const btnPri = { padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' as const }
const btnSec = { padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' as const }
const inputStyle = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5, width: '100%', boxSizing: 'border-box' as const }
const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '8px 0 4px' }}>{children}</div>
}

export default function SectionMonProfilRH({ onToast }: Props) {
  const t = useT('hrSelfService')
  const [file, setFile] = useState<EmployeeFile | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('DIPLOME_ACADEMIQUE')
  const [docLabel, setDocLabel] = useState('')
  const [docFile, setDocFile] = useState<globalThis.File | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [analyse, setAnalyse] = useState<DiplomeAnalyse | null>(null)
  const [analyseWarnings, setAnalyseWarnings] = useState<string[]>([])

  const fetchFile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/hr-self-service/me', { credentials: 'include' })
      const data = await res.json()
      if (data.success) { setFile(data.data); setForm(data.data ?? {}) }
    } catch { onToast(t('errorGeneric'), 'error') } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchFile() }, [fetchFile])

  const addDiplome = () => {
    const list = Array.isArray(form.diplomes) ? form.diplomes : []
    setForm((f) => ({ ...f, diplomes: [...list, ''] }))
  }
  const updateDiplome = (idx: number, value: string) => {
    const list = [...(form.diplomes ?? [])]
    list[idx] = value
    setForm((f) => ({ ...f, diplomes: list }))
  }
  const removeDiplome = (idx: number) => {
    const list = [...(form.diplomes ?? [])]
    list.splice(idx, 1)
    setForm((f) => ({ ...f, diplomes: list }))
  }

  const save = async (confirmComplete: boolean) => {
    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/hr-self-service/me', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...form, confirmComplete }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(confirmComplete ? t('profileConfirmed') : t('profileSaved'), 'success')
        setFile(data.data)
      } else onToast(data.message || t('errorGeneric'), 'error')
    } catch { onToast(t('errorGeneric'), 'error') } finally { setSaving(false) }
  }

  const uploadDocument = async () => {
    if (!docFile) { onToast(t('selectFileFirst'), 'error'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', docFile)
      formData.append('type', docType)
      formData.append('label', docLabel || docType)
      const res = await fetchApi('/api/v2/hr-self-service/me/document', { method: 'POST', credentials: 'include', body: formData })
      const data = await res.json()
      if (data.success) {
        onToast(t('documentUploaded'), 'success')
        setFile(data.data)
        setDocFile(null)
        setDocLabel('')
      } else onToast(data.message || t('errorGeneric'), 'error')
    } catch { onToast(t('errorGeneric'), 'error') } finally { setUploading(false) }
  }

  const downloadDocument = (index: number) => window.open(`/api/v2/hr-self-service/me/document/${index}/download`, '_blank')

  const analyserAvecIA = async () => {
    if (!docFile) { onToast(t('selectFileFirst'), 'error'); return }
    setAnalysing(true)
    setAnalyse(null)
    setAnalyseWarnings([])
    try {
      const formData = new FormData()
      formData.append('file', docFile)
      const res = await fetchApi('/api/v2/hr-self-service/me/analyser-diplome', { method: 'POST', credentials: 'include', body: formData })
      const data = await res.json()
      if (data.success) {
        setAnalyse(data.data.analyse)
        setAnalyseWarnings(data.data.warnings ?? [])
        if (data.data.analyse?.intitule) {
          setDocLabel(data.data.analyse.intitule)
          onToast(t('analyseSuccess'), 'success')
        }
      } else {
        onToast(data.message || t('errorGeneric'), 'error')
      }
    } catch { onToast(t('errorGeneric'), 'error') } finally { setAnalysing(false) }
  }

  const appliquerSuggestionDiplome = (valeur: string) => {
    const list = Array.isArray(form.diplomes) ? [...form.diplomes] : []
    list.push(valeur)
    setForm((f) => ({ ...f, diplomes: list }))
    onToast(t('suggestionApplied'), 'success')
  }

  if (loading) return <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('common.loading') || '...'}</div>

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>{t('title')}</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{t('subtitle')}</p>
      </div>

      <div style={{ marginBottom: 14 }}>
        <PushNotificationToggle />
      </div>

      <div style={{ marginBottom: 14 }}>
        <MfaSettings />
      </div>

      {file?.selfServiceCompletedAt ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(22,163,74,0.1)', border: '1px solid var(--green)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: 'var(--green)' }}>
          <CheckCircle2 size={14} strokeWidth={2} /> {t('completedOn', { date: new Date(file.selfServiceCompletedAt).toLocaleDateString() })}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(234,179,8,0.1)', border: '1px solid #eab308', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#92400e' }}>
          <AlertTriangle size={14} strokeWidth={2} /> {t('notCompletedYet')}
        </div>
      )}

      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('sectionIdentite')}</h3>

        <FieldLabel>{t('fieldDateNaissance')}</FieldLabel>
        <input style={inputStyle} type="date" value={form.dateNaissance ? String(form.dateNaissance).slice(0, 10) : ''}
          onChange={(e) => setForm((f) => ({ ...f, dateNaissance: e.target.value || null }))} />

        <FieldLabel>{t('fieldGender')}</FieldLabel>
        <select style={inputStyle} value={form.gender ?? ''} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value || null }))}>
          <option value="">—</option>
          <option value="F">{t('genderF')}</option>
          <option value="M">{t('genderM')}</option>
        </select>

        <FieldLabel>{t('fieldNumeroCNPS')}</FieldLabel>
        <input style={inputStyle} value={form.numeroCNPS ?? ''} onChange={(e) => setForm((f) => ({ ...f, numeroCNPS: e.target.value }))} />

        <FieldLabel>{t('fieldTypeContrat')}</FieldLabel>
        <input style={inputStyle} value={form.typeContrat ?? ''} onChange={(e) => setForm((f) => ({ ...f, typeContrat: e.target.value }))} placeholder={t('fieldTypeContratPlaceholder')} />

        <FieldLabel>{t('fieldEchelon')}</FieldLabel>
        <input style={inputStyle} value={form.echelonActuel ?? ''} onChange={(e) => setForm((f) => ({ ...f, echelonActuel: e.target.value }))} />
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('sectionDiplomes')}</h3>
          <button onClick={addDiplome} style={btnSec}>+ {t('addDiplome')}</button>
        </div>
        {(form.diplomes ?? []).length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)' }}>{t('diplomesEmpty')}</p>}
        {(form.diplomes ?? []).map((d: string, idx: number) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input style={inputStyle} value={d} onChange={(e) => updateDiplome(idx, e.target.value)} placeholder={t('diplomePlaceholder')} />
            <button onClick={() => removeDiplome(idx)} style={{ ...btnSec, color: 'var(--red)', borderColor: 'var(--red)', padding: '5px 9px' }}>×</button>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('sectionDocuments')}</h3>
        {(file?.documentsUrls ?? []).length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{t('documentsEmpty')}</p>
        ) : (
          <div style={{ marginBottom: 10 }}>
            {(file?.documentsUrls ?? []).map((d, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12 }}>{d.label} <span style={{ color: 'var(--text3)' }}>({new Date(d.uploadedAt).toLocaleDateString()})</span></span>
                <button onClick={() => downloadDocument(idx)} style={{ ...btnSec, padding: '3px 8px', fontSize: 11.5 }}>{t('downloadBtn')}</button>
              </div>
            ))}
          </div>
        )}
        <FieldLabel>{t('fieldDocType')}</FieldLabel>
        <select style={inputStyle} value={docType} onChange={(e) => setDocType(e.target.value)}>
          {DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{t(d.labelKey)}</option>)}
        </select>
        <FieldLabel>{t('fieldDocLabel')}</FieldLabel>
        <input style={inputStyle} value={docLabel} onChange={(e) => setDocLabel(e.target.value)} placeholder={t('fieldDocLabelPlaceholder')} />
        <FieldLabel>{t('fieldDocFile')}</FieldLabel>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ fontSize: 12 }} onChange={(e) => {
          setDocFile(e.target.files?.[0] ?? null)
          setAnalyse(null)
          setAnalyseWarnings([])
        }} />

        {docFile && docFile.type.startsWith('image/') && (
          <div style={{ marginTop: 8 }}>
            <button onClick={analyserAvecIA} disabled={analysing} style={{ ...btnSec, display: 'flex', alignItems: 'center', gap: 5, borderColor: 'var(--blue)', color: 'var(--blue)' }}>
              {analysing ? t('analysing') : <><Sparkles size={13} strokeWidth={2} /> {t('analyseWithAI')}</>}
            </button>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{t('analyseHint')}</p>
          </div>
        )}

        {analyse && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginTop: 10 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{t('analyseResultTitle')}</p>
            {analyse.intitule ? (
              <>
                <div style={{ fontSize: 12, marginBottom: 3 }}><strong>{t('analyseIntitule')}:</strong> {analyse.intitule}</div>
                {analyse.institution && <div style={{ fontSize: 12, marginBottom: 3 }}><strong>{t('analyseInstitution')}:</strong> {analyse.institution}</div>}
                {analyse.anneeObtention && <div style={{ fontSize: 12, marginBottom: 3 }}><strong>{t('analyseAnnee')}:</strong> {analyse.anneeObtention}</div>}
                {analyse.suggestionTermeOfficiel && (
                  <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--green)' }}>
                    <strong>{t('analyseTermeOfficiel')}:</strong> {analyse.suggestionTermeOfficiel}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
                  {t('analyseConfidence')}: {t(`confidence_${analyse.confidence}`)}
                </div>
                <button onClick={() => appliquerSuggestionDiplome(analyse.suggestionTermeOfficiel || analyse.intitule!)} style={{ ...btnSec, padding: '4px 10px', fontSize: 11.5 }}>
                  {t('applySuggestion')}
                </button>
              </>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>{t('analyseNoResult')}</p>
            )}
            {analyseWarnings.map((w, i) => (
              <p key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#b45309', marginTop: 4 }}><AlertTriangle size={11} strokeWidth={2} /> {w}</p>
            ))}
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <button onClick={uploadDocument} disabled={uploading} style={btnSec}>{uploading ? '...' : t('uploadBtn')}</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={() => save(false)} disabled={saving} style={btnSec}>{saving ? '...' : t('saveBtn')}</button>
        <button onClick={() => save(true)} disabled={saving} style={btnPri}>{saving ? '...' : t('confirmBtn')}</button>
      </div>
    </div>
  )
}
