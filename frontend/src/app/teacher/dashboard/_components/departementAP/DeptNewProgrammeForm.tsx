'use client'
import { Plus, Loader2 } from 'lucide-react'
import { deptInputStyle, deptLabelStyle, type DeptSubjectOption } from './types'

interface Props {
  formTitre: string
  formSubjectId: string
  formLevel: string
  formClassId: string
  savingProg: boolean
  deptSubjects: DeptSubjectOption[]
  classesList: { id: string; name: string }[]
  onTitreChange: (v: string) => void
  onSubjectChange: (v: string) => void
  onLevelChange: (v: string) => void
  onClassChange: (v: string) => void
  onSubmit: () => void
}

export default function DeptNewProgrammeForm({
  formTitre,
  formSubjectId,
  formLevel,
  formClassId,
  savingProg,
  deptSubjects,
  classesList,
  onTitreChange,
  onSubjectChange,
  onLevelChange,
  onClassChange,
  onSubmit,
}: Props) {
  return (
    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3 shadow-xs">
      <div className="text-xs font-bold text-[var(--text)]">Nouveau programme départemental</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label style={deptLabelStyle}>Titre du programme *</label>
          <input
            value={formTitre}
            onChange={e => onTitreChange(e.target.value)}
            placeholder="Ex: Mathématiques 6ème — Programme officiel 2026/2027"
            style={deptInputStyle}
          />
        </div>
        <div>
          <label style={deptLabelStyle}>Matière *</label>
          <select
            value={formSubjectId}
            onChange={e => onSubjectChange(e.target.value)}
            style={deptInputStyle}
          >
            {deptSubjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={deptLabelStyle}>Niveau (ex: 6e, 5e, 4e, 3e...)</label>
          <input
            value={formLevel}
            onChange={e => onLevelChange(e.target.value)}
            placeholder="Ex: 6e"
            style={deptInputStyle}
          />
        </div>
        <div>
          <label style={deptLabelStyle}>Classe spécifique (optionnel)</label>
          <select
            value={formClassId}
            onChange={e => onClassChange(e.target.value)}
            style={deptInputStyle}
          >
            <option value="">— Toutes classes du niveau —</option>
            {classesList.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={onSubmit}
            disabled={savingProg || !formTitre.trim() || !formSubjectId}
            className="w-full h-[38px] px-4 rounded-lg text-xs font-extrabold text-white border-none cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            style={{ background: 'var(--sidebar)' }}
          >
            {savingProg ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            <span>{savingProg ? 'Enregistrement…' : 'Créer le programme'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
