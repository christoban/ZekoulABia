'use client'

import { Plus } from 'lucide-react'
import type { RefItem, SequenceItem } from './anonymatTypes'

interface Props {
  scopeId: string
  setScopeId: (v: string) => void
  subjectId: string
  setSubjectId: (v: string) => void
  classId: string
  setClassId: (v: string) => void
  scheduledDate: string
  setScheduledDate: (v: string) => void
  academicSequenceId: string
  setAcademicSequenceId: (v: string) => void
  isAnonymized: boolean
  setIsAnonymized: (v: boolean) => void
  correctionMode: 'OWN_CLASS' | 'CROSSED'
  setCorrectionMode: (v: 'OWN_CLASS' | 'CROSSED') => void
  subjects: RefItem[]
  classes: RefItem[]
  sequences: SequenceItem[]
  creating: boolean
  onCreate: () => void
}

export default function AnonymatCreateForm({
  scopeId,
  setScopeId,
  subjectId,
  setSubjectId,
  classId,
  setClassId,
  scheduledDate,
  setScheduledDate,
  academicSequenceId,
  setAcademicSequenceId,
  isAnonymized,
  setIsAnonymized,
  correctionMode,
  setCorrectionMode,
  subjects,
  classes,
  sequences,
  creating,
  onCreate,
}: Props) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
      <h2 className="text-sm md:text-base font-semibold text-[var(--text)] mb-3">Créer une session</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}>
        <div>
          <label className="block text-xs font-medium text-[var(--text2)] mb-1">Scope d&apos;évaluation</label>
          <input
            type="text"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
            placeholder="ID du scope"
            className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-xs md:text-[12.5px] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text2)] mb-1">Matière</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-xs md:text-[12.5px] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            <option value="">— Matière —</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text2)] mb-1">Classe</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-xs md:text-[12.5px] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            <option value="">— Classe —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text2)] mb-1">Date prévue</label>
          <input
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-xs md:text-[12.5px] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text2)] mb-1">Séquence académique</label>
          <select
            value={academicSequenceId}
            onChange={(e) => setAcademicSequenceId(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-xs md:text-[12.5px] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            <option value="">— Séquence —</option>
            {sequences.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'end' }}>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnonymized}
              onChange={(e) => setIsAnonymized(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[var(--border)] bg-[var(--bg)] text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            <span className="text-xs text-[var(--text)]">Session anonymisée</span>
          </label>
          {isAnonymized && (
            <div style={{ flex: 1 }}>
              <label className="block text-xs font-medium text-[var(--text2)] mb-1">Mode correction</label>
              <select
                value={correctionMode}
                onChange={(e) => setCorrectionMode(e.target.value as 'OWN_CLASS' | 'CROSSED')}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-xs md:text-[12.5px] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              >
                <option value="OWN_CLASS">Propre classe</option>
                <option value="CROSSED">Croisé</option>
              </select>
            </div>
          )}
        </div>
        <div>
          <button
            onClick={onCreate}
            disabled={creating}
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs md:text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
          >
            <Plus size={14} />
            {creating ? 'Création...' : 'Créer la session'}
          </button>
        </div>
      </div>
    </div>
  )
}
