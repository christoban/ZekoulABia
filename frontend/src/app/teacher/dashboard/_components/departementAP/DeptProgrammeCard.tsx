'use client'
import { Plus, Trash2, ChevronDown, ChevronRight, Edit3, X, Check, Loader2 } from 'lucide-react'
import { deptInputStyle, deptLabelStyle, type Programme, type EditingChapitreState } from './types'

interface Props {
  programme: Programme
  isExpanded: boolean
  isAddingChap: boolean
  chapTitre: string
  chapHeures: number
  chapSeq: string
  savingChap: boolean
  editingChap: EditingChapitreState | null
  savingEditChap: boolean
  onToggleExpand: () => void
  onStartAddChap: () => void
  onCancelAddChap: () => void
  onChapTitreChange: (v: string) => void
  onChapHeuresChange: (v: number) => void
  onChapSeqChange: (v: string) => void
  onAddChapitre: () => void
  onDeleteProgramme: () => void
  onStartEditChap: (chap: EditingChapitreState) => void
  onChangeEditingChap: (updater: (prev: EditingChapitreState | null) => EditingChapitreState | null) => void
  onUpdateChapitre: () => void
  onCancelEditChap: () => void
  onDeleteChapitre: (chapitreId: string, titre: string) => void
}

export default function DeptProgrammeCard({
  programme: p,
  isExpanded,
  isAddingChap,
  chapTitre,
  chapHeures,
  chapSeq,
  savingChap,
  editingChap,
  savingEditChap,
  onToggleExpand,
  onStartAddChap,
  onCancelAddChap,
  onChapTitreChange,
  onChapHeuresChange,
  onChapSeqChange,
  onAddChapitre,
  onDeleteProgramme,
  onStartEditChap,
  onChangeEditingChap,
  onUpdateChapitre,
  onCancelEditChap,
  onDeleteChapitre,
}: Props) {
  const hasHours = p.chapitres.some(c => c.volumeHeuresPrevu !== null && c.volumeHeuresPrevu !== undefined)
  const totalHours = hasHours ? p.chapitres.reduce((sum, c) => sum + (c.volumeHeuresPrevu ?? 0), 0) : null
  const sortedChapitres = [...p.chapitres].sort((a, b) => a.ordre - b.ordre)

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xs">
      {/* Header accordéon du programme */}
      <div
        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--bg2)] transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[var(--text3)]">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <div>
            <div className="text-sm font-bold text-[var(--text)] truncate">{p.titre}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>
                {p.subject?.name}
              </span>
              {p.level && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--bg2)', color: 'var(--text2)' }}>
                  Niveau {p.level}
                </span>
              )}
              {p.class && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
                  {p.class.name}
                </span>
              )}
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold text-[var(--text3)]">
                {p.chapitres.length} {p.source === 'national' ? 'leçon' : 'chapitre'}{p.chapitres.length > 1 ? 's' : ''}
                {totalHours !== null ? ` (${totalHours}h prévues)` : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onStartAddChap}
            className="px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer inline-flex items-center gap-1 border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg2)] text-[var(--text)]"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">Ajouter chapitre</span>
          </button>
          <button
            onClick={onDeleteProgramme}
            className="p-1.5 rounded-md text-[var(--red)] hover:bg-[var(--red-light)] border-none cursor-pointer transition-colors"
            title="Supprimer ce programme"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Contenu dépliable : Liste des chapitres + formulaire d'ajout */}
      {isExpanded && (
        <div className="p-3.5 border-t border-[var(--border)] bg-[var(--bg)]/40 space-y-3">
          {isAddingChap && (
            <div className="p-3 rounded-lg border border-[var(--border2)] bg-[var(--surface)] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text)]">Ajouter un chapitre</span>
                <button onClick={onCancelAddChap} className="text-[var(--text3)] hover:text-[var(--text)] border-none bg-transparent cursor-pointer">
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="sm:col-span-2">
                  <label style={deptLabelStyle}>Titre du chapitre *</label>
                  <input
                    value={chapTitre}
                    onChange={e => onChapTitreChange(e.target.value)}
                    placeholder="Ex: Chapitre 1 — Nombres entiers et décimaux"
                    style={deptInputStyle}
                  />
                </div>
                <div>
                  <label style={deptLabelStyle}>Volume horaire (heures)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={chapHeures}
                    onChange={e => onChapHeuresChange(parseInt(e.target.value, 10) || 1)}
                    style={deptInputStyle}
                  />
                </div>
                <div>
                  <label style={deptLabelStyle}>Séquence cible de fin (1-6)</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={chapSeq}
                    onChange={e => onChapSeqChange(e.target.value)}
                    placeholder="Ex: 2"
                    style={deptInputStyle}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={onCancelAddChap}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text2)] bg-[var(--bg2)] border-none cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={onAddChapitre}
                  disabled={savingChap || !chapTitre.trim()}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold text-white border-none cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                  style={{ background: 'var(--sidebar)' }}
                >
                  {savingChap ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  <span>Enregistrer le chapitre</span>
                </button>
              </div>
            </div>
          )}

          {sortedChapitres.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text3)] italic">
              Aucun chapitre défini pour ce programme. Cliquez sur « Ajouter chapitre » ci-dessus.
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedChapitres.map(chap => {
                const isEditingThis = editingChap?.id === chap.id
                return (
                  <div
                    key={chap.id}
                    className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-3 text-xs"
                  >
                    {isEditingThis ? (
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input
                          className="sm:col-span-2"
                          value={editingChap.titre}
                          onChange={e => onChangeEditingChap(prev => prev ? { ...prev, titre: e.target.value } : null)}
                          style={deptInputStyle}
                        />
                        <input
                          type="number"
                          min={1}
                          placeholder="Heures"
                          value={editingChap.volumeHeuresPrevu ?? ''}
                          onChange={e => onChangeEditingChap(prev => prev ? { ...prev, volumeHeuresPrevu: e.target.value === '' ? null : (parseInt(e.target.value, 10) || 1) } : null)}
                          style={deptInputStyle}
                        />
                        <div className="flex items-center gap-1">
                          <button
                            onClick={onUpdateChapitre}
                            disabled={savingEditChap}
                            className="p-1.5 rounded-md bg-[var(--green-light)] text-[var(--green)] border-none cursor-pointer font-bold"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={onCancelEditChap}
                            className="p-1.5 rounded-md bg-[var(--bg2)] text-[var(--text2)] border-none cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-[var(--bg2)] text-[10.5px] font-extrabold text-[var(--text2)] flex items-center justify-center shrink-0">
                            {chap.ordre}
                          </span>
                          <span className="font-bold text-[var(--text)] truncate">{chap.titre}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {chap.volumeHeuresPrevu !== null && chap.volumeHeuresPrevu !== undefined && (
                            <span className="font-semibold text-[var(--text3)]">{chap.volumeHeuresPrevu}h</span>
                          )}
                          {chap.sequenceCibleFin && (
                            <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-[var(--purple-light)] text-[var(--purple)]">
                              Fin S{chap.sequenceCibleFin}
                            </span>
                          )}
                          <button
                            onClick={() => onStartEditChap({
                              id: chap.id,
                              titre: chap.titre,
                              volumeHeuresPrevu: chap.volumeHeuresPrevu,
                              sequenceCibleFin: chap.sequenceCibleFin,
                            })}
                            className="p-1 rounded text-[var(--text2)] hover:bg-[var(--bg2)] border-none cursor-pointer"
                            title="Modifier"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => onDeleteChapitre(chap.id, chap.titre)}
                            className="p-1 rounded text-[var(--red)] hover:bg-[var(--red-light)] border-none cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
