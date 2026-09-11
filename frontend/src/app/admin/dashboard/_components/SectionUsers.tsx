'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import ImportUsersWizardModal from './ImportUsersWizardModal'
import {
  Search, Eye, Wallet, Wrench, BookOpen, Compass, Package, School, KeyRound,
  X, GraduationCap, Presentation, Download, FileText, FolderOpen, AlertTriangle,
  UserCheck, Star, Pencil, RefreshCw, Trash2, ClipboardList, IdCard, Upload,
  Loader2, CheckCircle2, MoreHorizontal, MoreVertical, UserPlus, type LucideIcon,
} from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

// ── Mapping titre → permissions (doit correspondre au backend StaffPermissionRules.ts) ──
type StaffPermission =
  | 'MANAGE_TIMETABLE' | 'VALIDATE_GRADES' | 'MANAGE_EXAMS'
  | 'SUPERVISE_TEACHERS' | 'MANAGE_ATTENDANCE' | 'MANAGE_DISCIPLINE'
  | 'MANAGE_INCIDENTS' | 'MANAGE_FINANCE' | 'VALIDATE_PAYMENTS'
  | 'GENERATE_REPORTS' | 'MANAGE_ATELIERS' | 'MANAGE_PRACTICAL_GRADES'
  | 'MANAGE_INTERNSHIPS' | 'MANAGE_STAGE_CONVENTIONS' | 'MANAGE_WORKSHOP_STOCK'
  | 'MANAGE_CLASS_COUNCIL' | 'MANAGE_CATCHUP_REQUESTS'
  | 'VIEW_DEPARTMENT_GRADES' | 'SUPERVISE_DEPARTMENT_TEACHERS'
  | 'VALIDATE_DEPARTMENT_TIMETABLE' | 'GENERATE_DEPARTMENT_REPORTS'
  | 'VIEW_SUPERVISED_GRADES' | 'SUPERVISE_LESSON_PLANS'
  | 'GENERATE_PEDAGOGICAL_REPORTS' | 'MANAGE_CE_REPORTS' | 'MANAGE_PEDAGOGICAL_BRIEF'
  | 'MANAGE_PATRIMOINE' | 'MANAGE_DEGRADATIONS' | 'MANAGE_LIBRARY' | 'MANAGE_ORIENTATION'



type StaffTitle = {
  key: string
  label: string
  permissions: StaffPermission[]
}

// Icône par titre (fallback générique selon les permissions typiques)
function iconForTitle(key: string): LucideIcon {
  if (key.includes('Censeur') || key.includes('Vice-Principal') || key.includes('Deputy Head') || key.includes('Directeur Adjoint')) return Search
  if (key.includes('Surveillant') || key.includes('Discipline')) return Eye
  if (key.includes('Intendant') || key.includes('Économe') || key.includes('Bursar')) return Wallet
  if (key.includes('Chef des Travaux')) return Wrench
  if (key.includes('Documentaliste') || key.includes('Librarian')) return BookOpen
  if (key.includes('Orientation') || key.includes('Counsellor') || key.includes('Pédagogique')) return Compass
  if (key.includes('Comptable') || key.includes('Matières')) return Package
  if (key.includes('HOD') || key.includes('Animateur')) return School
  return KeyRound
}





interface UserItem {
  id: string
  firstName: string
  lastName: string
  email: string | null
  role: string
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  studentProfile: { class: { name: string } | null; dateOfBirth: string | null; gender: string | null } | null
  staffProfile: { title: string } | null
  classesProfessorPrincipal?: { id: string; name: string }[]
}

// ── Fusion permissions sans doublon ──
function mergePermissions(selectedTitles: string[], customPerms: StaffPermission[], titles: StaffTitle[]): StaffPermission[] {
  const set = new Set<StaffPermission>(customPerms)
  for (const tk of selectedTitles) {
    const title = titles.find(t => t.key === tk)
    title?.permissions.forEach(p => set.add(p))
  }
  return Array.from(set)
}

// ── Modal invitation ──
interface InviteForm {
  firstName: string
  lastName: string
  email: string
  role: string
  selectedTitles: string[]
  customPerms: StaffPermission[]
  showCustomPerms: boolean
  loading: boolean
  error: string
}

const EMPTY_FORM: InviteForm = {
  firstName: '', lastName: '', email: '', role: 'TEACHER',
  selectedTitles: [], customPerms: [], showCustomPerms: false,
  loading: false, error: '',
}

