'use client'

import { Inbox, Check } from 'lucide-react'
import { inputStyle, labelStyle, type Chapitre, type Classe, type ProgressionData, type Subject } from './types'

interface PedagogieProgressionTabProps {
  classes: Classe[]
  subjects: Subject[]
  progClassId: string
  progSubjectId: string
  progressionData: ProgressionData | null
  loadingProg: boolean
  onChangeClass: (id: string) => void
  onChangeSubject: (id: string) => void
  onLoadProgression: () => void
}

export default function PedagogieProgressionTab({
  classes,
  subjects,
  progClassId,
  progSubjectId,
  progressionData,
  loadingProg,
  onChangeClass,
  onChangeSubject,
  onLoadProgression,
}: PedagogieProgressionTabProps) {
  return (
    <div>
      <div className="grid grid-cols-2 sm:flex" style={{ gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="col-span-1 sm:w-[200px]">
          <label style={labelStyle}>Classe</label>
          <select value={progClassId} onChange={e => onChangeClass(e.target.value)} className="w-full" style={inputStyle}>
            <option value="">— Choisir —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-span-1 sm:w-[200px]">
          <label style={labelStyle}>Matière</label>
          <select value={progSubjectId} onChange={e => onChangeSubject(e.target.value)} className="w-full" style={inputStyle}>
            <option value="">— Choisir —</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button onClick={onLoadProgression} disabled={!progClassId || !progSubjectId}
          className="col-span-2 sm:col-span-1"
          style={{ padding: '8px 16px', borderRadius: 8, background: !progClassId || !progSubjectId ? 'var(--text3)' : 'var(--sidebar)', color: 'white', border: 'none', fontSize: 12, fontWeight: 800, fontFamily: 'inherit', cursor: !progClassId || !progSubjectId ? 'not-allowed' : 'pointer' }}>
          Voir progression
        </button>
      </div>

      {loadingProg && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Calcul...</div>}

      {!loadingProg && progressionData && (
        <>
          {!progressionData.programme ? (
            <div className="px-5 py-8 text-center" style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: 'var(--text3)' }}><Inbox size={32} strokeWidth={1.5} /></div>
              <div className="text-xs md:text-sm font-bold mb-1" style={{ color: 'var(--text3)' }}>Aucun programme défini pour cette classe/matière</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text3)' }}>Créez d'abord un programme dans l'onglet Programmes.</div>
            </div>
          ) : (
            <div className="p-4 md:p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <div className="text-sm md:text-base font-bold font-spectral" style={{ color: 'var(--text)' }}>
                  {progressionData.programme.titre}
                </div>
                {(progressionData.modulesDesactivesCount ?? 0) > 0 && (
                  <span style={{
                    fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
                    background: 'var(--amber-light)', color: 'var(--amber)',
                  }}>
                    {progressionData.modulesDesactivesCount} module{(progressionData.modulesDesactivesCount ?? 0) > 1 ? 's' : ''} désactivé{(progressionData.modulesDesactivesCount ?? 0) > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Métriques */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: progressionData.programme.source === 'national' ? 'Leçons réalisées' : 'Chapitres réalisés', value: `${progressionData.chapitresRealises}/${progressionData.chapitresTotal}`, color: 'var(--sidebar)' },
                  { label: 'Progression réelle', value: progressionData.progressionPct !== null ? `${progressionData.progressionPct}%` : '—', color: progressionData.progressionPct !== null && progressionData.progressionPct >= (progressionData.attenduPct ?? 0) ? 'var(--green)' : 'var(--red)' },
                  { label: 'Progression attendue', value: progressionData.attenduPct !== null ? `${progressionData.attenduPct}%` : '—', color: 'var(--text3)' },
                  { label: 'Retard', value: progressionData.retardPct !== null ? (progressionData.retardPct > 0 ? `-${progressionData.retardPct}%` : 'À jour') : '—', color: (progressionData.retardPct ?? 0) > 15 ? 'var(--red)' : (progressionData.retardPct ?? 0) > 0 ? 'var(--amber)' : 'var(--green)' },
                ].map(m => (
                  <div key={m.label} className="rounded-lg px-3 py-2.5 md:px-3.5 md:py-3 text-center bg-[var(--bg)]">
                    <div className="text-base md:text-lg font-black" style={{ color: m.color }}>{m.value}</div>
                    <div className="text-[10px] font-bold text-[var(--text3)] mt-0.5 uppercase tracking-wider">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* État des modules (lecture seule pour l'administration) */}
              {progressionData.modules && progressionData.modules.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="text-[11px] font-bold text-[var(--text3)] mb-2 uppercase tracking-wider">
                    Modules (lecture seule)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {progressionData.modules.map(m => (
                      <span
                        key={m.moduleOrdre}
                        style={{
                          fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                          background: m.actif ? 'var(--bg)' : 'var(--bg2)',
                          color: m.actif ? 'var(--text2)' : 'var(--text3)',
                          border: `1px solid ${m.actif ? 'var(--border)' : 'var(--border2)'}`,
                          opacity: m.actif ? 1 : 0.75,
                        }}
                      >
                        M{m.moduleOrdre} · {m.moduleTitre} : {m.actif ? `${m.leconsRealisees}/${m.leconsTotal}` : 'Désactivé'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Barre double */}
              <div style={{ marginBottom: 20 }}>
                <div className="text-xs font-bold mb-1 text-[var(--text3)] uppercase tracking-wider">Progression du programme</div>
                <div style={{ background: 'var(--bg2)', borderRadius: 8, height: 16, overflow: 'hidden', position: 'relative' }}>
                  {progressionData.attenduPct !== null && (
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progressionData.attenduPct}%`, background: 'var(--border)', zIndex: 1 }} />
                  )}
                  {progressionData.progressionPct !== null && (
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progressionData.progressionPct}%`, background: (progressionData.retardPct ?? 0) > 15 ? 'var(--red)' : 'var(--green)', zIndex: 2, borderRadius: 8, transition: 'width 0.5s ease' }} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  <span>Vert = réalisé · Gris = attendu à date</span>
                  {progressionData.hasHeuresPrevu && progressionData.totalHeuresPrevu !== null && progressionData.heuresRealisees !== null && (
                    <span>{progressionData.heuresRealisees}h / {progressionData.totalHeuresPrevu}h</span>
                  )}
                </div>
              </div>

              {/* Liste des chapitres */}
              <div className="text-[11px] font-bold text-[var(--text3)] mb-2 uppercase tracking-wider">
                {progressionData.programme.source === 'national' ? 'Leçons' : 'Chapitres'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(progressionData.chapitres ?? []).map((c: Chapitre & { realise: boolean }) => (
                  <div key={c.id} className="gap-2.5 md:gap-3.5 px-3 py-2 md:px-3.5 md:py-2 flex items-center rounded-lg" style={{ background: c.moduleActif === false ? 'var(--bg2)' : c.realise ? 'var(--green-light)' : 'var(--bg)', border: `1px solid ${c.realise && c.moduleActif !== false ? 'var(--green-light)' : 'var(--bg2)'}`, opacity: c.moduleActif === false ? 0.6 : 1 }}>
                    <div className="w-5 h-5 text-xs rounded-full flex items-center justify-center font-black flex-shrink-0" style={{ background: c.realise ? 'var(--green)' : 'var(--border)', color: c.realise ? 'white' : 'var(--text3)' }}>
                      {c.realise ? <Check size={12} strokeWidth={3} /> : c.ordre}
                    </div>
                    <span className="text-xs md:text-sm flex-1 font-semibold" style={{ color: c.realise ? 'var(--green)' : 'var(--text2)' }}>
                      {c.numeroAffiche ? `${c.numeroAffiche} — ` : ''}{c.titre}
                    </span>
                    {(c.sourceRealisation === 'CAHIER' || c.sourceRealisation === 'LES_DEUX') && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--blue-light)', color: 'var(--blue)' }}>
                        validée via le cahier de texte
                      </span>
                    )}
                    {c.moduleActif === false && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--bg)', color: 'var(--text3)' }}>
                        Module désactivé
                      </span>
                    )}
                    {c.volumeHeuresPrevu !== null && c.volumeHeuresPrevu !== undefined && (
                      <span className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>{c.volumeHeuresPrevu}h</span>
                    )}
                    {c.sequenceCibleFin && (
                      <span className="text-[10px] md:text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
                        Seq {c.sequenceCibleFin}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
