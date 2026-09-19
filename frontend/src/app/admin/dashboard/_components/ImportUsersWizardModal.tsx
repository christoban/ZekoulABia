'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, GraduationCap, Presentation, School, UserRound, UsersRound, X } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import ImportValidationGrid, { type ImportRow, type ValidatedRow } from './ImportValidationGrid'

type TargetType = 'STUDENT' | 'TEACHER' | 'STAFF' | 'PARENT' | 'CLASSE'
type ApiResponse<T> = { success: boolean; data: T; message?: string }
type Preview = { headers: string[]; autoMapping: Record<string, string>; targetFields: string[]; sampleRows: ImportRow[]; totalRows: number }
type Validation = { total: number; validCount: number; errorCount: number; warningCount: number; validatedRows: ValidatedRow[] }
type Summary = { total: number; success: number; professeursPrincipauxAssignes: number; affectationsPedagogiquesPreremplies: number; classesCrees: number; parentsCrees: number; staffCrees: number; elevesCrees: number; enseignantsCrees: number; errors: { ligne: number; erreur: string }[]; warnings: { ligne: number; avertissement: string }[] }

interface Props {
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onSuccess: () => void
}

const TARGETS = [
  { type: 'STUDENT' as const, icon: GraduationCap, template: 'import-eleves', label: 'student', description: 'student_desc' },
  { type: 'TEACHER' as const, icon: Presentation, template: 'import-enseignants', label: 'teacher', description: 'teacher_desc' },
  { type: 'STAFF' as const, icon: UsersRound, template: 'import-staff', label: 'staff', description: 'staff_desc' },
  { type: 'PARENT' as const, icon: UserRound, template: 'import-parents', label: 'parent', description: 'parent_desc' },
  { type: 'CLASSE' as const, icon: School, template: 'import-classes', label: 'classe', description: 'classe_desc' },
]

const summaryKeys: Record<TargetType, (keyof Summary)[]> = {
  STUDENT: ['elevesCrees'], TEACHER: ['enseignantsCrees', 'professeursPrincipauxAssignes', 'affectationsPedagogiquesPreremplies'],
  STAFF: ['staffCrees'], PARENT: ['parentsCrees'], CLASSE: ['classesCrees'],
}

function readRows(file: File): Promise<ImportRow[]> {
  return file.arrayBuffer().then(buffer => {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    return sourceRows.map(sourceRow => Object.entries(sourceRow).reduce<ImportRow>((row, [key, value]) => ({ ...row, [key]: String(value ?? '') }), {}))
  })
}

