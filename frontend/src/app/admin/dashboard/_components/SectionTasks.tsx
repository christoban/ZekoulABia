'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Loader2, AlertTriangle, ListChecks, CalendarDays, UserRound } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

interface TaskItem {
  id: string
  schoolId: string
  title: string
  description: string | null
  assignedById: string
  assignedToId: string
  dueDate: string | null
  status: 'A_FAIRE' | 'EN_COURS' | 'TERMINE' | 'VALIDE'
  attachments: string[]
  comments: { authorId: string; text: string; createdAt: string }[]
  createdAt: string
}

const STATUS: Record<TaskItem['status'], { label: string; bg: string; color: string }> = {
  A_FAIRE: { label: 'tasks.status.A_FAIRE', bg: 'var(--amber-light)', color: 'var(--amber)' },
  EN_COURS: { label: 'tasks.status.EN_COURS', bg: 'var(--blue-light)', color: 'var(--blue)' },
  TERMINE: { label: 'tasks.status.TERMINE', bg: 'var(--purple-light)', color: 'var(--purple)' },
  VALIDE: { label: 'tasks.status.VALIDE', bg: 'var(--green-light)', color: 'var(--green)' },
}

const TRANSITIONS: Record<TaskItem['status'], TaskItem['status'][]> = {
  A_FAIRE: ['EN_COURS', 'TERMINE'],
  EN_COURS: ['TERMINE', 'A_FAIRE'],
  TERMINE: ['VALIDE', 'EN_COURS'],
  VALIDE: [],
}

