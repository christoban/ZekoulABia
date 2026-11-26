'use client'

import { CheckCircle2 } from 'lucide-react'
import type { Alerte, OnToast } from './types'

interface PedagogieAlertesTabProps {
  loading: boolean
  alertes: Alerte[]
  onRefresh: () => void
  onToast: OnToast
  onOpenProgramme: (programmeId: string) => void
}

const niveauColor = (n: 'CRITIQUE' | 'MODERE') =>
  n === 'CRITIQUE' ? { bg: 'var(--red-light)', color: 'var(--red)' } : { bg: 'var(--amber-light)', color: 'var(--amber)' }

export default function PedagogieAlertesTab({
  loading,
  alertes,
  onRefresh,
  onToast,
  onOpenProgramme,
}: PedagogieAlertesTabProps) {
  return (
    <div>
      <div className="flex-col sm:flex-row gap-3 sm:gap-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div className="text-xs font-medium" style={{ color: 'var(--text2)' }}>
          Classes/matières avec un retard significatif par rapport au calendrier prévu
        </div>
        <button onClick={onRefresh} className="w-full sm:w-auto flex-shrink-0" style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--sidebar)', color: 'white', border: 'none', fontSize: 12, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
          Actualiser
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Calcul en cours...</div>
      ) : alertes.length === 0 ? (
        <div className="px-5 py-8 text-center" style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: 'var(--green)' }}><CheckCircle2 size={32} strokeWidth={1.5} /></div>
          <div className="text-xs md:text-sm font-bold mb-1" style={{ color: 'var(--green)' }}>Aucun retard significatif détecté</div>
          <div className="text-xs font-medium" style={{ color: 'var(--text3)' }}>
            Toutes les classes sont dans les délais prévus, ou aucun programme n'est encore défini.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alertes.map((a, i) => {
            const nc = niveauColor(a.niveau)
            return (
              <div key={i} className="rounded-xl p-4 md:px-5 md:py-4 border border-[var(--border)] bg-[var(--surface)] shadow-xs flex items-start gap-3.5 md:gap-5" style={{ borderLeft: `4px solid ${a.niveau === 'CRITIQUE' ? 'var(--red)' : 'var(--amber)'}` }}>
                <div className="px-3 py-2 md:px-3.5 md:py-2.5 flex-shrink-0 text-center rounded-xl" style={{ background: nc.bg }}>
                  <div className="text-base md:text-xl font-black" style={{ color: nc.color }}>-{a.retardPct}%</div>
                  <div className="text-[10px] md:text-xs font-bold uppercase" style={{ color: nc.color }}>{a.niveau}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex flex-wrap gap-2 mb-1.5">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>{a.className}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>{a.subjectName}</span>
                  </div>
                  <div className="text-xs md:text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>{a.programmeTitre}</div>
                  <div className="flex flex-wrap gap-3 md:gap-5 text-xs font-semibold" style={{ color: 'var(--text2)' }}>
                    <span>Réalisé : {a.progressionPct}%</span>
                    <span>Attendu : {a.attenduPct}%</span>
                    <span>{a.chapitresRealises}/{a.chapitresTotal} chapitres</span>
                    {(a.modulesDesactivesCount ?? 0) > 0 && (
                      <span style={{ color: 'var(--amber)' }}>
                        {a.modulesDesactivesCount} module{(a.modulesDesactivesCount ?? 0) > 1 ? 's' : ''} désactivé{(a.modulesDesactivesCount ?? 0) > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {/* Barre de progression */}
                  <div style={{ marginTop: 10, position: 'relative' }}>
                    <div style={{ background: 'var(--bg2)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${a.attenduPct}%`, background: 'var(--border)', position: 'absolute', left: 0, top: 0, borderRadius: 6 }} />
                      <div style={{ height: '100%', width: `${a.progressionPct}%`, background: a.niveau === 'CRITIQUE' ? 'var(--red)' : 'var(--amber)', borderRadius: 6, position: 'relative', zIndex: 1 }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      La barre grise indique le niveau d'avancement attendu à la date d'aujourd'hui.
                    </div>
                  </div>

                  {/* Actions RACI Admin */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => onToast(`Signalement d'alerte transmis à l'Animateur Pédagogique et à l'Enseignant (${a.className} — ${a.subjectName})`, 'success')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      style={{ background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid var(--amber)' }}
                    >
                      <span>🔔 Signaler / Relancer l'Animateur Pédagogique</span>
                    </button>
                    <button
                      onClick={() => onOpenProgramme(a.programmeId)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)' }}
                    >
                      <span>✏️ Intervenir (Urgence Admin)</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