function InviteModal({ onClose, onSuccess, staffTitles }: { onClose: () => void; onSuccess: (msg: string) => void; staffTitles: StaffTitle[] }) {
  const t = useT('admin')
  const [form, setForm] = useState<InviteForm>(EMPTY_FORM)

  const set = (field: keyof InviteForm, val: unknown) =>
    setForm(prev => ({ ...prev, [field]: val }))

  const toggleTitle = (key: string) => {
    const next = form.selectedTitles.includes(key)
      ? form.selectedTitles.filter(k => k !== key)
      : [...form.selectedTitles, key]
    // Quand on coche "Personnalisé", pré-cocher les perms déjà accumulées
    if (key === '__custom__') {
      setForm(prev => ({ ...prev, selectedTitles: next, showCustomPerms: !prev.showCustomPerms }))
    } else {
      setForm(prev => ({ ...prev, selectedTitles: next }))
    }
  }

  const toggleCustomPerm = (perm: StaffPermission) => {
    const next = form.customPerms.includes(perm)
      ? form.customPerms.filter(p => p !== perm)
      : [...form.customPerms, perm]
    set('customPerms', next)
  }

  const mergedPerms = mergePermissions(form.selectedTitles, form.customPerms, staffTitles)
  const isStaff = form.role === 'STAFF'

  const submit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      set('error', t('users.invite_modal.errors.required'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      set('error', t('users.invite_modal.errors.invalid_email'))
      return
    }
    if (isStaff && form.selectedTitles.length === 0 && form.customPerms.length === 0) {
      set('error', t('users.invite_modal.errors.select_position'))
      return
    }

    set('loading', true)
    set('error', '')
    try {
      const res = await fetchApi('/api/v2/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          role: form.role,
          password: 'ZekoulABia2025!',
          ...(isStaff && {
            staffTitle: form.selectedTitles[0] ?? 'Personnalisé',
            staffPermissions: mergedPerms,
          }),
        }),
      })
      const data = await res.json() as { success?: boolean; message?: string }
      if (!res.ok || !data.success) throw new Error(data.message ?? t('users.invite_modal.errors.unknown'))
      onSuccess(t('users.invite_modal.success').replace('{name}', `${form.firstName} ${form.lastName}`))
      onClose()
    } catch (err: unknown) {
      set('error', err instanceof Error ? err.message : t('users.invite_modal.errors.send_error'))
    } finally {
      set('loading', false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)' }} />

      {/* Conteneur centrage */}
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, width: '96%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto', borderRadius: 10 }}>
        <div className="px-5 py-6 md:px-11 md:py-10" style={{ background: 'var(--surface)', borderRadius: 10, boxShadow: '0 32px 80px rgba(0,0,0,0.22)', animation: 'popIn 0.22s ease' }}>

          {/* Header */}
          <div className="mb-[16px] md:mb-[24px]" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
                {t('users.invite_modal.title')}
              </div>
              <div className="text-[12.5px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 4 }}>
                {t('users.invite_modal.subtitle')}
              </div>
            </div>
            <button onClick={onClose}
              style={{ background: 'var(--bg2)', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 16, padding: '6px 11px', borderRadius: 9, lineHeight: 1, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}><X size={16} strokeWidth={2} /></button>
          </div>

          <div className="mb-[18px] md:mb-[26px]" style={{ height: 1, background: 'var(--border)' }} />

          <div className="gap-[14px] md:gap-3.5" style={{ display: 'flex', flexDirection: 'column' }}>

            {/* Nom + Prénom */}
            <div className="gap-[12px] md:gap-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <Field label={t('users.invite_modal.first_name_label')}>
                <input value={form.firstName} onChange={e => set('firstName', e.target.value)}
                  placeholder={t('users.invite_modal.first_name_placeholder')} className={inputStCls} style={inputSt} />
              </Field>
              <Field label={t('users.invite_modal.last_name_label')}>
                <input value={form.lastName} onChange={e => set('lastName', e.target.value)}
                  placeholder={t('users.invite_modal.last_name_placeholder')} className={inputStCls} style={inputSt} />
              </Field>
            </div>

            {/* Email */}
            <Field label={t('users.invite_modal.email_label')}>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder={t('users.invite_modal.email_placeholder')} className={inputStCls} style={inputSt} />
            </Field>

            {/* Rôle */}
            <Field label={t('users.invite_modal.role_label')}>
              <select value={form.role} onChange={e => set('role', e.target.value)} className={inputStCls} style={{ ...inputSt, cursor: 'pointer', appearance: 'auto' }}>
                <option value="TEACHER">{t('users.invite_modal.role_teacher')}</option>
                <option value="STAFF">{t('users.invite_modal.role_staff')}</option>
                <option value="STUDENT">{t('users.invite_modal.role_student')}</option>
                <option value="PARENT">{t('users.invite_modal.role_parent')}</option>
              </select>
            </Field>

            {/* Section STAFF — postes avec checkboxes */}
              {isStaff && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 12 }}>
                    {t('users.invite_modal.staff_positions')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {staffTitles.length === 0 && (
                      <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px' }}>{t('users.invite_modal.loading_titles')}</div>
                    )}
                  {staffTitles.map(title => {
                    const checked = form.selectedTitles.includes(title.key)
                    const TitleIcon = iconForTitle(title.key)
                    return (
                      <label key={title.key}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 11px', borderRadius: 8, border: `1.5px solid ${checked ? 'var(--green)' : 'var(--border)'}`, background: checked ? 'var(--green-light)' : 'white', cursor: 'pointer', transition: 'all 0.12s' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleTitle(title.key)}
                          style={{ marginTop: 3, accentColor: 'var(--green)', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}><TitleIcon size={16} strokeWidth={2} /> {title.label}</div>
                          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>
                            {(title.permissions as StaffPermission[]).slice(0, 4).map(p => t(`users.permissions.${p}`)).join(' · ')}
                            {title.permissions.length > 4 ? ` + ${title.permissions.length - 4}` : ''}
                          </div>
                        </div>
                      </label>
                    )
                  })}

                  {/* Personnalisé */}
                  <label
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 11px', borderRadius: 8, border: `1.5px solid ${form.showCustomPerms ? 'var(--purple)' : 'var(--border)'}`, background: form.showCustomPerms ? 'var(--purple-light)' : 'white', cursor: 'pointer', transition: 'all 0.12s' }}>
                    <input type="checkbox" checked={form.showCustomPerms} onChange={() => setForm(prev => ({ ...prev, showCustomPerms: !prev.showCustomPerms }))}
                      style={{ marginTop: 3, accentColor: 'var(--purple)', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('users.invite_modal.custom_title')}</div>
                      <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>{t('users.invite_modal.custom_subtitle')}</div>
                    </div>
                  </label>
                </div>

                {/* Permissions personnalisées */}
                {form.showCustomPerms && (
                  <div style={{ marginTop: 14, padding: '11px 12px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                      {t('users.invite_modal.custom_perms_header')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {(Object.keys(t('users.permissions') as unknown as Record<string, string>) as StaffPermission[]).map(perm => {
                        const isInherited = mergePermissions(form.selectedTitles, [], staffTitles).includes(perm)
                        const isChecked = mergedPerms.includes(perm)
                        return (
                          <label key={perm}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: isInherited ? 'var(--green-light)' : 'white', border: `1px solid ${isInherited ? 'rgba(5,150,105,0.2)' : 'var(--border)'}`, cursor: isInherited ? 'default' : 'pointer', opacity: 1 }}>
                            <input type="checkbox" checked={isChecked} disabled={isInherited}
                              onChange={() => !isInherited && toggleCustomPerm(perm)}
                              style={{ accentColor: 'var(--green)', width: 14, height: 14, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: isInherited ? 'var(--green)' : 'var(--text2)', lineHeight: 1.2 }}>
                              {t(`users.permissions.${perm}`)}
                              {isInherited && <span style={{ fontSize: 11, color: 'var(--green)', marginLeft: 4 }}>{t('users.permission_inherited')}</span>}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Résumé des permissions fusionnées */}
                {mergedPerms.length > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 11px', background: 'var(--green-light)', borderRadius: 8, border: '1px solid rgba(5,150,105,0.2)', fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
                    {t('users.invite_modal.merged_count').replace('{count}', String(mergedPerms.length))} :&nbsp;
                    {mergedPerms.slice(0, 5).map(p => t(`users.permissions.${p}`)).join(', ')}
                    {mergedPerms.length > 5 ? t('users.invite_modal.merged_plus').replace('{count}', String(mergedPerms.length - 5)) : ''}
                  </div>
                )}
              </div>
            )}

            {/* Erreur */}
            {form.error && (
              <div style={{ padding: '10px 11px', background: 'var(--red-light)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.2)', fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>
                {form.error}
              </div>
            )}

            {/* Submit */}
            <button onClick={submit} disabled={form.loading}
              className="text-[14.5px] md:text-[14px] py-[13px] px-3.5 md:py-3 md:px-[24px]"
              style={{ width: '100%', background: form.loading ? 'var(--border)' : 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', fontWeight: 800, borderRadius: 11, border: 'none', cursor: form.loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {form.loading ? t('users.invite_modal.sending') : t('users.invite_modal.send')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Modal Import Excel ──
interface ImportPreviewRow {
  nom: string
  prenom: string
  email: string
  telephone: string
  classe?: string
  matieres?: string
  classePrincipale?: string
  departementAp?: string
}

interface ImportStepProps {
  importType: 'STUDENT' | 'TEACHER' | null
  setImportType: (t: 'STUDENT' | 'TEACHER') => void
  step: number
  onStep: (n: number) => void
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onSuccess: () => void
}

function ImportModal({ onClose, onToast, onSuccess }: Omit<ImportStepProps, 'importType' | 'setImportType' | 'step' | 'onStep'>) {
  const t = useT('admin')
  const [step, setStep] = useState(0)
  const [importType, setImportType] = useState<'STUDENT' | 'TEACHER' | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewRow[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    total: number
    success: number
    professeursPrincipauxAssignes: number
    animateursPedagogiquesAssignes: number
    errors: { ligne: number; erreur: string }[]
    warnings: { ligne: number; avertissement: string }[]
  } | null>(null)

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetchApi(`/api/v2/templates/${importType === 'STUDENT' ? 'import-eleves' : 'import-enseignants'}`, { credentials: 'include' })
      if (!res.ok) throw new Error(t('users.i18n_ext.toast.downloadError'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = importType === 'STUDENT' ? 'import-eleves.xlsx' : 'import-enseignants.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('users.i18n_ext.toast.downloadError'), 'error')
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      onToast(t('users.import_modal.errors.file_too_large'), 'error')
      return
    }
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'))
    if (ext !== '.xlsx' && ext !== '.xls') {
      onToast(t('users.import_modal.errors.unsupported_format'), 'error')
      return
    }
    setFile(f)

    const buffer = await f.arrayBuffer()
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
    setTotalRows(rows.length)

    const previewData: ImportPreviewRow[] = rows.slice(0, 5).map((r: Record<string, string>) => ({
      nom: r.nom || '',
      prenom: r.prenom || '',
      email: r.email || '',
      telephone: r.telephone || '',
      classe: r.classe || r.matieres || '',
      matieres: r.matieres || '',
      classePrincipale: r.classe_principale || '',
      departementAp: r.departement_ap || '',
    }))
    setPreview(previewData)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('role', importType!)
      const res = await fetchApi('/api/v2/users/import', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('users.i18n_ext.toast.importError'))
      setResult(data.data)
      setStep(3)
      if (data.data.errors?.length === 0) {
        onToast(t('users.import_modal.result_success').replace('{count}', String(data.data.success)), 'success')
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('users.i18n_ext.toast.error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setStep(0)
    setImportType(null)
    setFile(null)
    setPreview([])
    setTotalRows(0)
    setResult(null)
  }

  const handleClose = () => {
    if (result && result.success > 0) onSuccess()
    handleReset()
    onClose()
  }

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, width: '96%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', borderRadius: 10 }}>
        <div className="px-5 py-6 md:px-11 md:py-10" style={{ background: 'var(--surface)', borderRadius: 10, boxShadow: '0 32px 80px rgba(0,0,0,0.22)' }}>
          <div className="mb-[16px] md:mb-[24px]" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
                {step === 0 ? t('users.import_modal.title') : step === 1 ? t('users.import_modal.step1_title') : step === 2 ? t('users.import_modal.step2_title') : t('users.import_modal.step3_title')}
              </div>
              <div className="text-[12.5px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 4 }}>
                {step === 0 && t('users.import_modal.step0_title')}
                {step === 1 && t('users.import_modal.step1_desc')}
                {step === 2 && file ? t('users.i18n_ext.rowsDetected', { n: totalRows }) : t('users.import_modal.upload_hint')}
                {step === 3 && result && t('users.import_modal.result_success').replace('{count}', String(result.success))}
              </div>
            </div>
            <button onClick={handleClose} style={{ background: 'var(--bg2)', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 16, padding: '6px 11px', borderRadius: 9, lineHeight: 1, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}><X size={16} strokeWidth={2} /></button>
          </div>

          <div className="mb-[18px] md:mb-[26px]" style={{ height: 1, background: 'var(--border)' }} />

          {/* Steps indicator */}
          <div className="gap-[6px] mb-[20px] md:gap-[8px] md:mb-[28px]" style={{ display: 'flex', justifyContent: 'center' }}>
            {(t('users.import_modal.steps') as unknown as string[]).map((label: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="w-[24px] h-[24px] md:w-[28px] md:h-[28px] text-[12px] md:text-[13px]" style={{ borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, background: i <= step ? 'var(--green)' : 'var(--border)', color: i <= step ? 'white' : 'var(--text3)' }}>{i + 1}</div>
                <span className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: i <= step ? 'var(--green)' : 'var(--text3)', display: i === step ? 'inline' : 'none' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Step 0 — Choose type */}
          {step === 0 && (
            <div className="gap-[10px] md:gap-3" style={{ display: 'flex', flexDirection: 'column' }}>
              <button onClick={() => { setImportType('STUDENT'); setStep(1) }}
                className="gap-[12px] md:gap-3 rounded-[10px] py-2.5 px-[16px] md:py-[20px] md:px-[24px]"
                style={{ display: 'flex', alignItems: 'center', border: `2px solid ${importType === 'STUDENT' ? 'var(--green)' : 'var(--border)'}`, background: importType === 'STUDENT' ? 'var(--green-light)' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', fontFamily: 'inherit', width: '100%' }}>
                <GraduationCap className="w-[26px] h-[26px] md:w-7 md:h-7" strokeWidth={1.5} />
                <div>
                  <div className="text-[13px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('users.import_modal.choose_student')}</div>
                  <div className="text-[12.5px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 3 }}>{t('users.import_modal.choose_student_desc')}</div>
                </div>
              </button>
              <button onClick={() => { setImportType('TEACHER'); setStep(1) }}
                className="gap-[12px] md:gap-3 rounded-[10px] py-2.5 px-[16px] md:py-[20px] md:px-[24px]"
                style={{ display: 'flex', alignItems: 'center', border: `2px solid ${importType === 'TEACHER' ? 'var(--green)' : 'var(--border)'}`, background: importType === 'TEACHER' ? 'var(--green-light)' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', fontFamily: 'inherit', width: '100%' }}>
                <Presentation className="w-[26px] h-[26px] md:w-7 md:h-7" strokeWidth={1.5} />
                <div>
                  <div className="text-[13px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('users.import_modal.choose_teacher')}</div>
                  <div className="text-[12.5px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 3 }}>{t('users.import_modal.choose_teacher_desc')}</div>
                </div>
              </button>
            </div>
          )}

          {/* Step 1 — Download template */}
          {step === 1 && (
            <div style={{ textAlign: 'center', padding: '12px' }}>
              <div className="mb-[12px] md:mb-[16px]" style={{ display: 'flex', justifyContent: 'center' }}><Download className="w-7 h-7 md:w-[48px] md:h-[48px]" strokeWidth={1.5} /></div>
              <div className="text-[12px] md:text-[13px] mb-[18px] md:mb-[24px]" style={{ color: 'var(--text2)', lineHeight: 1.6 }}>
                {t('users.import_modal.step1_desc')}
              </div>
              <button onClick={handleDownloadTemplate}
                className="text-[12px] md:text-[13px] py-[13px] px-[22px] md:py-3 md:px-[28px]"
                style={{ borderRadius: 11, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                {t('users.import_modal.download').replace('{type}', importType === 'STUDENT' ? t('users.import_modal.download_type_student') : t('users.import_modal.download_type_teacher'))}
              </button>
              <div style={{ marginTop: 16 }}>
                <button onClick={() => setStep(2)}
                  className="text-[13.5px] md:text-[13px]" style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {t('users.import_modal.already_have_file')}
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Upload file */}
          {step === 2 && (
            <div>
              <label className="rounded-[10px] py-[24px] px-[16px] md:py-[36px] md:px-3.5" style={{ display: 'block', border: `2px dashed ${file ? 'var(--green)' : 'var(--border2)'}`, textAlign: 'center', cursor: 'pointer', background: file ? 'var(--green-light)' : 'var(--bg)', transition: 'all 0.12s' }}>
                <div className="mb-[10px] md:mb-[12px]" style={{ display: 'flex', justifyContent: 'center' }}>{file ? <FileText className="w-7 h-7 md:w-8 md:h-8" strokeWidth={1.5} /> : <FolderOpen className="w-7 h-7 md:w-8 md:h-8" strokeWidth={1.5} />}</div>
                {file ? (
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{file.name}</div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{t('users.import_modal.upload_prompt')}</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>{t('users.import_modal.upload_hint')}</div>
                  </>
                )}
                <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>

              {/* Preview */}
              {preview.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>
                    {t('users.import_modal.preview').replace('{shown}', String(Math.min(5, totalRows))).replace('{total}', String(totalRows))}
                  </div>
                  {/* ── Cartes empilées — mobile ── */}
                  <div className="md:hidden flex flex-col" style={{ gap: 8 }}>
                    {preview.map((row, i) => (
                      <div key={i} style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: 10 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 12 }}>{row.nom} {row.prenom}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4 }}>{row.email || '—'} · {row.telephone || '—'}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 2 }}>{row.classe || row.matieres || '—'}</div>
                        {importType === 'TEACHER' && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            {row.classePrincipale && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>{row.classePrincipale}</span>}
                            {row.departementAp && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>{row.departementAp}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* ── Tableau — desktop ── */}
                  <div className="hidden md:block" style={{ border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg2)' }}>
                            {importType === 'STUDENT'
                              ? (t('users.import_modal.preview_headers_student') as unknown as string[]).map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)' }}>{h}</th>)
                              : (t('users.import_modal.preview_headers_teacher') as unknown as string[]).map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)' }}>{h}</th>)
                            }
                          </tr>
                        </thead>
                        <tbody>
                          {preview.map((row, i) => (
                            <tr key={i} style={{ borderTop: '1px solid var(--bg2)' }}>
                              <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--text)' }}>{row.nom}</td>
                              <td style={{ padding: '7px 10px', color: 'var(--text2)' }}>{row.prenom}</td>
                              <td style={{ padding: '7px 10px', color: 'var(--text2)' }}>{row.email || '—'}</td>
                              <td style={{ padding: '7px 10px', color: 'var(--text2)' }}>{row.telephone || '—'}</td>
                              <td style={{ padding: '7px 10px', color: 'var(--text2)' }}>{row.classe || row.matieres || '—'}</td>
                              {importType === 'TEACHER' && <>
                                <td style={{ padding: '7px 10px', color: row.classePrincipale ? 'var(--green)' : 'var(--text3)', fontWeight: row.classePrincipale ? 700 : 400 }}>{row.classePrincipale || '—'}</td>
                                <td style={{ padding: '7px 10px', color: row.departementAp ? 'var(--blue)' : 'var(--text3)', fontWeight: row.departementAp ? 700 : 400 }}>{row.departementAp || '—'}</td>
                              </>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('users.import_modal.btn_back')}</button>
                <button onClick={handleImport} disabled={!file || loading}
                  style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: !file ? 'var(--border)' : 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: !file ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                  {loading ? t('users.import_modal.status_processing') : t('users.import_modal.btn_confirm')}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Result */}
          {step === 3 && result && (
            <div>
              <div style={{ textAlign: 'center', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: result.errors?.length > 0 ? 'var(--red)' : 'var(--green)' }}>{result.errors?.length > 0 ? <AlertTriangle size={16} strokeWidth={1.5} /> : <CheckCircle2 size={16} strokeWidth={1.5} />}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                  {t('users.import_modal.result_success').replace('{count}', String(result.success))}
                </div>
                {result.errors?.length > 0 && (
                  <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{t('users.import_modal.result_errors').replace('{count}', String(result.errors.length))}</div>
                )}
              </div>

              {/* Stats PP / AP */}
              {(result.professeursPrincipauxAssignes > 0 || result.animateursPedagogiquesAssignes > 0) && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  {result.professeursPrincipauxAssignes > 0 && (
                    <div style={{ flex: 1, background: 'var(--green-light)', border: '1px solid var(--green-light)', borderRadius: 8, padding: '10px 11px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}><UserCheck size={15} strokeWidth={1.5} /></div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--green)' }}>{t('users.import_modal.result_pp').replace('{count}', String(result.professeursPrincipauxAssignes))}</div>
                    </div>
                  )}
                  {result.animateursPedagogiquesAssignes > 0 && (
                    <div style={{ flex: 1, background: 'var(--blue-light)', border: '1px solid var(--blue-light)', borderRadius: 8, padding: '10px 11px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}><Star size={15} strokeWidth={1.5} /></div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)' }}>{t('users.import_modal.result_ap').replace('{count}', String(result.animateursPedagogiquesAssignes))}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Erreurs (rouge) */}
              {result.errors?.length > 0 && (
                <div style={{ marginTop: 12, background: 'var(--red-light)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.15)', padding: '11px 12px', maxHeight: 160, overflowY: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--red)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('users.import_modal.errors_header')}</div>
                  {result.errors.map((err, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--red)', marginBottom: i < result.errors.length - 1 ? 6 : 0, lineHeight: 1.5 }}>
                      <strong>{t('users.import_modal.line').replace('{line}', String(err.ligne))}</strong> — {err.erreur}
                    </div>
                  ))}
                </div>
              )}

              {/* Avertissements (orange) */}
              {result.warnings?.length > 0 && (
                <div style={{ marginTop: 10, background: 'var(--amber-light)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.25)', padding: '11px 12px', maxHeight: 120, overflowY: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--amber)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('users.import_modal.warnings_header')}</div>
                  {result.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--amber)', marginBottom: i < result.warnings.length - 1 ? 6 : 0, lineHeight: 1.5 }}>
                      <strong>{t('users.import_modal.line').replace('{line}', String(w.ligne))}</strong> — {w.avertissement}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => { handleReset(); setStep(0) }} style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {t('users.import_modal.btn_import_another')}
                </button>
                <button onClick={handleClose} style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {t('users.import_modal.btn_close')}
                </button>
              </div>
            </div>
          )}

          {/* Loading overlay for import */}
          {loading && step === 2 && (
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <div style={{ width: 32, height: 32, border: '4px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{t('users.import_modal.loading')}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{t('users.import_modal.loading_sub')}</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] md:text-[12px] mb-[4px] md:mb-[6px]" style={{ fontWeight: 700, color: 'var(--text2)' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStCls = 'rounded-[10px] px-[12px] py-[10px] text-[12px] md:px-[14px] md:py-[12px] md:text-[13px]'
const inputSt: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border)',
  fontFamily: 'inherit', color: 'var(--text)', background: 'var(--bg)',
  outline: 'none', boxSizing: 'border-box',
}



// ── Composant principal ──
interface ClassItem { id: string; name: string; cycle?: string | null }

const EMPTY_MOD_USER = { open: false, userId: '', role: '', firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', gender: '', loading: false, error: '' }
const EMPTY_TRANSFER = { open: false, userId: '', userName: '', classId: '', classes: [] as ClassItem[], loading: false, error: '' }
const EMPTY_DOC_MODAL = { open: false, userId: '', userName: '', status: '', loading: false, error: '' }

const EMPTY_CREATE_USER = {
  open: false, firstName: '', lastName: '', email: '', phone: '', role: 'TEACHER' as 'TEACHER' | 'STUDENT' | 'PARENT' | 'STAFF',
  subjectIds: [] as string[], classeId: '', dateOfBirth: '', gender: '',
  staffTitle: '', staffPermissions: [] as StaffPermission[],
  loading: false, error: '',
}
interface SubjectItem2 { id: string; name: string }

export default function SectionUsers({ onToast }: Props) {
  const t = useT('admin')

  const ROLE_TABS: { label: string; role: string }[] = [
    { label: t('users.role_tabs.all'), role: '' },
    { label: t('users.role_tabs.teachers'), role: 'TEACHER' },
    { label: t('users.role_tabs.students'), role: 'STUDENT' },
    { label: t('users.role_tabs.parents'), role: 'PARENT' },
    { label: t('users.role_tabs.staff'), role: 'STAFF' },
  ]

  const ROLE_LABEL: Record<string, { label: string; bg: string; color: string }> = {
    ADMIN:   { label: t('users.role_labels.ADMIN'),      bg: 'var(--green-light)', color: 'var(--green)' },
    TEACHER: { label: t('users.role_labels.TEACHER'), bg: 'var(--blue-light)', color: 'var(--blue)' },
    STUDENT: { label: t('users.role_labels.STUDENT'),      bg: 'var(--teal-light)', color: 'var(--teal)' },
    PARENT:  { label: t('users.role_labels.PARENT'),     bg: 'var(--amber-light)', color: 'var(--amber)' },
    STAFF:   { label: t('users.role_labels.STAFF'),  bg: 'var(--orange-light)', color: 'var(--orange)' },
  }

  const formatLastLogin = (dt: string | null): string => {
    if (!dt) return t('users.last_login.never')
    const d = new Date(dt)
    const now = new Date()
    const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000)
    if (diffH < 1) return t('users.last_login.today')
    if (diffH < 24) return t('users.last_login.time').replace('{time}', d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    if (diffH < 48) return t('users.last_login.yesterday_time').replace('{time}', d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  const [activeTab, setActiveTab] = useState(0)
  const [openDD, setOpenDD] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  // Fenêtre de grâce de ré-authentification (Couche 1, PLAN_IMPLEMENTATION_BACKUP.md §1.5) —
  // la suppression d'un utilisateur exige mot de passe + MFA avant exécution. Si le serveur
  // répond REAUTH_REQUIRED, on demande la ré-authentification puis on rejoue la suppression.
  const [reauthPourUserId, setReauthPourUserId] = useState<string | null>(null)
  const [reauthPassword, setReauthPassword] = useState('')
  const [reauthCode, setReauthCode] = useState('')
  const [reauthLoading, setReauthLoading] = useState(false)
  const [reauthError, setReauthError] = useState('')
  // Mobile — menu "..." de l'entete (Inviter / Import Excel), reproduction maquette drawer.
  const [userActionsOpen, setUserActionsOpen] = useState(false)
  const userActionsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (userActionsRef.current && !userActionsRef.current.contains(e.target as Node)) setUserActionsOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])
  const [modUser, setModUser]       = useState(EMPTY_MOD_USER)
  const [transfer, setTransfer]     = useState(EMPTY_TRANSFER)
  const [docModal, setDocModal]     = useState(EMPTY_DOC_MODAL)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_USER)

  const [availClasses, setAvailClasses] = useState<ClassItem[]>([])
  const [availSubjects, setAvailSubjects] = useState<SubjectItem2[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [staffTitles, setStaffTitles] = useState<StaffTitle[]>([])

  // Fetch des titres staff filtrés selon le template de l'école (une seule fois)
  useEffect(() => {
    fetchApi('/api/v2/school/staff-titles')
      .then(r => r.json())
      .then(d => { if (d.success) setStaffTitles(d.data as StaffTitle[]) })
      .catch(() => { /* non bloquant */ })
  }, [])

  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})

  const fetchUsers = useCallback(async (roleFilter = '') => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '100' })
      if (roleFilter) params.set('role', roleFilter)
      if (search) params.set('search', search)
      const res = await fetchApi(`/api/v2/users?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setUsers(data.data || [])
      // Utiliser roleCounts du backend (vrais totaux, pas limités à la page)
      if (!roleFilter && data.roleCounts) {
        setCounts(data.roleCounts as Record<string, number>)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
  }, [activeTab])  // eslint-disable-line react-hooks/exhaustive-deps

  // Rafraîchissement temps réel quand l'assistant IA agit sur les utilisateurs.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'user') fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchUsers, activeTab])

  // ── Générer un document scolaire ────────────────────────────────────────
  const openDocModal = (user: UserItem) => {
    setOpenDD(null)
    setDocModal({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}`, status: (user as any).studentStatus ?? 'ACTIVE', loading: false, error: '' })
  }

  const generateDoc = async (type: 'certificat' | 'carte' | 'lettre-transfert') => {
    setDocModal(f => ({ ...f, loading: true, error: '' }))
    try {
      const url = type === 'lettre-transfert'
        ? `/api/v2/students/${docModal.userId}/${type}?motif=Demande de transfert`
        : `/api/v2/students/${docModal.userId}/${type}`
      const res = await fetchApi(url, { credentials: 'include' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setDocModal(f => ({ ...f, loading: false, error: (d as any).message ?? t('users.doc_modal.toast_error') }))
        return
      }
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      window.open(objUrl, '_blank')
      setDocModal(EMPTY_DOC_MODAL)
    } catch (e: any) {
      setDocModal(f => ({ ...f, loading: false, error: e.message ?? t('users.i18n_ext.toast.networkError') }))
    }
  }

  // ── Modifier utilisateur ────────────────────────────────────────────────
  const openModUser = (user: UserItem) => {
    setOpenDD(null)
    setModUser({
      open: true, userId: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName, email: user.email ?? '', phone: '',
      dateOfBirth: user.studentProfile?.dateOfBirth ? user.studentProfile.dateOfBirth.slice(0, 10) : '',
      gender: user.studentProfile?.gender ?? '',
      loading: false, error: '',
    })
  }

  const submitModUser = async () => {
    if (!modUser.firstName.trim() || !modUser.lastName.trim()) { setModUser(f => ({ ...f, error: t('users.edit_modal.required_error') })); return }
    setModUser(f => ({ ...f, loading: true, error: '' }))
    try {
      const body: Record<string, unknown> = { firstName: modUser.firstName.trim(), lastName: modUser.lastName.trim(), email: modUser.email.trim() || undefined }
      if (modUser.role === 'STUDENT') {
        if (modUser.dateOfBirth) body.dateOfBirth = modUser.dateOfBirth
        if (modUser.gender) body.gender = modUser.gender
      }
      const res = await fetchApi(`/api/v2/users/${modUser.userId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('users.edit_modal.toast_success'), 'success')
      setModUser(EMPTY_MOD_USER)
      fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    } catch (err) {
      setModUser(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Changer de classe ────────────────────────────────────────────────────
  const openTransfer = async (user: UserItem) => {
    setOpenDD(null)
    setTransfer({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}`, classId: '', classes: [], loading: false, error: '' })
    try {
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setTransfer(f => ({ ...f, classes: data.data || [] }))
    } catch { /* silencieux */ }
  }

  const submitTransfer = async () => {
    if (!transfer.classId) { setTransfer(f => ({ ...f, error: t('users.transfer_modal.select_error') })); return }
    setTransfer(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/users/students/${transfer.userId}/transfer`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newClassId: transfer.classId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('users.transfer_modal.toast_success').replace('{name}', transfer.userName), 'success')
      setTransfer(EMPTY_TRANSFER)
      fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    } catch (err) {
      setTransfer(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const openCreateUser = async () => {
    setCreateForm(EMPTY_CREATE_USER)
    setCreateOpen(true)
    try {
      const [cRes, sRes] = await Promise.all([
        fetchApi('/api/v2/classes', { credentials: 'include' }),
        fetchApi('/api/v2/subjects', { credentials: 'include' }),
      ])
      if (cRes.ok) { const d = await cRes.json(); setAvailClasses(d.data || []) }
      if (sRes.ok) { const d = await sRes.json(); setAvailSubjects(d.data || []) }
    } catch { /* silencieux */ }
  }

  const setCreate = (field: string, val: unknown) =>
    setCreateForm(prev => ({ ...prev, [field]: val }))

  const submitCreateUser = async () => {
    if (!createForm.firstName.trim() || !createForm.lastName.trim()) {
      setCreate('error', t('users.create_modal.errors.required')); return
    }
    setCreate('loading', true)
    setCreate('error', '')
    try {
      const body: Record<string, unknown> = {
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        role: createForm.role,
        password: 'ZekoulABia2025!',
      }
      // Maternelle/primaire : jamais d'identifiants propres pour l'élève, même si un email/
      // téléphone était resté saisi avant de changer de rôle ou de classe (défense en profondeur —
      // les champs sont déjà masqués dans l'UI, voir isEleveMaternellePrimaire plus bas).
      if (!isEleveMaternellePrimaire) {
        if (createForm.email.trim()) body.email = createForm.email.trim()
        if (createForm.phone.trim()) body.phone = createForm.phone.trim()
      }

      if (createForm.role === 'TEACHER') {
        if (createForm.subjectIds.length > 0) body.subjectIds = createForm.subjectIds
      } else if (createForm.role === 'STUDENT') {
        if (createForm.classeId) body.classeId = createForm.classeId
        if (createForm.dateOfBirth) body.dateOfBirth = createForm.dateOfBirth
        if (createForm.gender) body.gender = createForm.gender
      } else if (createForm.role === 'STAFF') {
        if (createForm.staffTitle) body.staffTitle = createForm.staffTitle
        if (createForm.staffPermissions.length > 0) body.staffPermissions = createForm.staffPermissions
      }

      const res = await fetchApi('/api/v2/users', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('users.create_modal.toast_success').replace('{name}', `${createForm.firstName} ${createForm.lastName}`), 'success')
      setCreateOpen(false)
      fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    } catch (err) {
      setCreate('error', err instanceof Error ? err.message : 'Erreur')
    } finally {
      setCreate('loading', false)
    }
  }

  const toggleSubjectId = (id: string) => {
    setCreateForm(prev => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(id)
        ? prev.subjectIds.filter(x => x !== id)
        : [...prev.subjectIds, id],
    }))
  }

  const handleDelete = async (userId: string) => {
    if (!confirm(t('users.delete_confirm'))) return
    try {
      const res = await fetchApi(`/api/v2/users/${userId}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'REAUTH_REQUIRED') {
          setReauthPourUserId(userId)
          setReauthPassword('')
          setReauthCode('')
          setReauthError('')
          return
        }
        throw new Error(data.message || 'Erreur')
      }
      onToast(t('users.i18n_ext.toast.userDeleted'), 'success')
      fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    }
  }

  const handleReauthEtSupprimer = async () => {
    if (!reauthPourUserId) return
    if (!reauthPassword.trim()) { setReauthError(t('users.reauth.password_required')); return }
    setReauthLoading(true)
    setReauthError('')
    try {
      const reauthRes = await fetchApi('/api/v2/users/auth/reauth', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: reauthPassword, code: reauthCode }),
      })
      const reauthData = await reauthRes.json()
      if (!reauthRes.ok || !reauthData.success) {
        setReauthError(reauthData.message || t('users.reauth.error'))
        return
      }

      const res = await fetchApi(`/api/v2/users/${reauthPourUserId}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) { setReauthError(data.message || t('users.reauth.error')); return }

      onToast(t('users.i18n_ext.toast.userDeleted'), 'success')
      setReauthPourUserId(null)
      fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    } catch {
      setReauthError(t('users.reauth.error'))
    } finally {
      setReauthLoading(false)
    }
  }

  const totalAll = Object.values(counts).reduce((s, n) => s + n, 0)

  // Maternelle/primaire : jamais d'identifiants de connexion propres pour l'élève, même via
  // la création directe (même règle que le module eleveOnboarding — determinerRecipientType).
  const selectedClassCycle = availClasses.find(c => c.id === createForm.classeId)?.cycle ?? null
  const isEleveMaternellePrimaire = createForm.role === 'STUDENT' && (selectedClassCycle === 'maternelle' || selectedClassCycle === 'primaire')

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <div>
          <div className="text-[18px] md:text-[18px]" style={sTitle}>{t('users.title')}</div>
          <div className="text-[13px] md:text-[14px]" style={sSub}>{loading ? '…' : t('users.count_label').replace('{count}', String(totalAll))}</div>
        </div>
        {/* Desktop — 3 boutons inchangés */}
        <div className="hidden md:flex" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button style={{ ...btnSecSm, padding: '10px 14px' }} onClick={openCreateUser}>{t('users.btn_create')}</button>
          <button style={btnPrim} onClick={() => setInviteOpen(true)}>{t('users.btn_invite')}</button>
          <button style={{ ...btnSecSm, padding: '10px 14px' }} onClick={() => setImportOpen(true)}>{t('users.btn_import')}</button>
        </div>
        {/* Mobile — CTA principal + "..." (Inviter / Import Excel), reproduction maquette */}
        <div className="flex md:hidden items-center gap-[6px] flex-shrink-0">
          <button onClick={openCreateUser}
            className="inline-flex items-center gap-[6px] rounded-full px-[14px] py-[10px] text-[12.5px] whitespace-nowrap border-0"
            style={{ background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 900 }}>
            {t('users.btn_create')}
          </button>
          <div ref={userActionsRef} className="relative flex-shrink-0">
            <button onClick={() => setUserActionsOpen(o => !o)} aria-label="Menu"
              style={{ width: 28, height: 28, borderRadius: 10, border: 'none', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <MoreVertical size={17} strokeWidth={2} color="var(--text2)" />
            </button>
            {userActionsOpen && (
              <div style={{ position: 'absolute', top: 44, right: 0, width: 190, background: 'var(--surface)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18),0 2px 6px rgba(0,0,0,0.08)', padding: 8, zIndex: 20 }}>
                <div onClick={() => { setUserActionsOpen(false); setInviteOpen(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', borderRadius: 8, cursor: 'pointer' }}>
                  <UserPlus size={15} color="var(--text2)" strokeWidth={2} />
                  <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{t('users.btn_invite')}</span>
                </div>
                <div onClick={() => { setUserActionsOpen(false); setImportOpen(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', borderRadius: 8, cursor: 'pointer' }}>
                  <FileText size={15} color="var(--text2)" strokeWidth={2} />
                  <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{t('users.btn_import')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs — mobile : puces défilables + indicateur glissant, fondu de bord (maquette) */}
      <div className="relative md:hidden mb-[14px] -mr-4">
        <div className="flex gap-[6px] overflow-x-auto pr-8 py-[2px]" style={{ scrollbarWidth: 'none' }}>
          {ROLE_TABS.map((tab, i) => {
            const cnt = i === 0 ? totalAll : (counts[tab.role] ?? 0)
            const active = activeTab === i
            return (
              <button key={i} onClick={() => setActiveTab(i)}
                className="relative flex-shrink-0 flex items-center gap-[6px] rounded-full px-[14px] py-[9px] whitespace-nowrap border-0"
                style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                {active && (
                  <motion.div layoutId="users-tab-pill" className="absolute inset-0 rounded-full"
                    style={{ background: 'var(--sidebar)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10 text-[13px]" style={{ fontWeight: active ? 700 : 500, color: active ? '#fff' : 'var(--text3)' }}>{tab.label}</span>
                <span className="relative z-10 text-[11px] font-bold rounded-lg px-[6px]" style={{ color: active ? '#fff' : 'var(--text3)', background: active ? 'rgba(255,255,255,0.2)' : 'var(--border)' }}>{cnt}</span>
              </button>
            )
          })}
        </div>
        <div className="pointer-events-none absolute top-0 right-0 bottom-[4px] w-7" style={{ background: 'linear-gradient(90deg,transparent,var(--bg) 65%)' }} />
      </div>

      {/* Tabs — desktop : segmented control inchangé */}
      <div className="hidden md:flex" style={{ gap: 2, background: 'var(--bg2)', padding: 5, borderRadius: 8, marginBottom: 13, width: 'fit-content', flexWrap: 'wrap' }}>
        {ROLE_TABS.map((tab, i) => {
          const cnt = i === 0 ? totalAll : (counts[tab.role] ?? 0)
          return (
            <button key={i} onClick={() => setActiveTab(i)}
              style={{ padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', display: 'flex', alignItems: 'center', gap: 6, background: activeTab === i ? 'white' : 'transparent', color: activeTab === i ? 'var(--text)' : 'var(--text3)', boxShadow: activeTab === i ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
              {tab.label}
              <span style={{ fontSize: 13, padding: '2px 7px', borderRadius: 8, background: activeTab === i ? 'var(--green-light)' : 'var(--border)', color: activeTab === i ? 'var(--green2)' : 'var(--text3)', fontWeight: 800 }}>{cnt}</span>
            </button>
          )
        })}
      </div>

      {/* Table — carte bordee sur desktop ; sur mobile, la barre de recherche porte sa propre
          carte (ombre) et la liste flotte directement sur le fond de page (maquette). */}
      <div className="rounded-none md:rounded-[10px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]">
        <div className="p-0 mb-4 md:p-[14px] md:px-3.5 md:mb-0 md:border-b md:border-[var(--border)]" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="rounded-[10px] md:rounded-[10px] px-[14px] py-[12px] md:px-[14px] md:py-[8px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none bg-[var(--surface)] md:bg-[var(--bg2)]" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
            <Search size={16} strokeWidth={2} color="var(--text3)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchUsers(ROLE_TABS[activeTab]?.role ?? '')}
              placeholder={t('users.search_placeholder')}
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, width: '100%', color: 'var(--text)' }}
            />
          </div>
          <button className="hidden md:inline-flex" style={{ ...btnSecSm, alignItems: 'center', gap: 6 }} onClick={() => fetchUsers(ROLE_TABS[activeTab]?.role ?? '')}><Search size={14} strokeWidth={2} /> Rechercher</button>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 26 }}>
            <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--red)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={15} strokeWidth={2} /> {error}</span>
            <button onClick={() => fetchUsers(ROLE_TABS[activeTab]?.role ?? '')}
              style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <div style={{ padding: '26px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
            {t('users.no_users')}
          </div>
        )}

        {!loading && !error && users.length > 0 && (
          <>
          {/* ── Cartes empilées — mobile ── */}
          <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
            {users.map((user) => {
              const rl = ROLE_LABEL[user.role] ?? { label: user.role, bg: 'var(--bg2)', color: 'var(--text2)' }
              const className = user.studentProfile?.class?.name ?? null
              const staffTitle = user.staffProfile?.title ?? null
              const ppClasses = user.classesProfessorPrincipal?.map((c: { name: string }) => c.name) ?? []
              const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
              return (
                <div key={user.id} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 16, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 16, right: 16 }}>
                    <button onClick={() => setOpenDD(openDD === user.id ? null : user.id)}
                      style={{ width: 28, height: 28, borderRadius: 10, background: 'none', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text3)' }}>
                      <MoreHorizontal size={15} strokeWidth={2} />
                    </button>
                    {openDD === user.id && (
                      <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 200, zIndex: 100, overflow: 'hidden' }}>
                        {[
                          { icon: Pencil, label: t('users.action_menu.edit'), danger: false, onClick: () => openModUser(user) },
                          ...(user.role === 'STUDENT' ? [
                            { icon: RefreshCw, label: t('users.action_menu.change_class'), danger: false, onClick: () => openTransfer(user) },
                            { icon: FileText, label: t('users.action_menu.generate_doc'), danger: false, onClick: () => openDocModal(user) },
                          ] : []),
                          { icon: Trash2, label: t('users.action_menu.delete'), danger: true, onClick: () => { setOpenDD(null); handleDelete(user.id) } },
                        ].map((item, j) => {
                          const ItemIcon: LucideIcon = item.icon
                          return (
                          <div key={j} onClick={item.onClick}
                            style={{ padding: '11px 12px', fontSize: 13, fontWeight: 600, color: item.danger ? 'var(--red)' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ItemIcon size={15} strokeWidth={2} /> {item.label}
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div className="w-[42px] h-[42px] rounded-[8px] text-[12px] font-bold flex-shrink-0" style={{ background: avatarColorFor(user.id), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 34 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{user.firstName} {user.lastName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email ?? '—'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={badge(rl.bg, rl.color)}>{rl.label}</span>
                    <span style={badge(user.isActive ? 'var(--green-light)' : 'var(--bg2)', user.isActive ? 'var(--green)' : 'var(--text2)')}>
                      {user.isActive ? t('users.i18n_ext.status.active') : t('users.i18n_ext.status.inactive')}
                    </span>
                    {className && <span style={badge('var(--bg2)', 'var(--text2)')}>{className}</span>}
                    {ppClasses.length > 0 && (
                      <span style={{ ...badge('var(--blue-light)', 'var(--blue)'), gap: 4 }}><School size={12} strokeWidth={2} /> PP {ppClasses[0]}</span>
                    )}
                    {staffTitle && (
                      staffTitle === 'Animateur Pédagogique'
                        ? <span style={{ ...badge('var(--green-light)', 'var(--green)'), gap: 4 }}><Star size={12} strokeWidth={2} /> AP</span>
                        : <span style={badge('var(--orange-light)', 'var(--orange)')}>{staffTitle}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bg2)' }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('users.i18n_ext.table.lastLogin')}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 700, marginTop: 2 }}>{formatLastLogin(user.lastLogin)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('users.i18n_ext.table.classTitle')}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500, marginTop: 2 }}>{className ?? staffTitle ?? (ppClasses[0] ? `PP ${ppClasses[0]}` : '—')}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Tableau — desktop ── */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>{[t('users.i18n_ext.table.user'), t('users.i18n_ext.table.role'), t('users.i18n_ext.table.status'), t('users.i18n_ext.table.lastLogin'), t('users.i18n_ext.table.classTitle'), t('users.i18n_ext.table.actions')].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const rl = ROLE_LABEL[user.role] ?? { label: user.role, bg: 'var(--bg2)', color: 'var(--text2)' }
                  const className = user.studentProfile?.class?.name ?? null
                  const staffTitle = user.staffProfile?.title ?? null
                  const ppClasses = user.classesProfessorPrincipal?.map((c: { name: string }) => c.name) ?? []
                  return (
                    <tr key={user.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{user.firstName} {user.lastName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{user.email ?? '—'}</div>
                      </td>
                      <td style={tdStyle}><span style={badge(rl.bg, rl.color)}>{rl.label}</span></td>
                      <td style={tdStyle}>
                        <span style={badge(user.isActive ? 'var(--green-light)' : 'var(--bg2)', user.isActive ? 'var(--green)' : 'var(--text2)')}>
                          {user.isActive ? t('users.i18n_ext.status.active') : t('users.i18n_ext.status.inactive')}
                        </span>
                      </td>
                      <td style={tdStyle}>{formatLastLogin(user.lastLogin)}</td>
                      <td style={tdStyle}>
                        {className ? <span style={badge('var(--bg2)', 'var(--text2)')}>{className}</span>
                          : ppClasses.length > 0
                            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <span style={{ ...badge('var(--blue-light)', 'var(--blue)'), gap: 4 }}><School size={12} strokeWidth={2} /> PP {ppClasses[0]}</span>
                                {staffTitle && (
                                  <span style={{ ...badge(staffTitle === 'Animateur Pédagogique' ? 'var(--green-light)' : 'var(--orange-light)', staffTitle === 'Animateur Pédagogique' ? 'var(--green)' : 'var(--orange)'), gap: 4 }}>
                                    {staffTitle === 'Animateur Pédagogique' ? <><Star size={12} strokeWidth={2} /> AP</> : staffTitle}
                                  </span>
                                )}
                              </div>
                          : (user.role === 'TEACHER' && staffTitle === 'Animateur Pédagogique')
                            ? <span style={{ ...badge('var(--green-light)', 'var(--green)'), gap: 4 }}><Star size={12} strokeWidth={2} /> AP</span>
                          : staffTitle ? <span style={badge('var(--orange-light)', 'var(--orange)')}>{staffTitle}</span>
                          : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button onClick={() => setOpenDD(openDD === user.id ? null : user.id)}
                            style={{ background: 'none', border: '1.5px solid var(--border2)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text3)', transition: 'all 0.12s' }}
                            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)', background: 'var(--green-light)' })}
                            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text3)', background: 'none' })}>
                            <MoreHorizontal size={16} strokeWidth={2} />
                          </button>
                          {openDD === user.id && (
                            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 200, zIndex: 100, overflow: 'hidden' }}>
                              {[
                                { icon: Pencil, label: t('users.action_menu.edit'), danger: false, onClick: () => openModUser(user) },
                                ...(user.role === 'STUDENT' ? [
                                  { icon: RefreshCw, label: t('users.action_menu.change_class'), danger: false, onClick: () => openTransfer(user) },
                                  { icon: FileText, label: t('users.action_menu.generate_doc'), danger: false, onClick: () => openDocModal(user) },
                                ] : []),
                                { icon: Trash2, label: t('users.action_menu.delete'), danger: true, onClick: () => { setOpenDD(null); handleDelete(user.id) } },
                              ].map((item, j) => {
                                const ItemIcon: LucideIcon = item.icon
                                return (
                                <div key={j} onClick={item.onClick}
                                  style={{ padding: '11px 12px', fontSize: 13, fontWeight: 600, color: item.danger ? 'var(--red)' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s' }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = item.danger ? 'var(--red-light)' : 'var(--bg2)'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                                  <ItemIcon size={15} strokeWidth={2} /> {item.label}
                                </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Modal invitation */}
      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onSuccess={msg => { onToast(msg, 'success'); setInviteOpen(false); fetchUsers(ROLE_TABS[activeTab]?.role ?? '') }}
          staffTitles={staffTitles}
        />
      )}

      {/* ── Modal modifier utilisateur ── */}
      {modUser.open && (
        <div onClick={() => setModUser(EMPTY_MOD_USER)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-5 py-5 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 10, width: 440, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div className="text-[18px] md:text-[18px] mb-[16px] md:mb-[22px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('users.edit_modal.title')}</div>
            <div className="gap-[10px] md:gap-[12px]" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <div className={sLbCls} style={sLb}>{t('users.edit_modal.first_name_label')}</div>
                <input className={sInCls} style={sIn} value={modUser.firstName} onChange={e => setModUser(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div>
                <div className={sLbCls} style={sLb}>{t('users.edit_modal.last_name_label')}</div>
                <input className={sInCls} style={sIn} value={modUser.lastName} onChange={e => setModUser(f => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className={sLbCls} style={sLb}>{t('users.edit_modal.email_label')}</div>
            <input className={sInCls} style={sIn} type="email" value={modUser.email} onChange={e => setModUser(f => ({ ...f, email: e.target.value }))} />
            {modUser.role === 'STUDENT' && (
              <div className="gap-[10px] md:gap-[12px] mt-[10px] md:mt-[12px]" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <div className={sLbCls} style={sLb}>{t('users.create_modal.dob_label')}</div>
                  <input className={sInCls} style={sIn} type="date" value={modUser.dateOfBirth} onChange={e => setModUser(f => ({ ...f, dateOfBirth: e.target.value }))} />
                </div>
                <div>
                  <div className={sLbCls} style={sLb}>{t('users.create_modal.gender_label')}</div>
                  <select className={sInCls} style={sIn} value={modUser.gender} onChange={e => setModUser(f => ({ ...f, gender: e.target.value }))}>
                    <option value="">—</option>
                    <option value="M">{t('users.i18n_ext.form.male')}</option>
                    <option value="F">{t('users.i18n_ext.form.female')}</option>
                  </select>
                </div>
              </div>
            )}
            {modUser.error && <div style={sErr}>{modUser.error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setModUser(EMPTY_MOD_USER)}>{t('users.i18n_ext.actions.cancel')}</button>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: modUser.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: modUser.loading ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={submitModUser} disabled={modUser.loading}>
                {modUser.loading ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : t('users.edit_modal.btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal changer de classe ── */}
      {transfer.open && (
        <div onClick={() => setTransfer(EMPTY_TRANSFER)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 10, width: 420, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('users.transfer_modal.title')}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>{t('users.transfer_modal.subtitle').replace('{name}', transfer.userName)}</div>
            <div className={sLbCls} style={sLb}>{t('users.transfer_modal.select_label')}</div>
            <select className={sInCls} style={sIn} value={transfer.classId} onChange={e => setTransfer(f => ({ ...f, classId: e.target.value }))}>
              <option value="">{t('users.i18n_ext.form.selectClass')}</option>
              {transfer.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {transfer.error && <div style={sErr}>{transfer.error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setTransfer(EMPTY_TRANSFER)}>{t('users.i18n_ext.actions.cancel')}</button>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: transfer.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: transfer.loading ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={submitTransfer} disabled={transfer.loading}>
                {transfer.loading ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : t('users.transfer_modal.btn_transfer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Générer document scolaire ── */}
      {docModal.open && (
        <div onClick={() => setDocModal(EMPTY_DOC_MODAL)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 10, width: 460, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('users.doc_modal.title')}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 15 }}>{docModal.userName}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: ClipboardList, label: t('users.doc_modal.certificat'), sub: t('users.i18n_ext.certificatSub'), type: 'certificat' as const },
                { icon: IdCard, label: t('users.doc_modal.carte'), sub: t('users.i18n_ext.carteSub'), type: 'carte' as const },
                { icon: Upload, label: t('users.doc_modal.lettre_transfert'), sub: t('users.i18n_ext.lettreTransfertSub'), type: 'lettre-transfert' as const, disabled: !['TRANSFERRED', 'LEFT', 'GRADUATED'].includes(docModal.status) },
              ].map(item => {
                const ItemIcon = item.icon
                return (
                <button key={item.type} disabled={item.disabled || docModal.loading}
                  onClick={() => generateDoc(item.type)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 8, border: `1.5px solid ${item.disabled ? 'var(--bg2)' : 'var(--border2)'}`, background: item.disabled ? 'var(--bg)' : 'white', cursor: item.disabled || docModal.loading ? 'not-allowed' : 'pointer', textAlign: 'left', fontFamily: 'inherit', opacity: item.disabled ? 0.45 : 1, transition: 'all 0.12s' }}
                  onMouseEnter={e => { if (!item.disabled && !docModal.loading) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', background: 'var(--green-light)' }) }}
                  onMouseLeave={e => { if (!item.disabled) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', background: 'var(--surface)' }) }}>
                  <ItemIcon size={16} strokeWidth={1.5} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{item.sub}</div>
                  </div>
                </button>
                )
              })}
            </div>
            {docModal.loading && <div style={{ marginTop: 16, textAlign: 'center', color: 'var(--green)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Loader2 size={14} strokeWidth={2} className="animate-spin" /> {t('users.doc_modal.loading')}</div>}
            {docModal.error && <div style={{ marginTop: 12, padding: '10px 11px', background: 'var(--red-light)', border: '1px solid var(--red-light)', borderRadius: 8, color: 'var(--red)', fontSize: 13 }}>{docModal.error}</div>}
            <button style={{ marginTop: 20, width: '100%', padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setDocModal(EMPTY_DOC_MODAL)}>{t('users.i18n_ext.actions.close')}</button>
          </div>
        </div>
      )}

      {/* ── Modal Import Excel ── */}
      {importOpen && (
        <ImportUsersWizardModal
          onClose={() => { setImportOpen(false) }}
          onToast={onToast}
          onSuccess={() => fetchUsers(ROLE_TABS[activeTab]?.role ?? '')}
        />
      )}

      {/* ── Modal créer un utilisateur ── */}
      {createOpen && (
        <div onClick={() => { setCreateOpen(false); setCreateForm(EMPTY_CREATE_USER) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-5 py-5 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 10, width: 540, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div className="text-[18px] md:text-[18px] mb-[16px] md:mb-[22px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('users.create_modal.title')}</div>

            <div className="gap-[10px] md:gap-[14px]" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <Field label={t('users.create_modal.first_name_label')}>
                <input value={createForm.firstName} onChange={e => setCreate('firstName', e.target.value)} placeholder="Marie" className={sInCls} style={sIn} />
              </Field>
              <Field label={t('users.create_modal.last_name_label')}>
                <input value={createForm.lastName} onChange={e => setCreate('lastName', e.target.value)} placeholder="Ngono" className={sInCls} style={sIn} />
              </Field>
            </div>

            {!isEleveMaternellePrimaire && (
              <>
                <Field label={t('users.create_modal.email_label')}>
                  <input type="email" value={createForm.email} onChange={e => setCreate('email', e.target.value)} placeholder="marie@lycee.cm" className={sInCls} style={sIn} />
                </Field>

                <Field label={t('users.create_modal.phone_label')}>
                  <input type="tel" value={createForm.phone} onChange={e => setCreate('phone', e.target.value)} placeholder="691234567" className={sInCls} style={sIn} />
                </Field>
              </>
            )}

            <Field label={t('users.create_modal.role_label')}>
              <select value={createForm.role} onChange={e => setCreate('role', e.target.value)} className={sInCls} style={sIn}>
                <option value="TEACHER">{t('users.invite_modal.role_teacher')}</option>
                <option value="STUDENT">{t('users.invite_modal.role_student')}</option>
                <option value="PARENT">{t('users.invite_modal.role_parent')}</option>
                <option value="STAFF">{t('users.invite_modal.role_staff')}</option>
              </select>
            </Field>

            {/* TEACHER — matières */}
            {createForm.role === 'TEACHER' && (
              <div>
                <div className={sLbCls} style={sLb}>{t('users.create_modal.subjects_label')}</div>
                <div style={{ border: '1.5px solid var(--border)', borderRadius: 8, maxHeight: 160, overflowY: 'auto', padding: 4 }}>
                  {availSubjects.length === 0 && <div style={{ padding: 12, color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>{t('users.i18n_ext.form.noSubjects')}</div>}
                  {availSubjects.map(sub => {
                    const checked = createForm.subjectIds.includes(sub.id)
                    return (
                      <label key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: checked ? 'var(--green-light)' : 'transparent' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSubjectId(sub.id)} style={{ accentColor: 'var(--green)', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{sub.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STUDENT — classe, date naissance, genre */}
            {createForm.role === 'STUDENT' && (
              <>
                <Field label={t('users.create_modal.class_label')}>
                  <select value={createForm.classeId} onChange={e => setCreate('classeId', e.target.value)} className={sInCls} style={sIn}>
                    <option value="">{t('users.i18n_ext.form.selectClass')}</option>
                    {availClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                {isEleveMaternellePrimaire && (
                  <div style={{ padding: '10px 11px', background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, color: 'var(--amber)', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                    {t('users.create_modal.maternellePrimaireNote')}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label={t('users.create_modal.dob_label')}>
                    <input type="date" value={createForm.dateOfBirth} onChange={e => setCreate('dateOfBirth', e.target.value)} className={sInCls} style={sIn} />
                  </Field>
                  <Field label={t('users.create_modal.gender_label')}>
                    <select value={createForm.gender} onChange={e => setCreate('gender', e.target.value)} className={sInCls} style={sIn}>
                      <option value="">—</option>
                      <option value="M">{t('users.i18n_ext.form.male')}</option>
                      <option value="F">{t('users.i18n_ext.form.female')}</option>
                    </select>
                  </Field>
                </div>
              </>
            )}

            {/* STAFF — titre */}
            {createForm.role === 'STAFF' && (
              <Field label={t('users.create_modal.staff_title_label')}>
                <select value={createForm.staffTitle} onChange={e => setCreate('staffTitle', e.target.value)} className={sInCls} style={sIn}>
                  <option value="">{t('users.i18n_ext.form.selectPost')}</option>
                  {staffTitles.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </Field>
            )}

            {createForm.error && <div style={sErr}>{createForm.error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setCreateOpen(false); setCreateForm(EMPTY_CREATE_USER) }}>{t('users.i18n_ext.actions.cancel')}</button>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: createForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: createForm.loading ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={submitCreateUser} disabled={createForm.loading}>
                {createForm.loading ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : t('users.create_modal.btn_create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ré-authentification avant suppression (Couche 1, §1.5) ── */}
      {reauthPourUserId && (
        <>
          <div onClick={() => !reauthLoading && setReauthPourUserId(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, width: '92%', maxWidth: 420, borderRadius: 10 }}>
            <div className="px-5 py-6 md:px-6 md:py-8" style={{ background: 'var(--surface)', borderRadius: 10, boxShadow: '0 32px 80px rgba(0,0,0,0.22)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <KeyRound size={15} color="var(--text)" />
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{t('users.reauth.title')}</span>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--text3)', marginTop: 0, marginBottom: 12 }}>{t('users.reauth.subtitle')}</p>

              <label className={sLbCls} style={sLb}>{t('users.reauth.password_label')}</label>
              <input type="password" autoFocus value={reauthPassword} onChange={e => setReauthPassword(e.target.value)}
                className={sInCls} style={sIn} onKeyDown={e => e.key === 'Enter' && handleReauthEtSupprimer()} />

              <label className={sLbCls} style={sLb}>{t('users.reauth.code_label')}</label>
              <input type="text" inputMode="numeric" value={reauthCode} onChange={e => setReauthCode(e.target.value)}
                className={sInCls} style={sIn} placeholder={t('users.reauth.code_placeholder')}
                onKeyDown={e => e.key === 'Enter' && handleReauthEtSupprimer()} />

              {reauthError && <div style={sErr}>{reauthError}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => setReauthPourUserId(null)} disabled={reauthLoading}>{t('users.i18n_ext.actions.cancel')}</button>
                <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: '#dc2626', color: 'white', border: 'none', cursor: reauthLoading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: reauthLoading ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={handleReauthEtSupprimer} disabled={reauthLoading}>
                  {reauthLoading ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : t('users.reauth.btn_confirm')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Pas de variante responsive ici (fonction utilitaire, pas de className injectable au call
// site) — taille fixe resserree vers la cible mobile de la maquette (11-13px).
// Couleur d'avatar déterministe (palette de l'app, pas celle de la maquette) — mobile uniquement.
const AVATAR_COLORS = ['var(--green)', 'var(--blue)', 'var(--amber)', 'var(--teal)', 'var(--purple)', 'var(--orange)']
function avatarColorFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

const badge = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
  borderRadius: 10, fontSize: 12.5, fontWeight: 800, background: bg, color, whiteSpace: 'nowrap'
})

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 14px', borderRadius: 11, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '7px 11px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }

const thStyle: React.CSSProperties = { padding: '11px 12px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '11px 12px', fontSize: 14, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
// Tailles resserrees vers la cible mobile — desktop inchangee via md: (meme technique que
// AdminSidebar/AdminTopbar). fontSize/padding/marginBottom retires de l'objet style (qui gagne
// toujours sur className) et portes par sLbCls/sInCls a la place.
const sLb: React.CSSProperties = { fontWeight: 700, color: 'var(--text3)' }
const sLbCls = 'text-[12px] md:text-[13px] mb-[4px] md:mb-[6px]'
const sIn: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
const sInCls = 'rounded-[10px] px-[12px] py-[9px] mb-[10px] text-[13px] md:px-[14px] md:py-[10px] md:mb-[14px] md:text-[12px]'
const sErr: React.CSSProperties = { background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 11px', fontSize: 13, fontWeight: 600, marginBottom: 8 }
