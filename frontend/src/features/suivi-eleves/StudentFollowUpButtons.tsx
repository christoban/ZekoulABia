'use client'
import { useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { CalendarClock, MessageSquareWarning, StickyNote, UserCheck, ChevronDown, ChevronUp, X } from 'lucide-react'

// Chaîne d'escalade — spec exacte et définitive (relecture juillet 2026) :
// - PROF_PRINCIPAL     : entretien parent, signalement au conseiller (si disponible dans
//                        l'établissement), observation. PAS de convocation — le PP voit déjà ses
//                        élèves quotidiennement en classe, une convocation formelle ne lui apporte
//                        rien.
// - ENSEIGNANT_MATIERE : observation uniquement, restreinte à sa propre matière.
// - CONSEILLER         : observation, entretien parent, convocation élève (exclusive à ce rôle) —
//                        jamais signalement, il ne peut pas se signaler un cas à lui-même. N'existe
//                        que sur un cas déjà escaladé vers lui (vérifié côté backend,
//                        CreerActionSuiviEleveUseCase.casEscaladeVersMoi).
// Le Censeur n'a aucune capacité de création — pas de rôle correspondant ici, il consulte en
// lecture seule (SectionSuiviElevesStaff.tsx).
export type FollowUpRole = 'PROF_PRINCIPAL' | 'ENSEIGNANT_MATIERE' | 'CONSEILLER'

interface Props {
  studentId: string
  triggeringRecommendationId?: string | null
  role: FollowUpRole
  // Pertinent seulement pour ENSEIGNANT_MATIERE (jamais de rôle codé en dur, uniquement dérivé de
  // professorPrincipalId/TeachingAssignment côté backend, valable sur tous les templates).
  mesMatieres?: { id: string; name: string }[]
  // Pertinent seulement pour PROF_PRINCIPAL — ~15% des établissements secondaires publics
  // camerounais seulement ont un conseiller pédagogique configuré ; masque "Signaler au
  // conseiller" plutôt que d'offrir une option qui ne mène nulle part (calculé côté backend,
  // jamais côté client).
  conseillerDisponible?: boolean
  // Identité réelle de l'utilisateur connecté — l'historique peut afficher des actions créées par
  // un collègue (ex. un PP voit l'observation d'un enseignant de matière sur le même élève), mais
  // seuls le créateur ou l'assigné peuvent la clôturer (ClorreActionSuiviUseCase). Sans cette
  // identité, le bouton "Clôturer" était affiché pour tout le monde et échouait systématiquement
  // côté serveur pour qui n'y avait pas droit — corrigé ici en le masquant côté client aussi.
  currentUserId: string
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

type ActionType = 'ENTRETIEN_PARENT' | 'SIGNALEMENT_CONSEILLER' | 'OBSERVATION' | 'CONVOCATION_ELEVE'
type InterviewMode = 'DATE_PROPOSEE' | 'DEMANDE_DISPONIBILITE'

interface FollowUpAction {
  id: string
  type: ActionType
  status: 'OUVERT' | 'EN_COURS' | 'CLOS'
  createdById: string
  createdByName: string
  assignedToId: string | null
  assignedToName: string | null
  targetDate: string | null
  interviewMode: InterviewMode | null
  note: string | null
  createdAt: string
  closedAt: string | null
  closingNote: string | null
}

const btnAction: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
  fontSize: 12, fontWeight: 700, border: '1.5px solid var(--border2)', background: 'var(--surface)',
  color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit',
}

/**
 * Transforme une alerte lue passivement en suivi tracé — boutons (PLAN_VERIFICATION_ET_ACTIONS
 * _SUIVI.md, Partie B) sous chaque alerte, plus l'historique des actions déjà engagées sur cet
 * élève (B.5.3). Réutilisé sur toute "fiche élève signalée" : `SectionTeacherAtRisk.tsx`
 * (professeur principal, enseignant de matière) et `SectionSuiviElevesStaff.tsx` (conseiller
 * pédagogique).
 */
export default function StudentFollowUpButtons({ studentId, triggeringRecommendationId, role, mesMatieres = [], conseillerDisponible = false, currentUserId, onToast }: Props) {
  const t = useT('teacher')
  const [openForm, setOpenForm] = useState<ActionType | null>(null)
  const [targetDate, setTargetDate] = useState('')
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('DATE_PROPOSEE')
  const [note, setNote] = useState('')
  const [conseillerId, setConseillerId] = useState('')
  const [conseillers, setConseillers] = useState<{ id: string; name: string }[]>([])
  const [observationSubjectId, setObservationSubjectId] = useState(mesMatieres.length === 1 ? mesMatieres[0].id : '')
  const [submitting, setSubmitting] = useState(false)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<FollowUpAction[] | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [closingNote, setClosingNote] = useState('')

  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await fetchApi(`/api/v2/student-follow-up/student/${studentId}`, { credentials: 'include' })
      const data = await res.json()
      setHistory(data.success ? data.data : [])
    } catch { setHistory([]) }
    finally { setLoadingHistory(false) }
  }

  const toggleHistory = () => {
    const next = !historyOpen
    setHistoryOpen(next)
    if (next && history === null) loadHistory()
  }

  const openConseillerForm = async () => {
    setOpenForm('SIGNALEMENT_CONSEILLER')
    if (conseillers.length === 0) {
      try {
        const res = await fetchApi('/api/v2/student-follow-up/conseillers', { credentials: 'include' })
        const data = await res.json()
        setConseillers(data.success ? data.data : [])
      } catch { /* le select restera vide, l'utilisateur verra qu'il n'y a rien à choisir */ }
    }
  }

  const fermerFormulaire = () => { setOpenForm(null); setTargetDate(''); setInterviewMode('DATE_PROPOSEE'); setNote(''); setConseillerId('') }

  const soumettre = async () => {
    if (!openForm) return
    if (openForm === 'ENTRETIEN_PARENT' && interviewMode === 'DATE_PROPOSEE' && !targetDate) { onToast(t('suivi.date_requise'), 'error'); return }
    if (openForm === 'CONVOCATION_ELEVE' && !targetDate) { onToast(t('suivi.date_requise'), 'error'); return }
    if (openForm === 'SIGNALEMENT_CONSEILLER' && !conseillerId) { onToast(t('suivi.destinataire_requis'), 'error'); return }
    if (openForm === 'OBSERVATION' && !note.trim()) { onToast(t('suivi.note_requise'), 'error'); return }
    if (openForm === 'OBSERVATION' && role === 'ENSEIGNANT_MATIERE' && !observationSubjectId) { onToast(t('suivi.matiere_requise'), 'error'); return }

    setSubmitting(true)
    try {
      const res = await fetchApi('/api/v2/student-follow-up', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          type: openForm,
          triggeringRecommendationId: triggeringRecommendationId ?? undefined,
          subjectId: openForm === 'OBSERVATION' && role === 'ENSEIGNANT_MATIERE' ? observationSubjectId : undefined,
          assignedToId: openForm === 'SIGNALEMENT_CONSEILLER' ? conseillerId : undefined,
          targetDate: (openForm === 'ENTRETIEN_PARENT' || openForm === 'CONVOCATION_ELEVE') ? (targetDate || undefined) : undefined,
          interviewMode: openForm === 'ENTRETIEN_PARENT' ? interviewMode : undefined,
          note: note || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('suivi.action_creee'), 'success')
        fermerFormulaire()
        if (historyOpen) loadHistory()
      } else {
        onToast(data.message || t('suivi.erreur'), 'error')
      }
    } catch { onToast(t('suivi.erreur'), 'error') }
    finally { setSubmitting(false) }
  }

  const clore = async (actionId: string) => {
    if (!closingNote.trim()) { onToast(t('suivi.note_cloture_requise'), 'error'); return }
    try {
      const res = await fetchApi(`/api/v2/student-follow-up/${actionId}/close`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closingNote }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('suivi.action_cloturee'), 'success')
        setClosingId(null); setClosingNote('')
        loadHistory()
      } else {
        onToast(data.message || t('suivi.erreur'), 'error')
      }
    } catch { onToast(t('suivi.erreur'), 'error') }
  }

  const labelType: Record<ActionType, string> = {
    ENTRETIEN_PARENT: t('suivi.type_entretien'),
    SIGNALEMENT_CONSEILLER: t('suivi.type_signalement'),
    OBSERVATION: t('suivi.type_observation'),
    CONVOCATION_ELEVE: t('suivi.type_convocation'),
  }
  const labelStatus: Record<FollowUpAction['status'], string> = {
    OUVERT: t('suivi.status_ouvert'),
    EN_COURS: t('suivi.status_en_cours'),
    CLOS: t('suivi.status_clos'),
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--bg2)' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {role === 'PROF_PRINCIPAL' && (
          <>
            <button style={btnAction} onClick={() => setOpenForm('ENTRETIEN_PARENT')}>
              <CalendarClock size={14} /> {t('suivi.btn_entretien')}
            </button>
            {conseillerDisponible && (
              <button style={btnAction} onClick={openConseillerForm}>
                <MessageSquareWarning size={14} /> {t('suivi.btn_signalement')}
              </button>
            )}
          </>
        )}
        {role === 'CONSEILLER' && (
          <>
            <button style={btnAction} onClick={() => setOpenForm('ENTRETIEN_PARENT')}>
              <CalendarClock size={14} /> {t('suivi.btn_entretien')}
            </button>
            <button style={btnAction} onClick={() => setOpenForm('CONVOCATION_ELEVE')}>
              <UserCheck size={14} /> {t('suivi.btn_convocation')}
            </button>
          </>
        )}
        <button style={btnAction} onClick={() => setOpenForm('OBSERVATION')}>
          <StickyNote size={14} /> {t('suivi.btn_observation')}
        </button>
        {role === 'ENSEIGNANT_MATIERE' && (
          <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>{t('suivi.note_enseignant_matiere')}</span>
        )}
        <button style={{ ...btnAction, marginLeft: 'auto', border: 'none', background: 'transparent' }} onClick={toggleHistory}>
          {t('suivi.historique')} {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {openForm && (
        <div style={{ marginTop: 10, padding: 14, background: 'var(--bg2)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{labelType[openForm]}</span>
            <button onClick={fermerFormulaire} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={16} /></button>
          </div>

          {openForm === 'ENTRETIEN_PARENT' && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>{t('suivi.mode_entretien')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)', cursor: 'pointer' }}>
                  <input type="radio" checked={interviewMode === 'DATE_PROPOSEE'} onChange={() => setInterviewMode('DATE_PROPOSEE')} />
                  {t('suivi.mode_date_proposee')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)', cursor: 'pointer' }}>
                  <input type="radio" checked={interviewMode === 'DEMANDE_DISPONIBILITE'} onChange={() => setInterviewMode('DEMANDE_DISPONIBILITE')} />
                  {t('suivi.mode_demande_disponibilite')}
                </label>
              </div>
              {interviewMode === 'DATE_PROPOSEE' && (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>{t('suivi.date_cible')}</label>
                  <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
                </div>
              )}
            </div>
          )}

          {openForm === 'CONVOCATION_ELEVE' && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>{t('suivi.date_cible')}</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
            </div>
          )}

          {openForm === 'SIGNALEMENT_CONSEILLER' && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>{t('suivi.destinataire')}</label>
              <select value={conseillerId} onChange={(e) => setConseillerId(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}>
                <option value="">—</option>
                {conseillers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {conseillers.length === 0 && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{t('suivi.aucun_conseiller')}</div>}
            </div>
          )}

          {openForm === 'OBSERVATION' && role === 'ENSEIGNANT_MATIERE' && mesMatieres.length > 1 && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>{t('suivi.matiere_concernee')}</label>
              <select value={observationSubjectId} onChange={(e) => setObservationSubjectId(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}>
                <option value="">—</option>
                {mesMatieres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          {(openForm === 'OBSERVATION' || openForm === 'SIGNALEMENT_CONSEILLER') && (
            <div style={{ marginTop: openForm === 'SIGNALEMENT_CONSEILLER' ? 10 : 0 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
                {openForm === 'OBSERVATION' ? t('suivi.observation_texte') : t('suivi.contexte_optionnel')}
              </label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          )}

          <button onClick={soumettre} disabled={submitting}
            style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: 'inherit' }}>
            {submitting ? t('suivi.envoi_en_cours') : t('suivi.confirmer')}
          </button>
        </div>
      )}

      {historyOpen && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadingHistory ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t('suivi.chargement')}</div>
          ) : !history || history.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>{t('suivi.aucun_suivi')}</div>
          ) : (
            history.map((a) => (
              <div key={a.id} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{labelType[a.type]}</span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                    background: a.status === 'CLOS' ? 'var(--bg)' : 'var(--green-light)',
                    color: a.status === 'CLOS' ? 'var(--text3)' : 'var(--green)',
                  }}>
                    {labelStatus[a.status]}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {t('suivi.cree_par').replace('{name}', a.createdByName)}
                  {a.assignedToName && ` · ${t('suivi.assigne_a').replace('{name}', a.assignedToName)}`}
                  {a.targetDate && ` · ${new Date(a.targetDate).toLocaleDateString()}`}
                  {a.type === 'ENTRETIEN_PARENT' && a.interviewMode && ` · ${a.interviewMode === 'DATE_PROPOSEE' ? t('suivi.mode_date_proposee') : t('suivi.mode_demande_disponibilite')}`}
                </div>
                {a.note && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>{a.note}</div>}
                {a.status === 'CLOS' ? (
                  a.closingNote && (
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6, fontStyle: 'italic' }}>
                      {t('suivi.note_cloture_label')} {a.closingNote}
                    </div>
                  )
                ) : (a.createdById !== currentUserId && a.assignedToId !== currentUserId) ? null : closingId === a.id ? (
                  <div style={{ marginTop: 8 }}>
                    <textarea value={closingNote} onChange={(e) => setClosingNote(e.target.value)} rows={2}
                      placeholder={t('suivi.note_cloture_placeholder')}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button onClick={() => clore(a.id)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t('suivi.confirmer_cloture')}</button>
                      <button onClick={() => { setClosingId(null); setClosingNote('') }} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t('suivi.annuler')}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setClosingId(a.id)} style={{ marginTop: 6, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t('suivi.cloturer')}</button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
