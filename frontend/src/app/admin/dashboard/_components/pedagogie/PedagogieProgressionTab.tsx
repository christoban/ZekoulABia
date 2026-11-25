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
              <div className="text-sm md:text-base font-bold font-spectral mb-3" style={{ color: 'var(--text)' }}>
                {progressionData.programme.titre}
              </div>

              {/* Métriques */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Chapitres réalisés', value: `${progressionData.chapitresRealises}/${progressionData.chapitresTotal}`, color: 'var(--sidebar)' },
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
                  <span>{progressionData.heuresRealisees}h / {progressionData.totalHeuresPrevu}h</span>
                </div>
              </div>

              {/* Liste des chapitres */}
              <div className="text-[11px] font-bold text-[var(--text3)] mb-2 uppercase tracking-wider">
                Chapitres
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(progressionData.chapitres ?? []).map((c: Chapitre & { realise: boolean }) => (
                  <div key={c.id} className="gap-2.5 md:gap-3.5 px-3 py-2 md:px-3.5 md:py-2 flex items-center rounded-lg" style={{ background: c.realise ? 'var(--green-light)' : 'var(--bg)', border: `1px solid ${c.realise ? 'var(--green-light)' : 'var(--bg2)'}` }}>
                    <div className="w-5 h-5 text-xs rounded-full flex items-center justify-center font-black flex-shrink-0" style={{ background: c.realise ? 'var(--green)' : 'var(--border)', color: c.realise ? 'white' : 'var(--text3)' }}>
                      {c.realise ? <Check size={12} strokeWidth={3} /> : c.ordre}
                    </div>
                    <span className="text-xs md:text-sm flex-1 font-semibold" style={{ color: c.realise ? 'var(--green)' : 'var(--text2)' }}>{c.titre}</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>{c.volumeHeuresPrevu}h</span>
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
