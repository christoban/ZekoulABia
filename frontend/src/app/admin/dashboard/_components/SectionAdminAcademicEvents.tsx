'use client'
import { useState, useEffect, useCallback } from 'react'
import { CalendarClock, Plus, X, Zap, Loader2, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

interface AcademicEvent {
  id: string
  type: string
  category: 'FIXED_DATE' | 'MANUAL_TRIGGER' | 'SLIDING_WINDOW'
  title: string
  description: string | null
  targetRoles: string[]
  openDate: string | null
  closeDate: string | null
  status: 'UPCOMING' | 'ACTIVE' | 'CLOSED'
  createdBy?: { firstName: string; lastName: string }
}

const EVENT_TYPES = ['RENTREE_6E_5E', 'MIGRATION_BILINGUE', 'CHOIX_LV2', 'CLOTURE_ANNEE', 'AUTRE']
const ROLES = ['ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT']

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  UPCOMING: { bg: 'var(--blue-light)', color: 'var(--blue)' },
  ACTIVE: { bg: 'var(--green-light)', color: 'var(--green)' },
  CLOSED: { bg: 'var(--bg2)', color: 'var(--text3)' },
}
const CATEGORY_COLOR: Record<string, { bg: string; color: string }> = {
  FIXED_DATE: { bg: 'var(--purple-light)', color: 'var(--purple)' },
  MANUAL_TRIGGER: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  SLIDING_WINDOW: { bg: 'var(--teal-light)', color: 'var(--teal)' },
}

