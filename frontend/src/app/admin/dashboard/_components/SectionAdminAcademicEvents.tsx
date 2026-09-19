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

  // Chargée seulement au besoin (type CHOIX_LV2) — mêmes niveaux que ceux utilisés par l'écran
  // de suivi LV2 existant (dérivés des classes réelles de l'établissement).
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
      if (!data.success) throw new Error(data.message || 'Erreur lors du chargement des événements')
      setEvents(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des événements')
    } finally { setLoading(false) }
  }, [])

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
    <div className="px-4 py-4 md:px-6 md:py-5" style={{ overflowY: 'auto', height: '100%' }}>
      <div className="mb-[12px] md:mb-[14px]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="text-[15px] md:text-[17px]" style={sTitle}>{t('academicEvents.title')} — Campagnes Saisonnières</div>
          <div className="text-[11px] md:text-[12px]" style={sSub}>{t('academicEvents.subtitle')}</div>
        </div>
        <button onClick={() => setFormOpen(true)} className="rounded-lg text-xs md:text-[12.5px] px-3 py-1.5" style={{ ...btnPrim, fontWeight: 700 }}>
          <Plus size={14} strokeWidth={2.5} /> {t('academicEvents.newEvent')}
        </button>
      </div>

      {/* RACI Academic Events Banner */}
      <div className="mb-3.5 p-2.5 md:p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 text-xs text-[var(--text)] flex items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-purple-500/15 text-purple-600 flex-shrink-0">
            <CalendarClock size={15} />
          </div>
          <div>
            <p className="font-bold text-[11.5px] md:text-xs">Gestion des Campagnes Événementielles</p>
            <p className="text-[10.5px] md:text-[11px] text-[var(--text2)]">L'Administrateur déclenche et planifie les fenêtres d'événements (Choix LV2, Concours 6e, PEBS). Les sous-menus associés apparaissent dans la navigation uniquement lors des périodes d'ouverture.</p>
          </div>
        </div>
      </div>

      {!loading && !error && events.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[8px] md:gap-[10px] mb-[12px] md:mb-[16px]">
          {[
            { icon: CalendarClock, value: total, label: t('academicEvents.kpiTotal') },
            { icon: Zap, value: actifs, label: t('academicEvents.kpiActive') },
            { icon: Clock, value: aVenir, label: t('academicEvents.kpiUpcoming') },
            { icon: CheckCircle2, value: clos, label: t('academicEvents.kpiClosed') },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-xl p-[10px] md:px-[12px] md:py-[10px] border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
              <div style={{ marginBottom: 4 }}><Icon size={17} /></div>
              <div className="text-[17px] md:text-[20px] font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>{value}</div>
              <div className="text-[10.5px] md:text-[11.5px]" style={{ color: 'var(--text3)', fontWeight: 600, marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={24} className="animate-spin" color="var(--green)" />
        </div>
      )}

      {!loading && error && (
        <div className="flex-wrap gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl" style={{ background: 'var(--red-light)', display: 'flex', alignItems: 'center' }}>
          <AlertTriangle size={16} color="var(--red)" /><span className="text-xs md:text-[13px]" style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchEvents} className="w-full md:w-auto text-xs px-2.5 py-1 rounded-lg" style={btnRetry}>{t('academicEvents.retry')}</button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="px-4 py-8 md:px-6 md:py-10 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><CalendarClock size={36} /></div>
          <div className="text-sm md:text-base" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('academicEvents.emptyTitle')}</div>
          <div className="text-xs md:text-[13px]" style={{ color: 'var(--text3)' }}>{t('academicEvents.emptySub')}</div>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map(ev => (
            <div key={ev.id} className="rounded-xl p-3 md:px-4 md:py-3.5 border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
              <div className="mb-1.5 gap-2" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div className="text-[13.5px] md:text-[15px]" style={{ fontWeight: 700, color: 'var(--text)', flex: 1 }}>{ev.title}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="text-[10px] md:text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: CATEGORY_COLOR[ev.category]?.bg, color: CATEGORY_COLOR[ev.category]?.color }}>
                    {t(`academicEvents.category.${ev.category}`)}
                  </span>
                  <span className="text-[10px] md:text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: STATUS_COLOR[ev.status]?.bg, color: STATUS_COLOR[ev.status]?.color }}>
                    {t(`academicEvents.status.${ev.status}`)}
                  </span>
                </div>
              </div>
              {ev.description && <div className="text-xs md:text-[12.5px]" style={{ color: 'var(--text3)', marginBottom: 6 }}>{ev.description}</div>}
              <div className="text-[11px] md:text-xs gap-1" style={{ color: 'var(--text3)', display: 'flex', flexDirection: 'column' }}>
                <span>{t('academicEvents.opensOn')} {fmt(ev.openDate)} · {t('academicEvents.closesOn')} {fmt(ev.closeDate)}</span>
                <span>{t('academicEvents.roles')} {ev.targetRoles.join(', ')}</span>
              </div>

              {ev.category === 'MANUAL_TRIGGER' && ev.status === 'UPCOMING' && (
                <button onClick={() => declencher(ev.id)}
                  className="w-full md:w-auto justify-center md:justify-start text-xs md:text-[12.5px] px-3 py-1.5 rounded-lg"
                  style={{ ...btnPrim, marginTop: 10 }}>
                  <Zap size={13} /> {t('academicEvents.triggerNow')}
                </button>
              )}

              {ev.category === 'SLIDING_WINDOW' && ev.status === 'ACTIVE' && (
                adjustingId === ev.id ? (
                  <div className="flex-wrap md:flex-nowrap" style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
                    <input type="date" value={adjustDate} onChange={e => setAdjustDate(e.target.value)} className="flex-1 md:flex-none min-w-[130px] text-xs px-2 py-1 rounded-lg" style={inputSt} />
                    <button onClick={() => ajuster(ev.id)} className="text-xs px-3 py-1.5 rounded-lg" style={btnPrim}>{t('academicEvents.save')}</button>
                    <button onClick={() => { setAdjustingId(null); setAdjustDate('') }} className="text-xs px-2.5 py-1.5 rounded-lg" style={btnSec}>{t('academicEvents.cancel')}</button>
                  </div>
                ) : (
                  <button onClick={() => setAdjustingId(ev.id)}
                    className="w-full md:w-auto justify-center md:justify-start text-xs md:text-[12.5px] px-3 py-1.5 rounded-lg"
                    style={{ ...btnSec, marginTop: 10, display: 'inline-flex', alignItems: 'center' }}>{t('academicEvents.adjustWindow')}</button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div onClick={() => setFormOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="p-4 md:p-5 rounded-xl w-[440px] max-w-[94vw] max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="text-[15px] md:text-[16px] font-bold" style={{ color: 'var(--text)' }}>{t('academicEvents.newEvent')}</div>
              <button onClick={() => setFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
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
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t('academicEvents.formLevelHint')}</div>
                </div>
              )}
              <div>
                <label className={labelStCls} style={labelSt}>{t('academicEvents.formCategory')}</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as AcademicEvent['category'] }))} className={inputFullStCls} style={inputFullSt}>
                  <option value="FIXED_DATE">{t('academicEvents.category.FIXED_DATE')}</option>
                  <option value="MANUAL_TRIGGER">{t('academicEvents.category.MANUAL_TRIGGER')}</option>
                  <option value="SLIDING_WINDOW">{t('academicEvents.category.SLIDING_WINDOW')}</option>
                </select>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t(`academicEvents.categoryHint.${form.category}`)}</div>
              </div>
              <div>
                <label className={labelStCls} style={labelSt}>{t('academicEvents.formDescription')}</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputFullStCls} style={{ ...inputFullSt, minHeight: 52, resize: 'vertical' }} />
              </div>
              <div>
                <label className={labelStCls} style={labelSt}>{t('academicEvents.formRoles')}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ROLES.map(role => (
                    <button key={role} type="button" onClick={() => toggleRole(role)}
                      className="text-[11px] md:text-xs px-2.5 py-1 rounded-full"
                      style={{ fontWeight: 700, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit',
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
                className="w-full text-xs md:text-[13px] px-3 py-2 rounded-lg font-bold"
                style={{ ...btnPrim, justifyContent: 'center', marginTop: 4, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {t('academicEvents.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }
const btnSec: React.CSSProperties = { padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '5px 11px', borderRadius: 7, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }
const labelStCls = 'text-[11px] md:text-xs mb-1 font-bold block'
const labelSt: React.CSSProperties = { color: 'var(--text2)' }
const inputFullStCls = 'w-full rounded-lg px-2.5 py-1.5 text-xs md:text-[13px]'
const inputFullSt: React.CSSProperties = { border: '1.5px solid var(--border2)', fontFamily: 'inherit', color: 'var(--text)', background: 'var(--bg2)', outline: 'none', boxSizing: 'border-box' }
const inputSt: React.CSSProperties = { padding: '5px 9px', borderRadius: 7, border: '1.5px solid var(--border2)', fontSize: 12, fontFamily: 'inherit', color: 'var(--text)', background: 'var(--bg2)', outline: 'none' }
