'use client'

import type { Dispatch, SetStateAction } from 'react'
import { CheckCircle, Edit, UserPlus, Users } from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS, type SessionRow } from './anonymatTypes'

interface Props {
  selected: SessionRow
  teamProgress: { total: number; done: number } | null
  teamEmails: string
  setTeamEmails: (v: string) => void
  designating: boolean
  onDesignateTeam: (session: SessionRow) => void
  crossAssignments: { classId: string; correcteurUserId: string }[]
  setCrossAssignments: Dispatch<SetStateAction<{ classId: string; correcteurUserId: string }[]>>
  teachers: { id: string; name: string }[]
  assigning: boolean
  onAssignCorrection: (session: SessionRow) => void
  reconciling: boolean
  onReconcile: (sessionId: string) => void
  onClose: () => void
}

export default function AnonymatDetailPanel({
  selected,
  teamProgress,
  teamEmails,
  setTeamEmails,
  designating,
  onDesignateTeam,
  crossAssignments,
  setCrossAssignments,
  teachers,
  assigning,
  onAssignCorrection,
  reconciling,
  onReconcile,
  onClose,
}: Props) {
  return (
    <div style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="text-sm md:text-base font-semibold text-[var(--text)]">Session {selected.id.slice(0, 8)}…</h2>
        <button onClick={onClose} className="text-[var(--text3)] hover:text-[var(--text)] text-sm">×</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
        <div><span className="text-[var(--text3)] text-xs">Classe</span><br /><span className="font-semibold text-xs text-[var(--text)]">{selected.className || selected.classId}</span></div>
        <div><span className="text-[var(--text3)] text-xs">Matière</span><br /><span className="font-semibold text-xs text-[var(--text)]">{selected.subjectName || selected.subjectId}</span></div>
        <div><span className="text-[var(--text3)] text-xs">Statut anonymat</span><br /><span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${STATUS_COLORS[selected.anonymatStatus] || STATUS_COLORS.NONE}`}>{STATUS_LABELS[selected.anonymatStatus] || selected.anonymatStatus}</span></div>
        <div><span className="text-[var(--text3)] text-xs">Mode correction</span><br /><span className="font-semibold text-xs text-[var(--text)]">{selected.correctionMode || '—'}</span></div>
      </div>

      {['CODES_GENERES', 'EQUIPE_DESIGNEE'].includes(selected.anonymatStatus) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <h3 className="font-medium text-xs md:text-sm text-[var(--text)] mb-2">Désigner l&apos;équipe d&apos;anonymisation</h3>
          {teamProgress && (
            <p className="text-xs text-[var(--text3)] mb-2">
              Équipe : {teamProgress.done}/{teamProgress.total} lot(s) terminé(s)
            </p>
          )}
          <textarea
            value={teamEmails}
            onChange={(e) => setTeamEmails(e.target.value)}
            placeholder="Emails des membres (un par ligne ou séparés par des virgules)"
            rows={2}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={() => onDesignateTeam(selected)}
              disabled={designating}
              className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Users size={14} />
              {designating ? 'Envoi…' : "Notifier l'équipe"}
            </button>
          </div>
        </div>
      )}

      {selected.anonymatStatus === 'ANONYMISATION_TERMINEE' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <h3 className="font-medium text-xs md:text-sm text-[var(--text)] mb-2">Assigner les correcteurs</h3>
          {selected.correctionMode === 'CROSSED' ? (
            <div>
              <p className="text-xs text-[var(--text3)] mb-2">Mode croisé : associez chaque classe à un correcteur</p>
              <button
                onClick={() => setCrossAssignments([...crossAssignments, { classId: selected.classId, correcteurUserId: '' }])}
                className="text-xs text-[var(--primary)] hover:underline mb-2 flex items-center gap-1"
              >
                <UserPlus size={13} />
                + Ajouter une assignation
              </button>
              {crossAssignments.map((a, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <select
                    value={a.correcteurUserId}
                    onChange={(e) => setCrossAssignments(crossAssignments.map((x, i) => i === idx ? { ...x, correcteurUserId: e.target.value } : x))}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-xs"
                  >
                    <option value="">— Sélectionner un correcteur —</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button onClick={() => setCrossAssignments(crossAssignments.filter((_, i) => i !== idx))} className="text-red-600 hover:text-red-300 dark:text-red-300 dark:hover:text-red-200 text-sm">×</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text3)] mb-2">Mode propre classe : les correcteurs sont les enseignants de la classe.</p>
          )}
          <button
            onClick={() => onAssignCorrection(selected)}
            disabled={assigning}
            className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 mt-1 flex items-center gap-1.5"
          >
            <Edit size={14} />
            {assigning ? 'Assignation…' : 'Assigner la correction'}
          </button>
        </div>
      )}

      {selected.anonymatStatus === 'CORRECTION_TERMINEE' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <h3 className="font-medium text-xs md:text-sm text-[var(--text)] mb-2">Réconcilier les notes</h3>
          <p className="text-xs text-[var(--text3)] mb-2">Appliquer les notes anonymes aux bulletins des élèves.</p>
          <button
            onClick={() => onReconcile(selected.id)}
            disabled={reconciling}
            className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          >
            <CheckCircle size={14} />
            {reconciling ? 'Réconciliation…' : 'Réconcilier maintenant'}
          </button>
        </div>
      )}

      {selected.anonymatStatus === 'RECONCILIE' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div className="flex items-center gap-2 text-success text-xs md:text-sm">
            <CheckCircle size={18} />
            <span className="font-medium">Session réconciliée — toutes les notes sont intégrées aux bulletins.</span>
          </div>
        </div>
      )}
    </div>
  )
}
