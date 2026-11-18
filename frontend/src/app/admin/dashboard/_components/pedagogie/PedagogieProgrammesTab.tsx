'use client'

import { Inbox } from 'lucide-react'
import { inputStyle, labelStyle, type Classe, type Programme, type Subject } from './types'

interface PedagogieProgrammesTabProps {
  programmes: Programme[]
  subjects: Subject[]
  classes: Classe[]
  loading: boolean
  saving: boolean
  formTitre: string
  formSubjectId: string
  formClassId: string
  formLevel: string
  expandedProg: string | null
  addingChapFor: string | null
  chapTitre: string
  chapHeures: number
  chapSeq: string
  onChangeFormTitre: (v: string) => void
  onChangeFormSubjectId: (v: string) => void
  onChangeFormClassId: (v: string) => void
  onChangeFormLevel: (v: string) => void
  onToggleExpandProg: (id: string) => void
  onSetAddingChapFor: (id: string | null) => void
  onChangeChapTitre: (v: string) => void
  onChangeChapHeures: (v: number) => void
  onChangeChapSeq: (v: string) => void
  onCreateProgramme: () => void
  onDeleteProgramme: (id: string) => void
  onAddChapitre: (programmeId: string) => void
  onDeleteChapitre: (id: string) => void
}

export default function PedagogieProgrammesTab({
  programmes,
  subjects,
  classes,
  loading,
  saving,
  formTitre,
  formSubjectId,
  formClassId,
  formLevel,
  expandedProg,
  addingChapFor,
  chapTitre,
  chapHeures,
  chapSeq,
  onChangeFormTitre,
  onChangeFormSubjectId,
  onChangeFormClassId,
  onChangeFormLevel,
  onToggleExpandProg,
  onSetAddingChapFor,
  onChangeChapTitre,
  onChangeChapHeures,
  onChangeChapSeq,
  onCreateProgramme,
  onDeleteProgramme,
  onAddChapitre,
  onDeleteChapitre,
}: PedagogieProgrammesTabProps) {
  return (
    <div>
      {/* Formulaire création */}
      <div className="p-4 md:p-5 mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="text-xs md:text-sm font-bold text-[var(--text)] mb-2.5">Nouveau programme</div>
        <div className="grid grid-cols-2 sm:[grid-template-columns:2fr_1fr_1fr] gap-3 mb-3">
          <div className="col-span-2 sm:col-span-1">
            <label style={labelStyle}>Titre *</label>
            <input value={formTitre} onChange={e => onChangeFormTitre(e.target.value)} placeholder="Ex: Programme Maths 3ème 2025-2026" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Matière *</label>
            <select value={formSubjectId} onChange={e => onChangeFormSubjectId(e.target.value)} style={inputStyle}>
              <option value="">— Choisir —</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Classe (optionnel)</label>
            <select value={formClassId} onChange={e => onChangeFormClassId(e.target.value)} style={inputStyle}>
              <option value="">— Toutes classes du niveau —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        {!formClassId && (
          <div className="mb-3">
            <label style={labelStyle}>Niveau (si non lié à une classe précise)</label>
            <input value={formLevel} onChange={e => onChangeFormLevel(e.target.value)} placeholder="Ex: 3ème, Terminale..." style={{ ...inputStyle, maxWidth: 300 }} />
          </div>
        )}
        <button onClick={onCreateProgramme} disabled={saving || !formTitre.trim() || !formSubjectId}
          className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs md:text-sm font-extrabold text-white border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: saving || !formTitre.trim() || !formSubjectId ? 'var(--text3)' : 'var(--sidebar)' }}>
          {saving ? 'Création...' : 'Créer le programme'}
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="p-8 text-center text-xs md:text-sm text-[var(--text3)]">Chargement...</div>
      ) : programmes.length === 0 ? (
        <div className="px-5 py-8 text-center bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <div className="flex justify-center mb-2 text-[var(--text3)]"><Inbox size={32} strokeWidth={1.5} /></div>
          <div className="text-sm font-semibold text-[var(--text3)]">Aucun programme défini</div>
          <div className="text-xs text-[var(--border2)] mt-1">Créez un programme ci-dessus, puis ajoutez ses chapitres.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {programmes.map(p => (
            <div key={p.id} className="rounded-xl shadow-xs md:shadow-none bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
              {/* Header prog */}
              <div className="p-3 md:px-4 md:py-3.5 flex items-center gap-3 flex-wrap cursor-pointer"
                onClick={() => onToggleExpandProg(p.id)}>
                <span className="text-xs md:text-sm text-[var(--text2)]">{expandedProg === p.id ? '▼' : '▶'}</span>
                <div className="flex-1 min-w-[160px]">
                  <div className="text-xs md:text-sm font-bold text-[var(--text)]">{p.titre}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="text-[11px] md:text-xs px-2 py-0.5 rounded-full font-extrabold" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>{p.subject.name}</span>
                    {p.class && <span className="text-[11px] md:text-xs px-2 py-0.5 rounded-full font-extrabold" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>{p.class.name}</span>}
                    {p.level && !p.class && <span className="text-[11px] md:text-xs px-2 py-0.5 rounded-full font-extrabold" style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>{p.level}</span>}
                    <span className="text-[11px] md:text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>{p.chapitres.length} chapitre{p.chapitres.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); onDeleteProgramme(p.id) }}
                  className="text-xs px-2.5 py-1 rounded-md font-bold bg-[var(--red-light)] text-[var(--red)] border-none cursor-pointer">
                  Supprimer
                </button>
              </div>

              {expandedProg === p.id && (
                <div className="p-3 md:px-4 md:py-3.5 border-t border-[var(--border)]">
                  {/* Chapitres */}
                  {p.chapitres.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {p.chapitres.map(c => (
                        <div key={c.id} className="gap-2 md:gap-3 px-2.5 py-1.5 md:px-3 md:py-2 flex items-center flex-wrap bg-[var(--bg)] rounded-lg">
                          <span className="w-5 h-5 md:w-5.5 md:h-5.5 text-xs rounded-full flex items-center justify-center font-extrabold flex-shrink-0 text-white" style={{ background: 'var(--sidebar)' }}>{c.ordre}</span>
                          <span className="text-xs md:text-sm font-semibold flex-1 min-w-[120px] text-[var(--text)]">{c.titre}</span>
                          <span className="text-xs font-semibold text-[var(--text3)]">{c.volumeHeuresPrevu}h</span>
                          {c.sequenceCibleFin && <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>Seq {c.sequenceCibleFin}</span>}
                          <button onClick={() => onDeleteChapitre(c.id)}
                            className="text-xs px-2 py-0.5 rounded-md font-extrabold bg-[var(--red-light)] text-[var(--red)] border-none cursor-pointer">
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulaire ajout chapitre */}
                  {addingChapFor === p.id ? (
                    <div className="bg-[var(--bg)] rounded-lg p-3 md:p-3.5 flex flex-col gap-2.5">
                      <div className="grid grid-cols-2 sm:[grid-template-columns:2fr_1fr_1fr] gap-2.5">
                        <div className="col-span-2 sm:col-span-1">
                          <label style={labelStyle}>Titre *</label>
                          <input value={chapTitre} onChange={e => onChangeChapTitre(e.target.value)} placeholder="Ex: Fonctions numériques" style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Durée (h)</label>
                          <input type="number" value={chapHeures} min={1} max={50} onChange={e => onChangeChapHeures(parseInt(e.target.value) || 2)} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Séquence cible</label>
                          <select value={chapSeq} onChange={e => onChangeChapSeq(e.target.value)} style={inputStyle}>
                            <option value="">—</option>
                            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Séquence {n}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <button onClick={() => onAddChapitre(p.id)}
                          className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--sidebar)] border-none cursor-pointer">
                          Ajouter
                        </button>
                        <button onClick={() => { onSetAddingChapFor(null); onChangeChapTitre(''); onChangeChapHeures(2); onChangeChapSeq('') }}
                          className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg text-xs font-bold text-[var(--text2)] bg-[var(--bg2)] border-none cursor-pointer">
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => onSetAddingChapFor(p.id)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-[var(--sidebar)] bg-[var(--bg2)] border border-dashed border-[var(--border2)] cursor-pointer">
                      + Ajouter un chapitre
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
