'use client'
import { useCallback, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { ListChecks, CalendarClock, MessageSquareWarning, StickyNote, UserCheck } from 'lucide-react'

interface FollowUpAction {
  id: string
  studentId: string
  studentName: string
  className: string | null
  type: 'ENTRETIEN_PARENT' | 'SIGNALEMENT_CONSEILLER' | 'OBSERVATION' | 'CONVOCATION_ELEVE'
  status: 'OUVERT' | 'EN_COURS' | 'CLOS'
  createdByName: string
  assignedToName: string | null
  targetDate: string | null
  interviewMode: 'DATE_PROPOSEE' | 'DEMANDE_DISPONIBILITE' | null
  note: string | null
  createdAt: string
}

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const ICONS = { ENTRETIEN_PARENT: CalendarClock, SIGNALEMENT_CONSEILLER: MessageSquareWarning, OBSERVATION: StickyNote, CONVOCATION_ELEVE: UserCheck } as const

export default function SectionMesActionsSuivi({ onToast }: Props) {
  const t = useT('teacher')
  const [closingId, setClosingId] = useState<string | null>(null)
  const [closingNote, setClosingNote] = useState('')

  const fetchFn = useCallback(async (): Promise<FollowUpAction[]> => {
    const res = await fetchApi('/api/v2/student-follow-up/mine', { credentials: 'include' })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Erreur')
    return data.data
  }, [])

  const { data, loading, error, refetch } = useCachedFetch<FollowUpAction[]>('teacher:mes-actions-suivi', fetchFn)
  const actions = data ?? []

  const clore = async (actionId: string) => {
    if (!closingNote.trim()) { onToast(t('suivi.note_cloture_requise'), 'error'); return }
    try {
      const res = await fetchApi(`/api/v2/student-follow-up/${actionId}/close`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closingNote }),
      })
      const resData = await res.json()
      if (resData.success) {
        onToast(t('suivi.action_cloturee'), 'success')
        setClosingId(null); setClosingNote('')
        refetch()
      } else {
        onToast(resData.message || t('suivi.erreur'), 'error')
      }
    } catch { onToast(t('suivi.erreur'), 'error') }
  }

  const labelType = {
    ENTRETIEN_PARENT: t('suivi.type_entretien'),
    SIGNALEMENT_CONSEILLER: t('suivi.type_signalement'),
    OBSERVATION: t('suivi.type_observation'),
    CONVOCATION_ELEVE: t('suivi.type_convocation'),
  } as const

  if (loading) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{t('at_risk.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{t('at_risk.load_error')}</div>
          <button onClick={refetch}
            style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('at_risk.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={sTitle}>{t('suivi.page_title')}</div>
        <div style={sSub}>{t('suivi.page_subtitle')}</div>
      </div>

      {actions.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 36, textAlign: 'center', maxWidth: 440 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><ListChecks size={32} color="var(--green)" /></div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            {t('suivi.empty_title')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 500 }}>{t('suivi.empty_sub')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {actions.map((a) => {
            const Icon = ICONS[a.type]
            return (
              <div key={a.id} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={16} color="var(--blue)" />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{a.studentName}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600 }}>{a.className ?? '—'}</div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                    background: a.status === 'EN_COURS' ? 'var(--amber-light)' : 'var(--bg2)',
                    color: a.status === 'EN_COURS' ? 'var(--amber)' : 'var(--text2)',
                  }}>
                    {labelType[a.type]}
                  </span>
                </div>

                {a.note && <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 8 }}>{a.note}</div>}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                  {t('suivi.cree_par').replace('{name}', a.createdByName)}
                  {a.targetDate && ` · ${new Date(a.targetDate).toLocaleDateString()}`}
                </div>

                {a.status === 'CLOS' ? null : closingId === a.id ? (
                  <div style={{ marginTop: 10 }}>
                    <textarea value={closingNote} onChange={(e) => setClosingNote(e.target.value)} rows={2}
                      placeholder={t('suivi.note_cloture_placeholder')}
                      style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button onClick={() => clore(a.id)} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: 'var(--green)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t('suivi.confirmer_cloture')}</button>
                      <button onClick={() => { setClosingId(null); setClosingNote('') }} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t('suivi.annuler')}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setClosingId(a.id)}
                    style={{ marginTop: 10, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('suivi.cloturer')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