export default function SectionTasks({ onToast }: Props) {
  const t = useT('admin')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string; role: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', assignedToId: '', dueDate: '' })

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/tasks', { credentials: 'include' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || t('tasks.errorLoad'))
      setTasks(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tasks.errorLoad'))
    } finally { setLoading(false) }
  }, [t])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  useEffect(() => {
    fetchApi('/api/v2/users', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setUsers((d.data || []).filter((u: any) => u.role === 'STAFF' || u.role === 'ADMIN')) })
      .catch(() => {})
  }, [])

  const submitCreate = async () => {
    if (!form.title.trim()) { onToast(t('tasks.toastTitleRequired'), 'warning'); return }
    if (!form.assignedToId) { onToast(t('tasks.toastAssigneeRequired'), 'warning'); return }
    setSubmitting(true)
    try {
      const res = await fetchApi('/api/v2/tasks', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, description: form.description, assignedToId: form.assignedToId, dueDate: form.dueDate || undefined }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast(t('tasks.toastCreated'), 'success')
      setFormOpen(false)
      setForm({ title: '', description: '', assignedToId: '', dueDate: '' })
      fetchTasks()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('tasks.errorLoad'), 'error')
    } finally { setSubmitting(false) }
  }

  const changerStatut = async (task: TaskItem, statut: TaskItem['status']) => {
    try {
      const res = await fetchApi(`/api/v2/tasks/${task.id}/status`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statut }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast(t('tasks.toastStatusUpdated'), 'success')
      fetchTasks()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('tasks.errorLoad'), 'error')
    }
  }

  const nomAssigné = (id: string) => {
    const u = users.find(x => x.id === id)
    return u ? `${u.firstName} ${u.lastName}` : id.slice(0, 8)
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const counts = { A_FAIRE: 0, EN_COURS: 0, TERMINE: 0, VALIDE: 0 } as Record<TaskItem['status'], number>
  tasks.forEach(tk => { counts[tk.status]++ })

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ overflowY: 'auto', height: '100%' }}>
      <div className="mb-[16px] md:mb-[20px]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="text-[18px] md:text-[18px]" style={sTitle}>{t('tasks.title')}</div>
          <div className="text-[12px] md:text-[13px]" style={sSub}>{t('tasks.subtitle')}</div>
        </div>
        <button onClick={() => setFormOpen(true)} className="rounded-full md:rounded-[10px] text-[12px] md:text-[13px] px-[14px] md:px-[16px] py-[9px] md:py-[8px]" style={{ ...btnPrim, borderRadius: undefined, padding: undefined, fontSize: undefined, fontWeight: 700 }}>
          <Plus size={15} strokeWidth={2.5} /> {t('tasks.newTask')}
        </button>
      </div>

      {!loading && !error && tasks.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px] md:gap-[14px] mb-[18px] md:mb-[24px]">
          {(['A_FAIRE', 'EN_COURS', 'TERMINE', 'VALIDE'] as const).map(st => (
            <div key={st} className="rounded-[10px] p-[12px] md:px-3.5 md:py-3" style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}>
              <div style={{ marginBottom: 6 }}><ListChecks size={15} /></div>
              <div className="text-[16px] md:text-[18px] font-black md:font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>{counts[st]}</div>
              <div className="text-[11.5px] md:text-[12px]" style={{ color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{t(STATUS[st].label)}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 39 }}>
          <Loader2 size={16} className="animate-spin" color="var(--green)" />
        </div>
      )}

      {!loading && error && (
        <div className="flex-wrap gap-[10px] md:gap-[12px] px-[16px] py-2.5 md:px-[22px] md:py-[18px]" style={{ background: 'var(--red-light)', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
          <AlertTriangle size={15} color="var(--red)" /><span className="text-[13px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchTasks} className="w-full md:w-auto text-[12.5px] md:text-[12px] px-[12px] md:px-[14px] py-[6px] md:py-[6px]" style={{ ...btnRetry, padding: undefined }}>{t('tasks.retry')}</button>
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="px-[24px] py-[40px] md:px-[32px] md:py-[60px]" style={{ background: 'var(--surface)', borderRadius: 10, border: '1.5px solid var(--border)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><ListChecks size={16} /></div>
          <div className="text-[13px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('tasks.emptyTitle')}</div>
          <div className="text-[13px] md:text-[13px]" style={{ color: 'var(--text3)' }}>{t('tasks.emptySub')}</div>
        </div>
      )}

      {!loading && !error && tasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map(tk => (
            <div key={tk.id} className="rounded-[10px] md:rounded-[10px] p-[15px] md:px-[22px] md:py-[18px]" style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}>
              <div className="mb-[8px] gap-[8px]" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div className="text-[14.5px] md:text-[16px]" style={{ fontWeight: 800, color: 'var(--text)', flex: 1 }}>{tk.title}</div>
                <span className="text-[10.5px] md:text-[12px]" style={{ padding: '2px 8px', borderRadius: 10, fontWeight: 800, background: STATUS[tk.status].bg, color: STATUS[tk.status].color }}>
                  {t(STATUS[tk.status].label)}
                </span>
              </div>
              {tk.description && <div className="text-[13px] md:text-[12px]" style={{ color: 'var(--text3)', marginBottom: 8 }}>{tk.description}</div>}
              <div className="text-[11.5px] md:text-[12px] gap-[4px] md:gap-3" style={{ color: 'var(--text3)', display: 'flex', flexDirection: 'column' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><UserRound size={13} /> {t('tasks.assignedTo')} {nomAssigné(tk.assignedToId)}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CalendarDays size={13} /> {t('tasks.due')} {fmt(tk.dueDate)}</span>
              </div>

              {TRANSITIONS[tk.status].length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {TRANSITIONS[tk.status].map(tr => (
                    <button key={tr} onClick={() => changerStatut(tk, tr)} className="text-[12.5px] md:text-[12px] px-[12px] md:px-[14px] py-[7px] md:py-[8px]" style={{ ...btnSec, padding: undefined, fontSize: undefined }}>{t(`tasks.actions.${tr}`)}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div onClick={() => setFormOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="p-5 md:p-7 rounded-[10px] w-[480px] max-w-[94vw] max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
              <div className="text-[18px] md:text-[16px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('tasks.newTask')}</div>
              <button onClick={() => setFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={15} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className={labelStCls} style={labelSt}>{t('tasks.formTitle')}</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputFullStCls} style={inputFullSt} />
              </div>
              <div>
                <label className={labelStCls} style={labelSt}>{t('tasks.formDescription')}</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputFullStCls} style={{ ...inputFullSt, minHeight: 60, resize: 'vertical' }} />
              </div>
              <div>
                <label className={labelStCls} style={labelSt}>{t('tasks.formAssignee')}</label>
                <select value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))} className={inputFullStCls} style={inputFullSt}>
                  <option value="">{t('tasks.formAssigneePlaceholder')}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>)}
                </select>
              </div>
              <div>
                <label className={labelStCls} style={labelSt}>{t('tasks.formDueDate')}</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inputFullStCls} style={inputFullSt} />
              </div>

              <button onClick={submitCreate} disabled={submitting}
                className="w-full text-[13.5px] md:text-[13px] px-[16px] md:px-[16px] py-[10px] md:py-[8px]"
                style={{ ...btnPrim, padding: undefined, fontSize: undefined, justifyContent: 'center', marginTop: 8, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {t('tasks.create')}
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
