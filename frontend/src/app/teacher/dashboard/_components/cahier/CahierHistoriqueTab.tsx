'use client'
import { RotateCcw, X, Loader2, Inbox } from 'lucide-react'
import type { PendingAction } from '@/lib/offline/db'
import { SEL, LBL, type CahierEntry, type Classe, type PendingCahierPayload, type TranslateFn } from './types'

interface Props {
  classes: Classe[]
  filterClass: string
  entries: CahierEntry[]
  loadingEntries: boolean
  pendingEntries: PendingAction[]
  onFilterClassChange: (v: string) => void
  onReload: () => void
  t: TranslateFn
}

export default function CahierHistoriqueTab({
  classes,
  filterClass,
  entries,
  loadingEntries,
  pendingEntries,
  onFilterClassChange,
  onReload,
  t,
}: Props) {
  return (
    <div className="w-full max-w-2xl">
      <div className="flex gap-2 mb-3 items-end">
        <div style={{ flex: 1 }}>
          <label style={LBL}>{t('cahier_de_texte.history_filter_label')}</label>
          <select value={filterClass} onChange={e => onFilterClassChange(e.target.value)} style={SEL}>
            <option value="">{t('cahier_de_texte.history_filter_all')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button onClick={onReload} style={{
          height: 36, padding: '0 12px', borderRadius: 8, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white',
          border: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><RotateCcw size={14} strokeWidth={2} /></button>
      </div>

      {/* Entrées hors-ligne en attente */}
      {pendingEntries.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            {t('cahier_de_texte.history_pending_title').replace('{count}', String(pendingEntries.length))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendingEntries.map(entry => {
              const p = entry.payload as PendingCahierPayload
              const isFailed = entry.status === 'FAILED'
              return (
                <div key={entry.id} style={{
                  background: isFailed ? 'var(--red-light)' : 'var(--amber-light)',
                  border: `1px solid ${isFailed ? 'var(--red-light)' : 'var(--amber)'}`,
                  borderRadius: 10, padding: '10px 12px', position: 'relative',
                }}>
                  <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex' }}>
                    {isFailed ? <X size={14} strokeWidth={2} /> : <Loader2 size={14} strokeWidth={2} className="animate-spin" />}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '1px 6px', borderRadius: 12, fontSize: 10.5, fontWeight: 700 }}>
                      {p._className ?? p.classId}
                    </span>
                    <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '1px 6px', borderRadius: 12, fontSize: 10.5, fontWeight: 700 }}>
                      {p._subjectName ?? p.subjectId}
                    </span>
                    <span style={{
                      background: isFailed ? 'var(--red-light)' : 'var(--amber-light)', color: isFailed ? 'var(--red)' : 'var(--amber)',
                      padding: '1px 6px', borderRadius: 12, fontSize: 10.5, fontWeight: 700,
                    }}>
                      {isFailed ? t('cahier_de_texte.history_pending_failed') : t('cahier_de_texte.history_pending_pending')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>
                    {p.contenuRealise ?? p.contenuLibre ?? '—'}
                  </div>
                  {p.devoirsDonnes && (
                    <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 4, fontStyle: 'italic' }}>
                      {t('cahier_de_texte.history_pending_homework').replace('{text}', p.devoirsDonnes ?? '')}
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 4 }}>
                    {p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Entrées synchronisées (API) */}
      {loadingEntries ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('cahier_de_texte.history_loading')}</div>
      ) : entries.length === 0 && pendingEntries.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Inbox size={26} strokeWidth={2} /></div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{t('cahier_de_texte.history_empty')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(e => (
            <div key={e.id} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center', flexShrink: 0, minWidth: 38 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>
                    {new Date(e.date).toLocaleDateString('fr-FR', { month: 'short' })}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                    {new Date(e.date).getDate()}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '2px 7px', borderRadius: 12, fontSize: 10.5, fontWeight: 700 }}>
                      {e.class.name}
                    </span>
                    <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '2px 7px', borderRadius: 12, fontSize: 10.5, fontWeight: 700 }}>
                      {e.subject.name}
                    </span>
                    {e.chapitre && (
                      <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '2px 7px', borderRadius: 12, fontSize: 10.5, fontWeight: 700 }}>
                        Ch.{e.chapitre.ordre} — {e.chapitre.titre}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600, marginBottom: (e.devoirsDonnes || e.contenuLibre) ? 6 : 0 }}>
                    {e.contenuRealise ?? e.contenuLibre ?? '—'}
                  </div>
                  {e.contenuLibre && e.contenuRealise && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{e.contenuLibre}</div>
                  )}
                  {e.devoirsDonnes && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', padding: '6px 10px', background: 'var(--amber-light)', borderRadius: 8, borderLeft: '3px solid var(--amber)' }}>
                      {t('cahier_de_texte.history_pending_homework').replace('{text}', e.devoirsDonnes)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