export default function ImportUsersWizardModal({ onClose, onToast, onSuccess }: Props) {
  const t = useT('admin')
  const [step, setStep] = useState(0)
  const [targetType, setTargetType] = useState<TargetType | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [validation, setValidation] = useState<Validation | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)

  const selectedTarget = TARGETS.find(target => target.type === targetType)
  const reset = () => { setStep(0); setTargetType(null); setPreview(null); setRows([]); setMapping({}); setValidation(null); setSummary(null); setLoading(false) }
  const messageFrom = (payload: { message?: string }, fallback: string) => payload.message || fallback

  const downloadTemplate = async () => {
    if (!selectedTarget) return
    try {
      const response = await fetchApi(`/api/v2/templates/${selectedTarget.template}`)
      if (!response.ok) throw new Error(t('users.i18n_ext.toast.downloadError'))
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `${selectedTarget.template}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) { onToast(error instanceof Error ? error.message : t('users.i18n_ext.toast.downloadError'), 'error') }
  }

  const uploadFile = async (file: File) => {
    if (!targetType) return
    if (file.size > 5 * 1024 * 1024) { onToast(t('users.import_modal.errors.file_too_large'), 'error'); return }
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (extension !== '.xlsx' && extension !== '.xls') { onToast(t('users.import_modal.errors.unsupported_format'), 'error'); return }
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('targetType', targetType)
      const [response, parsedRows] = await Promise.all([
        fetchApi('/api/v2/users/import/preview', { method: 'POST', body: formData }),
        readRows(file),
      ])
      const payload = await response.json() as ApiResponse<Preview>
      if (!response.ok) throw new Error(messageFrom(payload, t('users.i18n_ext.toast.importError')))
      setPreview(payload.data)
      setMapping(payload.data.autoMapping)
      setRows(parsedRows)
    } catch (error) { onToast(error instanceof Error ? error.message : t('users.i18n_ext.toast.importError'), 'error') } finally { setLoading(false) }
  }

  const validateRows = async (rowsToValidate = rows) => {
    if (!targetType || rowsToValidate.length === 0) return
    setLoading(true)
    try {
      const response = await fetchApi('/api/v2/users/import/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType, rows: rowsToValidate, columnMapping: mapping }) })
      const payload = await response.json() as ApiResponse<Validation>
      if (!response.ok) throw new Error(messageFrom(payload, t('users.i18n_ext.toast.importError')))
      setRows(rowsToValidate)
      setValidation(payload.data)
      setStep(3)
    } catch (error) { onToast(error instanceof Error ? error.message : t('users.i18n_ext.toast.importError'), 'error') } finally { setLoading(false) }
  }

  const confirmImport = async () => {
    if (!targetType || !validation) return
    setLoading(true)
    try {
      const confirmedRows = validation.validatedRows.filter(row => row.status !== 'ERROR').map(row => row.rawRow)
      const response = await fetchApi('/api/v2/users/import/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType, confirmedRows, columnMapping: mapping }) })
      const payload = await response.json() as ApiResponse<Summary>
      if (!response.ok) throw new Error(messageFrom(payload, t('users.i18n_ext.toast.importError')))
      setSummary(payload.data)
      setStep(4)
      onSuccess()
    } catch (error) { onToast(error instanceof Error ? error.message : t('users.i18n_ext.toast.importError'), 'error') } finally { setLoading(false) }
  }

  const canConfirm = Boolean(validation && validation.errorCount === 0 && validation.validatedRows.some(row => row.status !== 'ERROR'))
  const title = step === 0 ? t('users.import_modal.title') : t(`users.import_modal.step${step}_title`)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, padding: 16, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={event => event.stopPropagation()} style={{ width: 980, maxWidth: '100%', maxHeight: '94vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 20, padding: '24px 28px', boxShadow: '0 32px 80px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div><h2 style={{ margin: 0, color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>{title}</h2><p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>{t(`users.import_modal.step${step}_desc`)}</p></div>
          <button type="button" onClick={onClose} aria-label={t('users.import_modal.btn_close')} style={{ border: 'none', cursor: 'pointer', borderRadius: 9, padding: 8, background: 'var(--bg2)', color: 'var(--text2)' }}><X size={18} /></button>
        </div>
        <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>{(t('users.import_modal.steps') as unknown as string[]).map((label, index) => <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 25, height: 25, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: index <= step ? 'var(--green)' : 'var(--border)', color: index <= step ? 'white' : 'var(--text3)' }}>{index + 1}</span><span style={{ color: index === step ? 'var(--green)' : 'var(--text3)', fontSize: 12, fontWeight: 700 }}>{label}</span></div>)}</div>

        {step === 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))', gap: 12 }}>{TARGETS.map(target => { const Icon = target.icon; return <button key={target.type} type="button" onClick={() => { setTargetType(target.type); setStep(1) }} style={{ display: 'flex', gap: 14, textAlign: 'left', width: '100%', padding: '18px', border: '2px solid var(--border)', borderRadius: 14, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}><Icon size={30} strokeWidth={1.5} /><span><strong style={{ display: 'block', fontSize: 16 }}>{t(`users.import_modal.choose_${target.label}`)}</strong><small style={{ display: 'block', color: 'var(--text3)', marginTop: 3 }}>{t(`users.import_modal.choose_${target.description}`)}</small></span></button> })}</div>}

        {step === 1 && <div style={{ textAlign: 'center', padding: 18 }}><Download size={46} color="var(--green)" strokeWidth={1.5} /><p style={{ color: 'var(--text2)', lineHeight: 1.6 }}>{t('users.import_modal.step1_desc')}</p><button type="button" onClick={downloadTemplate} style={primaryButton}>{t('users.import_modal.download', { type: selectedTarget ? t(`users.import_modal.download_type_${selectedTarget.label}`) : '' })}</button><br /><button type="button" onClick={() => setStep(2)} style={linkButton}>{t('users.import_modal.already_have_file')}</button></div>}

        {step === 2 && <div><label style={{ display: 'block', padding: 28, border: '2px dashed var(--border)', borderRadius: 14, textAlign: 'center', cursor: 'pointer', color: 'var(--text2)' }}><FileSpreadsheet size={34} style={{ margin: 'auto' }} /><strong style={{ display: 'block', marginTop: 10 }}>{loading ? t('users.import_modal.loading') : t('users.import_modal.upload_prompt')}</strong><small style={{ color: 'var(--text3)' }}>{t('users.import_modal.upload_hint')}</small><input type="file" accept=".xlsx,.xls" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadFile(file) }} style={{ display: 'none' }} /></label>
          {preview && <><h3 style={sectionTitle}>{t('users.import_modal.mapping_title')}</h3><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: 'var(--bg2)' }}><th style={cellHeader}>{t('users.import_modal.detected_column')}</th><th style={cellHeader}>{t('users.import_modal.target_field')}</th></tr></thead><tbody>{preview.headers.map(header => <tr key={header} style={{ borderTop: '1px solid var(--border)' }}><td style={cell}>{header}</td><td style={cell}><select value={mapping[header] ?? ''} onChange={event => setMapping(current => ({ ...current, [header]: event.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)' }}><option value="">{t('users.import_modal.ignore_column')}</option>{preview.targetFields.map(field => <option key={field} value={field}>{t(`users.import_modal.target_fields.${field}`)}</option>)}</select></td></tr>)}</tbody></table></div><h3 style={sectionTitle}>{t('users.import_modal.preview', { shown: preview.sampleRows.length, total: preview.totalRows })}</h3><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: 12 }}><thead><tr style={{ background: 'var(--bg2)' }}>{preview.headers.map(header => <th key={header} style={cellHeader}>{header}</th>)}</tr></thead><tbody>{preview.sampleRows.map((row, index) => <tr key={index} style={{ borderTop: '1px solid var(--border)' }}>{preview.headers.map(header => <td key={header} style={cell}>{row[header] || '—'}</td>)}</tr>)}</tbody></table></div><div style={{ display: 'flex', gap: 10, marginTop: 22 }}><button type="button" onClick={() => setStep(1)} style={secondaryButton}>{t('users.import_modal.btn_back')}</button><button type="button" onClick={() => void validateRows()} disabled={loading} style={primaryButton}>{t('users.import_modal.btn_next')}</button></div></>}</div>}

        {step === 3 && validation && <div><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--text2)', fontSize: 13, marginBottom: 12 }}><span>{t('users.import_modal.valid_count', { count: validation.validCount })}</span><span>{t('users.import_modal.warning_count', { count: validation.warningCount })}</span><span>{t('users.import_modal.error_count', { count: validation.errorCount })}</span></div><h3 style={sectionTitle}>{t('users.import_modal.correction_title')}</h3><p style={{ color: 'var(--text3)', fontSize: 13 }}>{t('users.import_modal.correction_hint')}</p><ImportValidationGrid headers={preview?.headers ?? []} rows={validation.validatedRows} columnMapping={mapping} onRowsChange={setRows} /><div style={{ display: 'flex', gap: 10, marginTop: 22 }}><button type="button" onClick={() => void validateRows()} disabled={loading} style={secondaryButton}>{t('users.import_modal.revalidate')}</button><button type="button" onClick={() => void confirmImport()} disabled={!canConfirm || loading} style={{ ...primaryButton, opacity: canConfirm ? 1 : 0.55, cursor: canConfirm ? 'pointer' : 'not-allowed' }}>{t('users.import_modal.btn_confirm')}</button></div></div>}

        {step === 4 && summary && <div style={{ textAlign: 'center' }}><CheckCircle2 size={48} color="var(--green)" strokeWidth={1.5} /><h3 style={{ color: 'var(--text)' }}>{t('users.import_modal.summary_title')}</h3><p style={{ color: 'var(--text2)' }}>{t('users.import_modal.result_success', { count: summary.success })} / {summary.total}</p>{summaryKeys[targetType!].map(key => <p key={key} style={{ color: 'var(--text2)', margin: 6 }}>{t(`users.import_modal.summary.${key}`, { count: summary[key] as number })}</p>)}{[...summary.errors, ...summary.warnings].length > 0 && <div style={{ textAlign: 'left', marginTop: 18, padding: 14, borderRadius: 10, background: 'var(--amber-light)', color: 'var(--text2)' }}><AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{t('users.import_modal.remaining_issues')}{summary.errors.map(issue => <p key={`error-${issue.ligne}`}>{t('users.import_modal.line', { line: issue.ligne })} — {issue.erreur}</p>)}{summary.warnings.map(issue => <p key={`warning-${issue.ligne}`}>{t('users.import_modal.line', { line: issue.ligne })} — {issue.avertissement}</p>)}</div>}<div style={{ display: 'flex', gap: 10, marginTop: 22 }}><button type="button" onClick={reset} style={secondaryButton}>{t('users.import_modal.btn_import_another')}</button><button type="button" onClick={onClose} style={primaryButton}>{t('users.import_modal.btn_close')}</button></div></div>}
      </div>
    </div>
  )
}

const primaryButton = { flex: 1, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white' }
const secondaryButton = { flex: 1, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text2)' }
const linkButton = { marginTop: 18, border: 'none', background: 'transparent', color: 'var(--green)', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }
const sectionTitle = { color: 'var(--text)', fontSize: 15, margin: '22px 0 10px' }
const cellHeader = { padding: '9px 10px', textAlign: 'left' as const, color: 'var(--text2)', fontSize: 12 }
const cell = { padding: '9px 10px', color: 'var(--text2)', fontSize: 13 }
