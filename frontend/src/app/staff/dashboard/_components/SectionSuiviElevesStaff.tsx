'use client'
import { useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { ShieldAlert, CalendarClock, MessageSquareWarning, StickyNote, UserCheck, Package } from 'lucide-react'
import StudentFollowUpButtons from '@/features/suivi-eleves/StudentFollowUpButtons'
import type { SessionUser } from '../_types'

interface Props {
  sessionUser: SessionUser | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface VigilanceStudent {
  studentId: string
  name: string
  className: string
  healthScore: number
  alertLevel: 'critical' | 'warning' | 'recommendation' | 'good' | 'excellent'
}
interface VigilanceResponse {
  students: VigilanceStudent[]
  summary: { critical: number; warning: number }
}

type ActionType = 'ENTRETIEN_PARENT' | 'SIGNALEMENT_CONSEILLER' | 'OBSERVATION' | 'CONVOCATION_ELEVE'
interface FollowUpAction {
  id: string
  studentId: string
  studentName: string
  className: string | null
  triggeringRecommendationId: string | null
  type: ActionType
  status: 'OUVERT' | 'EN_COURS' | 'CLOS'
  createdByName: string
  assignedToName: string | null
  targetDate: string | null
  interviewMode: 'DATE_PROPOSEE' | 'DEMANDE_DISPONIBILITE' | null
  note: string | null
  createdAt: string
}

const ICONS: Record<ActionType, typeof CalendarClock> = {
  ENTRETIEN_PARENT: CalendarClock, SIGNALEMENT_CONSEILLER: MessageSquareWarning,
  OBSERVATION: StickyNote, CONVOCATION_ELEVE: UserCheck,
}

const ALERT_STYLE: Record<VigilanceStudent['alertLevel'], { bg: string; color: string }> = {
  critical: { bg: 'var(--red-light)', color: 'var(--red)' },
  warning: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  recommendation: { bg: 'var(--blue-light)', color: 'var(--blue)' },
  good: { bg: 'var(--green-light)', color: 'var(--green)' },
  excellent: { bg: 'var(--green-light)', color: 'var(--green)' },
}

/**
 * Écran "suivi élève signalé" pour le Censeur et le Conseiller pédagogique (PLAN_VERIFICATION_
 * ET_ACTIONS_SUIVI.md, Partie B — les deux seuls rôles STAFF concernés jusqu'ici sans écran).
 * Branché sur les permissions réelles de l'utilisateur, jamais sur un rôle codé en dur :
 * - Censeur (VALIDATE_GRADES) : lecture seule — liste de vigilance santé + signalements ouverts
 *   école entière ("notifié seulement… aucune action déclenchable", spec définitive juillet 2026).
 * - Conseiller pédagogique (MANAGE_ORIENTATION ou MANAGE_PEDAGOGICAL_BRIEF) : cas qui lui sont
 *   assignés, avec les actions autorisées une fois le cas escaladé (observation, entretien
 *   parent, convocation élève — jamais signalement, il ne peut pas se signaler un cas à lui-même).
 * `GET /api/v2/student-follow-up/mine` route déjà correctement les deux vues côté backend
 * (ListerActionsEnCoursUseCase) — le Censeur passe en premier si l'utilisateur cumule les deux
 * permissions (cas rare), auquel cas seule la vue Censeur (école entière, lecture seule)
 * s'affiche ici, cohérent avec ce que retourne effectivement l'API dans ce cas.
 */
export default function SectionSuiviElevesStaff({ sessionUser, onToast }: Props) {
  const t = useT('staff')
  const permissions = sessionUser?.permissions ?? []
  const estCenseur = permissions.includes('VALIDATE_GRADES')
  const estConseiller = !estCenseur && (permissions.includes('MANAGE_ORIENTATION') || permissions.includes('MANAGE_PEDAGOGICAL_BRIEF'))

  const fetchVigilance = useCallback(async (): Promise<VigilanceResponse> => {
    const res = await fetchApi('/api/v2/ai/students-health', { credentials: 'include' })
    const data = await res.json()
    if (!res.ok || !data || !Array.isArray(data.students)) {
      return { students: [], summary: { critical: 0, warning: 0 } }
    }
    return data
  }, [])
  // cacheKey vide = useCachedFetch ne déclenche aucun appel (voir hooks/useCachedFetch.ts) — évite
  // d'interroger /students-health pour un Conseiller qui n'a pas la permission de le consulter.
  const { data: vigilance, loading: loadingVigilance, fromCache: vigilanceFromCache } =
    useCachedFetch<VigilanceResponse>(estCenseur ? 'staff:vigilance-sante' : '', fetchVigilance)

  const fetchActions = useCallback(async (): Promise<FollowUpAction[]> => {
    const res = await fetchApi('/api/v2/student-follow-up/mine', { credentials: 'include' })
    const data = await res.json()
    if (!res.ok || !data?.success || !Array.isArray(data?.data)) return []
    return data.data
  }, [])
  const { data: actions, loading: loadingActions, error, refetch } =
    useCachedFetch<FollowUpAction[]>('staff:suivi-eleves-mine', fetchActions)
  const actionsList = Array.isArray(actions) ? actions : []
  const actionsOuvertes = actionsList.filter((a) => a && a.status !== 'CLOS')

  const studentsList = Array.isArray(vigilance?.students) ? vigilance.students : []

  const labelType: Record<ActionType, string> = {
    ENTRETIEN_PARENT: t('suivi.type_entretien'), SIGNALEMENT_CONSEILLER: t('suivi.type_signalement'),
    OBSERVATION: t('suivi.type_observation'), CONVOCATION_ELEVE: t('suivi.type_convocation'),
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>{t('suivi.page_title')}</div>
        <div style={sSub}>{estCenseur ? t('suivi.censeur_subtitle') : t('suivi.conseiller_subtitle')}</div>
      </div>

      {estCenseur && (
        <div style={{ marginBottom: 32 }}>
          <div style={sBlockTitle}>{t('suivi.vigilance_title')}</div>
          {loadingVigilance ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>{t('suivi.chargement')}</div>
          ) : studentsList.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>{t('suivi.vigilance_vide')}</div>
          ) : (
            <>
              {vigilanceFromCache && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--amber)', marginBottom: 10 }}>
                  <Package size={13} /> {t('suivi.hors_ligne')}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {studentsList.filter((s) => s.alertLevel === 'critical' || s.alertLevel === 'warning').map((s) => {
                  const style = ALERT_STYLE[s.alertLevel]
                  return (
                    <div key={s.studentId} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{s.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.className}</div>
                        </div>
                        <span style={{ background: style.bg, color: style.color, padding: '3px 10px', borderRadius: 14, fontSize: 12, fontWeight: 800 }}>
                          {s.healthScore}/100
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      <div>
        <div style={sBlockTitle}>{estCenseur ? t('suivi.signalements_ecole_title') : t('suivi.mes_cas_title')}</div>

        {loadingActions ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>{t('suivi.chargement')}</div>
        ) : error ? (
          <div style={{ fontSize: 13, color: 'var(--red)' }}>{t('suivi.erreur')}</div>
        ) : actionsOuvertes.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: 40, textAlign: 'center', maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><ShieldAlert size={36} color="var(--green)" /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('suivi.aucun_cas')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {actionsOuvertes.map((a) => {
              const Icon = ICONS[a.type]
              return (
                <div key={a.id} style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon size={18} color="var(--blue)" />
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{a.studentName}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{a.className ?? '—'}</div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 14,
                      background: a.status === 'EN_COURS' ? 'var(--amber-light)' : 'var(--bg2)',
                      color: a.status === 'EN_COURS' ? 'var(--amber)' : 'var(--text2)',
                    }}>
                      {labelType[a.type]}
                    </span>
                  </div>

                  {a.note && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10 }}>{a.note}</div>}
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>
                    {t('suivi.cree_par').replace('{name}', a.createdByName)}
                    {a.assignedToName && ` · ${t('suivi.assigne_a').replace('{name}', a.assignedToName)}`}
                    {a.targetDate && ` · ${new Date(a.targetDate).toLocaleDateString()}`}
                  </div>

                  {/* Conseiller uniquement — le Censeur consulte, n'agit jamais (voir doc de tête). */}
                  {estConseiller && sessionUser && (
                    <StudentFollowUpButtons
                      studentId={a.studentId}
                      triggeringRecommendationId={a.triggeringRecommendationId}
                      role="CONSEILLER"
                      currentUserId={sessionUser.userId}
                      onToast={(msg, type) => { onToast(msg, type); refetch() }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const sBlockTitle: React.CSSProperties = { fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }
