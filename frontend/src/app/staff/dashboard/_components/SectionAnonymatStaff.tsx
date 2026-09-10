'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, Plus, Key, Users, Edit, CheckCircle, AlertCircle, UserPlus } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

type SessionRow = {
  id: string
  classId: string
  className?: string
  subjectId: string
  subjectName?: string
  scheduledDate: string
  status: string
  isAnonymized: boolean
  anonymatStatus: string
  correctionMode: 'OWN_CLASS' | 'CROSSED' | null
  academicSequenceId: string | null
}

const STATUS_LABELS: Record<string, string> = {
  NONE: 'Non démarré',
  CODES_GENERES: 'Codes générés',
  EQUIPE_DESIGNEE: 'Équipe désignée',
  ANONYMISATION_EN_COURS: 'Anonymisation en cours',
  ANONYMISATION_TERMINEE: 'Anonymisation terminée',
  EN_CORRECTION: 'En correction',
  CORRECTION_TERMINEE: 'Correction terminée',
  RECONCILIE: 'Réconcilié',
}

const STATUS_COLORS: Record<string, string> = {
  NONE: 'bg-gray-500/20 text-gray-300',
  CODES_GENERES: 'bg-blue-500/20 text-blue-300',
  EQUIPE_DESIGNEE: 'bg-indigo-500/20 text-indigo-300',
  ANONYMISATION_EN_COURS: 'bg-amber-500/20 text-amber-300',
  ANONYMISATION_TERMINEE: 'bg-green-500/20 text-green-300',
  EN_CORRECTION: 'bg-purple-500/20 text-purple-300',
  CORRECTION_TERMINEE: 'bg-teal-500/20 text-teal-300',
  RECONCILIE: 'bg-emerald-500/20 text-emerald-300',
}

export default function SectionAnonymatStaff({ onToast }: Props) {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SessionRow | null>(null)
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [scopeId, setScopeId] = useState('')
  const [academicSequenceId, setAcademicSequenceId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [isAnonymized, setIsAnonymized] = useState(true)
  const [correctionMode, setCorrectionMode] = useState<'OWN_CLASS' | 'CROSSED'>('OWN_CLASS')
  const [teamEmails, setTeamEmails] = useState('')
  const [crossAssignments, setCrossAssignments] = useState<{ classId: string; correcteurUserId: string }[]>([])
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([])
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [designating, setDesignating] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [reconciling, setReconciling] = useState(false)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/assessments/sessions', { credentials: 'include' })
      const data = await res.json()
      if (data.success) setSessions(data.data ?? [])
      else onToast(data.message || 'Erreur chargement sessions', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => { loadSessions() }, [loadSessions])

  // Fetch teachers for CROSSED mode when panel opens
  useEffect(() => {
    if (selected?.anonymatStatus === 'ANONYMISATION_TERMINEE' && selected.correctionMode === 'CROSSED' && teachers.length === 0) {
      fetchApi('/api/v2/users?role=TEACHER', { credentials: 'include' })
        .then(r => r.json())
        .then(d => { if (d.success) setTeachers(d.data.map((u: any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }))) })
        .catch(() => {})
    }
  }, [selected?.anonymatStatus, selected?.correctionMode])

  const createSession = async () => {
    if (!scopeId || !subjectId || !classId || !scheduledDate || !academicSequenceId) {
      onToast('Tous les champs sont requis (incl. séquence académique)', 'error')
      return
    }
    setCreating(true)
    try {
      const res = await fetchApi('/api/v2/assessments/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentScopeId: scopeId,
          subjectId,
          classId,
          academicSequenceId,
          scheduledDate,
          isAnonymized,
          correctionMode: isAnonymized ? correctionMode : undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        onToast('Session créée', 'success')
        loadSessions()
        setScopeId('')
        setSubjectId('')
        setClassId('')
        setAcademicSequenceId('')
        setScheduledDate('')
      } else onToast(data.message || data.error || 'Échec', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setCreating(false)
    }
  }

  const generateCodes = async (sessionId: string, classIds: string[]) => {
    setGenerating(sessionId)
    try {
      const res = await fetchApi(`/api/v2/assessments/sessions/${sessionId}/anonymat/codes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classIds }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(`${data.data.codesCount} codes générés`, 'success')
        loadSessions()
      } else onToast(data.message || data.error || 'Échec codes', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setGenerating(null)
    }
  }

  const designateTeam = async (session: SessionRow) => {
    const emails = teamEmails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean)
    if (emails.length === 0) {
      onToast('Au moins un email requis', 'error')
      return
    }
    setDesignating(true)
    try {
      const members = emails.map(email => ({ type: 'EMAIL' as const, email }))
      const schoolRes = await fetchApi('/api/v2/school/me', { credentials: 'include' })
      const school = await schoolRes.json()
      const res = await fetchApi(`/api/v2/assessments/sessions/${session.id}/anonymat/team`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          members,
          classIds: [session.classId],
          schoolName: school?.data?.name ?? 'Établissement',
        }),
      })
      const data = await res.json()
      if (data.success) {
        onToast(`${data.data.membersCreated} membre(s) notifié(s)`, 'success')
        setTeamEmails('')
        loadSessions()
      } else onToast(data.message || data.error || 'Échec équipe', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setDesignating(false)
    }
  }

  const assignCorrection = async (session: SessionRow) => {
    setAssigning(true)
    try {
      const body =
        session.correctionMode === 'CROSSED'
          ? { classIds: [session.classId], assignments: crossAssignments }
          : { classIds: [session.classId] }
      const res = await fetchApi(
        `/api/v2/assessments/sessions/${session.id}/anonymat/correction-assignments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const data = await res.json()
      if (data.success) {
        onToast('Correcteurs assignés', 'success')
        loadSessions()
      } else onToast(data.message || data.error || 'Échec assignation', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setAssigning(false)
    }
  }

  const reconcile = async (sessionId: string) => {
    setReconciling(true)
    try {
      const res = await fetchApi(`/api/v2/assessments/sessions/${sessionId}/anonymat/reconcile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) {
        onToast(
          `Réconciliation : ${data.data.reconciled} note(s)` +
            (data.data.locked ? ' (verrouillées)' : ' (brouillon)'),
          'success',
        )
        loadSessions()
      } else onToast(data.message || data.error || 'Échec réconciliation', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setReconciling(false)
    }
  }

  const getActions = (session: SessionRow) => {
    const actions: Array<{ label: string; onClick: () => void; icon: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' }> = []
    if (session.anonymatStatus === 'NONE' && session.isAnonymized) {
      actions.push({
        label: 'Générer les codes',
        icon: <Key size={16} />,
        onClick: () => generateCodes(session.id, [session.classId]),
        variant: 'primary',
      })
    }
    if (['CODES_GENERES', 'EQUIPE_DESIGNEE'].includes(session.anonymatStatus)) {
      actions.push({
        label: 'Désigner l\'équipe',
        icon: <Users size={16} />,
        onClick: () => { setSelected(session); setTeamEmails('') },
        variant: 'secondary',
      })
    }
    if (session.anonymatStatus === 'ANONYMISATION_TERMINEE') {
      actions.push({
        label: 'Assigner correction',
        icon: <Edit size={16} />,
        onClick: () => { setSelected(session); setCrossAssignments([]) },
        variant: 'primary',
      })
    }
    if (session.anonymatStatus === 'CORRECTION_TERMINEE') {
      actions.push({
        label: 'Réconcilier',
        icon: <CheckCircle size={16} />,
        onClick: () => reconcile(session.id),
        variant: 'primary',
      })
    }
    if (session.anonymatStatus === 'RECONCILIE') {
      actions.push({
        label: 'Terminé',
        icon: <CheckCircle size={16} />,
        onClick: () => {},
        variant: 'secondary',
      })
    }
    return actions
  }

  return (
    <div className="px-4 py-5 md:px-8 md:py-7" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text)]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif' }}>
            Anonymat / Compositions
          </h1>
          <p className="text-[var(--text3)] text-sm mt-1">Gestion des sessions d'évaluation anonymisées</p>
        </div>
        <button
          onClick={loadSessions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm font-medium hover:bg-[var(--bg2)] transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Rafraîchir
        </button>
      </div>

      {/* Création de session */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Créer une session</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'end' }}>
          <div>
            <label className="block text-sm font-medium text-[var(--text2)] mb-1">Scope d'évaluation</label>
            <input
              type="text"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              placeholder="ID du scope"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text2)] mb-1">Matière</label>
            <input
              type="text"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              placeholder="ID matière"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text2)] mb-1">Classe</label>
            <input
              type="text"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              placeholder="ID classe"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text2)] mb-1">Date prévue</label>
            <input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text2)] mb-1">Séquence académique</label>
            <input
              type="text"
              value={academicSequenceId}
              onChange={(e) => setAcademicSequenceId(e.target.value)}
              placeholder="ID séquence académique"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymized}
                onChange={(e) => setIsAnonymized(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg)] text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <span className="text-sm text-[var(--text)]">Session anonymisée</span>
            </label>
            {isAnonymized && (
              <div style={{ flex: 1 }}>
                <label className="block text-sm font-medium text-[var(--text2)] mb-1">Mode correction</label>
                <select
                  value={correctionMode}
                  onChange={(e) => setCorrectionMode(e.target.value as 'OWN_CLASS' | 'CROSSED')}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="OWN_CLASS">Propre classe</option>
                  <option value="CROSSED">Croisé</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <button
              onClick={createSession}
              disabled={creating}
              className="w-full px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              {creating ? 'Création...' : 'Créer la session'}
            </button>
          </div>
        </div>
      </div>

      {/* Liste des sessions */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-[var(--primary)] animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-[var(--text3)]">
            Aucune session trouvée. Créez votre première session ci-dessus.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Session</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Classe</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Matière</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Date</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Statut</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Anonymat</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} style={{ borderBottom: '1px solid var(--border)', background: selected?.id === session.id ? 'var(--bg2)' : 'transparent' }} onClick={() => setSelected(selected?.id === session.id ? null : session)}>
                    <td className="p-3 text-sm font-mono text-[var(--text)]">{session.id.slice(0, 8)}…</td>
                    <td className="p-3 text-sm text-[var(--text)]">{session.className || session.classId}</td>
                    <td className="p-3 text-sm text-[var(--text)]">{session.subjectName || session.subjectId}</td>
                    <td className="p-3 text-sm text-[var(--text3)]">{new Date(session.scheduledDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${session.status === 'PLANNED' ? 'bg-blue-500/20 text-blue-300' : session.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'}`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[session.anonymatStatus] || STATUS_COLORS.NONE}`}>
                        {STATUS_LABELS[session.anonymatStatus] || session.anonymatStatus}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {getActions(session).map((action, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); action.onClick() }}
                            disabled={generating === session.id || designating || assigning || reconciling}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              action.variant === 'primary'
                                ? 'bg-[var(--primary)] text-white hover:opacity-90'
                                : action.variant === 'danger'
                                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                                : 'bg-[var(--bg2)] text-[var(--text)] hover:bg-[var(--border)]'
                            }`}
                          >
                            {action.icon}
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panneau de détail / actions */}
      {selected && (
        <div style={{ marginTop: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="text-lg font-semibold text-[var(--text)]">Session {selected.id.slice(0, 8)}…</h2>
            <button onClick={() => setSelected(null)} className="text-[var(--text3)] hover:text-[var(--text)]">×</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div><span className="text-[var(--text3)] text-sm">Classe</span><br /><span className="font-medium">{selected.className || selected.classId}</span></div>
            <div><span className="text-[var(--text3)] text-sm">Matière</span><br /><span className="font-medium">{selected.subjectName || selected.subjectId}</span></div>
            <div><span className="text-[var(--text3)] text-sm">Statut anonymat</span><br /><span className={`font-medium px-2 py-1 rounded-full text-xs ${STATUS_COLORS[selected.anonymatStatus] || STATUS_COLORS.NONE}`}>{STATUS_LABELS[selected.anonymatStatus] || selected.anonymatStatus}</span></div>
            <div><span className="text-[var(--text3)] text-sm">Mode correction</span><br /><span className="font-medium">{selected.correctionMode || '—'}</span></div>
          </div>

          {['CODES_GENERES', 'EQUIPE_DESIGNEE'].includes(selected.anonymatStatus) && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <h3 className="font-medium text-[var(--text)] mb-3">Désigner l'équipe d'anonymisation</h3>
              <textarea
                value={teamEmails}
                onChange={(e) => setTeamEmails(e.target.value)}
                placeholder="Emails des membres (un par ligne ou séparés par des virgules)"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => designateTeam(selected)}
                  disabled={designating}
                  className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  <Users size={16} />
                  {designating ? 'Envoi…' : 'Notifier l\'équipe'}
                </button>
              </div>
            </div>
          )}

          {selected.anonymatStatus === 'ANONYMISATION_TERMINEE' && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <h3 className="font-medium text-[var(--text)] mb-3">Assigner les correcteurs</h3>
              {selected.correctionMode === 'CROSSED' ? (
                <div>
                  <p className="text-sm text-[var(--text3)] mb-2">Mode croisé : associez chaque classe à un correcteur</p>
                  <button
                    onClick={() => setCrossAssignments([...crossAssignments, { classId: selected.classId, correcteurUserId: '' }])}
                    className="text-sm text-[var(--primary)] hover:underline mb-3 flex items-center gap-1"
                  >
                    <UserPlus size={14} />
                    + Ajouter une assignation
                  </button>
                  {crossAssignments.map((a, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <select
                        value={a.correcteurUserId}
                        onChange={(e) => setCrossAssignments(crossAssignments.map((x, i) => i === idx ? { ...x, correcteurUserId: e.target.value } : x))}
                        className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm"
                      >
                        <option value="">— Sélectionner un correcteur —</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <button onClick={() => setCrossAssignments(crossAssignments.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300">×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text3)] mb-3">Mode propre classe : les correcteurs sont les enseignants de la classe.</p>
              )}
              <button
                onClick={() => assignCorrection(selected)}
                disabled={assigning}
                className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 mt-2 flex items-center gap-2"
              >
                <Edit size={16} />
                {assigning ? 'Assignation…' : 'Assigner la correction'}
              </button>
            </div>
          )}

          {selected.anonymatStatus === 'CORRECTION_TERMINEE' && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <h3 className="font-medium text-[var(--text)] mb-3">Réconcilier les notes</h3>
              <p className="text-sm text-[var(--text3)] mb-3">Appliquer les notes anonymes aux bulletins des élèves.</p>
              <button
                onClick={() => reconcile(selected.id)}
                disabled={reconciling}
                className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle size={16} />
                {reconciling ? 'Réconciliation…' : 'Réconcilier maintenant'}
              </button>
            </div>
          )}

          {selected.anonymatStatus === 'RECONCILIE' && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div className="flex items-center gap-3 text-green-400">
                <CheckCircle size={24} />
                <span className="font-medium">Session réconciliée — toutes les notes sont intégrées aux bulletins.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}