export default function SectionAdminAcademicEvents({ onToast }: Props) {
  const t = useT('admin')
  const [events, setEvents] = useState<AcademicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustDate, setAdjustDate] = useState('')

  const [form, setForm] = useState({
    type: 'RENTREE_6E_5E', category: 'FIXED_DATE' as AcademicEvent['category'],
    title: '', description: '', targetRoles: ['ADMIN'] as string[],
    level: '', openDate: '', closeDate: '',
  })
  const [niveaux, setNiveaux] = useState<string[]>([])

  useEffect(() => {
    if (form.type !== 'CHOIX_LV2' || niveaux.length > 0) return
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setNiveaux([...new Set((d.data || []).map((c: any) => c.level).filter(Boolean))] as string[]) })
      .catch(() => {})
  }, [form.type, niveaux.length])

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/academic-events', { credentials: 'include' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || t('academicEvents.errorLoad'))
      setEvents(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('academicEvents.errorLoad'))
    } finally { setLoading(false) }
  }, [t])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const toggleRole = (role: string) => {
    setForm(f => ({ ...f, targetRoles: f.targetRoles.includes(role) ? f.targetRoles.filter(r => r !== role) : [...f.targetRoles, role] }))
  }

  const submitCreate = async () => {
    if (!form.title.trim()) { onToast(t('academicEvents.toastTitleRequired'), 'warning'); return }
    if (form.category === 'FIXED_DATE' && (!form.openDate || !form.closeDate)) { onToast(t('academicEvents.toastDatesRequired'), 'warning'); return }
    if (form.category === 'SLIDING_WINDOW' && !form.openDate) { onToast(t('academicEvents.toastOpenRequired'), 'warning'); return }
    if (form.type === 'CHOIX_LV2' && !form.level) { onToast(t('academicEvents.toastLevelRequired'), 'warning'); return }

    setSubmitting(true)
    try {
      const res = await fetchApi('/api/v2/academic-events', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          level: form.type === 'CHOIX_LV2' ? form.level : undefined,
          openDate: form.openDate || undefined,
          closeDate: form.closeDate || undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast(t('academicEvents.toastCreated'), 'success')
      setFormOpen(false)
      setForm({ type: 'RENTREE_6E_5E', category: 'FIXED_DATE', title: '', description: '', targetRoles: ['ADMIN'], level: '', openDate: '', closeDate: '' })
      fetchEvents()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academicEvents.errorLoad'), 'error')
    } finally { setSubmitting(false) }
  }

  const declencher = async (id: string) => {
    try {
      const res = await fetchApi(`/api/v2/academic-events/${id}/trigger`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast(t('academicEvents.toastTriggered'), 'success')
      fetchEvents()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academicEvents.errorLoad'), 'error')
    }
  }

  const ajuster = async (id: string) => {
    if (!adjustDate) return
    try {
      const res = await fetchApi(`/api/v2/academic-events/${id}/window`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closeDate: adjustDate }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast(t('academicEvents.toastAdjusted'), 'success')
      setAdjustingId(null); setAdjustDate('')
      fetchEvents()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academicEvents.errorLoad'), 'error')
    }
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const total = events.length
  const actifs = events.filter(e => e.status === 'ACTIVE').length
  const aVenir = events.filter(e => e.status === 'UPCOMING').length
  const clos = events.filter(e => e.status === 'CLOSED').length

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ overflowY: 'auto', height: '100%' }}>
      <div className="mb-[16px] md:mb-[16px]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="text-[18px] md:text-[18px]" style={sTitle}>{t('academicEvents.title')}</div>
          <div className="text-[12px] md:text-[13px]" style={sSub}>{t('academicEvents.subtitle')}</div>
        </div>
        <button onClick={() => setFormOpen(true)} className="rounded-full md:rounded-[10px] text-[12px] md:text-[13px] px-[14px] md:px-[16px] py-[9px] md:py-[8px]" style={{ ...btnPrim, borderRadius: undefined, padding: undefined, fontSize: undefined, fontWeight: 700 }}>
          <Plus size={15} strokeWidth={2.5} /> {t('academicEvents.newEvent')}
        </button>
      </div>

      {!loading && !error && events.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px] md:gap-3 mb-[18px] md:mb-[18px]">
          {[
            { icon: CalendarClock, value: total, label: t('academicEvents.kpiTotal') },
            { icon: Zap, value: actifs, label: t('academicEvents.kpiActive') },
            { icon: Clock, value: aVenir, label: t('academicEvents.kpiUpcoming') },
            { icon: CheckCircle2, value: clos, label: t('academicEvents.kpiClosed') },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-[10px] p-[12px] md:px-3.5 md:py-3 shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)' }}>
              <div style={{ marginBottom: 6 }}><Icon size={15} /></div>
              <div className="text-[13px] md:text-[18px] font-black md:font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>{value}</div>
              <div className="text-[11.5px] md:text-[12px]" style={{ color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 25 }}>
          <Loader2 size={16} className="animate-spin" color="var(--green)" />
        </div>
      )}

      {!loading && error && (
        <div className="flex-wrap gap-[10px] md:gap-[12px] px-[16px] py-2.5 md:px-[22px] md:py-[18px]" style={{ background: 'var(--red-light)', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
          <AlertTriangle size={15} color="var(--red)" /><span className="text-[13px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchEvents} className="w-full md:w-auto text-[12.5px] md:text-[12px] px-[12px] md:px-[14px] py-[6px] md:py-[6px]" style={{ ...btnRetry, padding: undefined }}>{t('academicEvents.retry')}</button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="px-[24px] py-[40px] md:px-[32px] md:py-[48px]" style={{ background: 'var(--surface)', borderRadius: 8, border: '1.5px solid var(--border)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><CalendarClock size={16} className="md:hidden" /><CalendarClock size={16} className="hidden md:block" /></div>
          <div className="text-[13px] md:text-[12px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('academicEvents.emptyTitle')}</div>
          <div className="text-[13px] md:text-[13px]" style={{ color: 'var(--text3)' }}>{t('academicEvents.emptySub')}</div>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map(ev => (
            <div key={ev.id} className="rounded-[10px] md:rounded-[10px] p-[15px] md:px-4 md:py-3.5 shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)' }}>
              <div className="mb-[8px] gap-[8px]" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div className="text-[12px] md:text-[13px]" style={{ fontWeight: 800, color: 'var(--text)', flex: 1 }}>{ev.title}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="text-[10.5px] md:text-[12px]" style={{ padding: '2px 8px', borderRadius: 8, fontWeight: 800, background: CATEGORY_COLOR[ev.category]?.bg, color: CATEGORY_COLOR[ev.category]?.color }}>
                    {t(`academicEvents.category.${ev.category}`)}
                  </span>
                  <span className="text-[10.5px] md:text-[12px]" style={{ padding: '2px 8px', borderRadius: 8, fontWeight: 800, background: STATUS_COLOR[ev.status]?.bg, color: STATUS_COLOR[ev.status]?.color }}>
                    {t(`academicEvents.status.${ev.status}`)}
                  </span>
                </div>
              </div>
              {ev.description && <div className="text-[13px] md:text-[12px]" style={{ color: 'var(--text3)', marginBottom: 8 }}>{ev.description}</div>}
              <div className="text-[11.5px] md:text-[12px] gap-[4px] md:gap-3" style={{ color: 'var(--text3)', display: 'flex', flexDirection: 'column' }}>
                <span>{t('academicEvents.opensOn')} {fmt(ev.openDate)} · {t('academicEvents.closesOn')} {fmt(ev.closeDate)}</span>
                <span>{t('academicEvents.roles')} {ev.targetRoles.join(', ')}</span>
              </div>

              {ev.category === 'MANUAL_TRIGGER' && ev.status === 'UPCOMING' && (
                <button onClick={() => declencher(ev.id)}
                  className="w-full md:w-auto justify-center md:justify-start text-[12.5px] md:text-[13px] px-[16px] md:px-[16px] py-[9px] md:py-[8px] rounded-[10px] md:rounded-[8px]"
                  style={{ ...btnPrim, padding: undefined, fontSize: undefined, marginTop: 12 }}>
                  <Zap size={14} /> {t('academicEvents.triggerNow')}
                </button>
              )}

              {ev.category === 'SLIDING_WINDOW' && ev.status === 'ACTIVE' && (
                adjustingId === ev.id ? (
                  <div className="flex-wrap md:flex-nowrap" style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                    <input type="date" value={adjustDate} onChange={e => setAdjustDate(e.target.value)} className="flex-1 md:flex-none min-w-[140px] text-[13px] md:text-[12px] px-[9px] md:px-[10px] py-[6px] md:py-[7px]" style={{ ...inputSt, padding: undefined, fontSize: undefined }} />
                    <button onClick={() => ajuster(ev.id)} className="text-[12.5px] md:text-[13px] px-[14px] md:px-[16px] py-[7px] md:py-[8px]" style={{ ...btnPrim, padding: undefined, fontSize: undefined }}>{t('academicEvents.save')}</button>
                    <button onClick={() => { setAdjustingId(null); setAdjustDate('') }} className="text-[12.5px] md:text-[13px] px-[12px] md:px-[14px] py-[7px] md:py-[8px]" style={{ ...btnSec, padding: undefined, fontSize: undefined }}>{t('academicEvents.cancel')}</button>
                  </div>
                ) : (
                  <button onClick={() => setAdjustingId(ev.id)}
                    className="w-full md:w-auto justify-center md:justify-start text-[12.5px] md:text-[13px] px-[14px] md:px-[14px] py-[8px] md:py-[8px]"
                    style={{ ...btnSec, padding: undefined, fontSize: undefined, marginTop: 12, display: 'inline-flex', alignItems: 'center' }}>{t('academicEvents.adjustWindow')}</button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div onClick={() => setFormOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="p-5 md:p-5 rounded-[10px] w-[480px] max-w-[94vw] max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
              <div className="text-[13px] md:text-[13px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('academicEvents.newEvent')}</div>
              <button onClick={() => setFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={15} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className={labelStCls} style={labelSt}>{t('academicEvents.formTitle')}</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputFullStCls} style={inputFullSt} placeholder={t('academicEvents.formTitlePlaceholder')} />
              </div>
              <div>
                <label className={labelStCls} style={labelSt}>{t('academicEvents.formType')}</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inputFullStCls} style={inputFullSt}>
                  {EVENT_TYPES.map(ty => <option key={ty} value={ty}>{t(`academicEvents.type.${ty}`)}</option>)}
                </select>
              </div>
              {form.type === 'CHOIX_LV2' && (
                <div>
                  <label className={labelStCls} style={labelSt}>{t('academicEvents.formLevel')}</label>
                  <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} className={inputFullStCls} style={inputFullSt}>
                    <option value="">{t('academicEvents.formLevelPlaceholder')}</option>
                    {niveaux.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t('academicEvents.formLevelHint')}</div>
                </div>
              )}
              <div>
                <label className={labelStCls} style={labelSt}>{t('academicEvents.formCategory')}</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as AcademicEvent['category'] }))} className={inputFullStCls} style={inputFullSt}>
                  <option value="FIXED_DATE">{t('academicEvents.category.FIXED_DATE')}</option>
                  <option value="MANUAL_TRIGGER">{t('academicEvents.category.MANUAL_TRIGGER')}</option>
                  <option value="SLIDING_WINDOW">{t('academicEvents.category.SLIDING_WINDOW')}</option>
                </select>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t(`academicEvents.categoryHint.${form.category}`)}</div>
              </div>
              <div>
                <label className={labelStCls} style={labelSt}>{t('academicEvents.formDescription')}</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputFullStCls} style={{ ...inputFullSt, minHeight: 60, resize: 'vertical' }} />
              </div>
              <div>
                <label className={labelStCls} style={labelSt}>{t('academicEvents.formRoles')}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ROLES.map(role => (
                    <button key={role} type="button" onClick={() => toggleRole(role)}
                      className="text-[12px] md:text-[13px] px-[11px] md:px-[14px] py-[5px] md:py-[6px]"
                      style={{ borderRadius: 8, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit',
                        background: form.targetRoles.includes(role) ? 'var(--green-light)' : 'white',
                        borderColor: form.targetRoles.includes(role) ? 'var(--green)' : 'var(--border2)',
                        color: form.targetRoles.includes(role) ? 'var(--green)' : 'var(--text2)' }}>
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              {form.category !== 'MANUAL_TRIGGER' && (
                <div>
                  <label className={labelStCls} style={labelSt}>{t('academicEvents.formOpenDate')}</label>
                  <input type="date" value={form.openDate} onChange={e => setForm(f => ({ ...f, openDate: e.target.value }))} className={inputFullStCls} style={inputFullSt} />
                </div>
              )}
              {form.category !== 'MANUAL_TRIGGER' && (
                <div>
                  <label className={labelStCls} style={labelSt}>{t('academicEvents.formCloseDate')}</label>
                  <input type="date" value={form.closeDate} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))} className={inputFullStCls} style={inputFullSt} />
                </div>
              )}

              <button onClick={submitCreate} disabled={submitting}
                className="w-full text-[13px] md:text-[13px] px-[16px] md:px-[16px] py-[10px] md:py-[8px]"
                style={{ ...btnPrim, padding: undefined, fontSize: undefined, justifyContent: 'center', marginTop: 8, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {t('academicEvents.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnSec: React.CSSProperties = { padding: '8px 11px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '6px 11px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const labelStCls = 'text-[12px] md:text-[13px] mb-[4px] md:mb-[5px]'
const labelSt: React.CSSProperties = { display: 'block', fontWeight: 700, color: 'var(--text2)' }
const inputFullStCls = 'rounded-[10px] md:rounded-[9px] px-[12px] py-[9px] text-[13px] md:text-[13px]'
const inputFullSt: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border2)', fontFamily: 'inherit', color: 'var(--text)', background: 'var(--bg2)', outline: 'none', boxSizing: 'border-box' }
const inputSt: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border2)', fontSize: 12, fontFamily: 'inherit', color: 'var(--text)', background: 'var(--bg2)', outline: 'none' }
