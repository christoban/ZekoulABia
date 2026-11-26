'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Building2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import type { OnToast } from './types'

type OptionClassique = 'Latin' | 'Grec'

interface ClasseProposition {
  classe: { id: string; name: string; level: string | null; filiere: string | null }
  resume: {
    totalMatieres: number
    aCreer: number
    ignores: number
    choixRequis: number
    impossibles: number
    totalLeconsACreer: number
  }
  choixRequis: Array<{
    subjectId: string
    subjectName: string
    options: OptionClassique[]
  }>
}

interface EcolePropositionData {
  resume: {
    totalClasses: number
    classesAvecCreations: number
    totalProgrammesACreer: number
    totalLeconsACreer: number
    totalIgnores: number
    totalChoixRequis: number
    totalImpossibles: number
  }
  classes: ClasseProposition[]
}

interface Props {
  open: boolean
  onClose: () => void
  onApplied: () => void
  onToast: OnToast
}

export default function InitProgrammesEcoleModal({
  open,
  onClose,
  onApplied,
  onToast,
}: Props) {
  const [optionsParClasse, setOptionsParClasse] = useState<
    Record<string, Record<string, OptionClassique>>
  >({})
  const [proposition, setProposition] = useState<EcolePropositionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const lancerApercu = useCallback(
    async (opts: Record<string, Record<string, OptionClassique>>) => {
      setLoading(true)
      setErrorMsg(null)
      try {
        const res = await fetchApi('/api/v2/pedagogie/ecole/initialiser-programmes/propose', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionsClassiquesParClasse: opts }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          setErrorMsg(json.message ?? "Impossible d'analyser les classes de l'école")
          setProposition(null)
        } else {
          setProposition(json.data as EcolePropositionData)
        }
      } catch {
        setErrorMsg('Erreur réseau lors de la prévisualisation')
        setProposition(null)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (open) {
      lancerApercu(optionsParClasse)
    } else {
      setProposition(null)
      setOptionsParClasse({})
      setErrorMsg(null)
    }
  }, [open, optionsParClasse, lancerApercu])

  const handleApply = async () => {
    if (!proposition || proposition.resume.totalProgrammesACreer === 0) return
    setApplying(true)
    setErrorMsg(null)
    try {
      const res = await fetchApi('/api/v2/pedagogie/ecole/initialiser-programmes/apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionsClassiquesParClasse: optionsParClasse }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErrorMsg(json.message ?? "Erreur lors de l'initialisation globale")
      } else {
        const progs = json.data?.resume?.totalProgrammesCrees ?? 0
        const lecons = json.data?.resume?.totalLeconsCreees ?? 0
        onToast(`${progs} programme(s) initialisé(s) (${lecons} leçons) sur l'école`, 'success')
        onApplied()
        onClose()
      }
    } catch {
      setErrorMsg("Erreur réseau lors de l'initialisation globale")
    } finally {
      setApplying(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Initialiser les programmes de toute l'école"
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 740, maxHeight: '88vh', overflowY: 'auto',
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
          padding: 20, boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} style={{ color: 'var(--sidebar)' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
              Initialiser les programmes de toute l&apos;école
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 0, marginBottom: 14 }}>
          Analyse toutes les classes actives de l&apos;année courante sans écriture. Les programmes manuels existants et déjà initialisés sont strictement préservés.
        </p>

        {errorMsg && (
          <div style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 12, background: 'var(--red-light)', color: 'var(--red)', fontSize: 12.5, fontWeight: 700 }}>
            {errorMsg}
          </div>
        )}

        {loading && (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            <Loader2 size={18} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />
            Analyse en cours sur toutes les classes...
          </div>
        )}

        {!loading && proposition && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Classes', value: proposition.resume.totalClasses, color: 'var(--sidebar)', bg: 'var(--bg2)' },
                { label: 'Prog. à créer', value: proposition.resume.totalProgrammesACreer, color: 'var(--green)', bg: 'var(--green-light)' },
                { label: 'Leçons', value: proposition.resume.totalLeconsACreer, color: 'var(--blue)', bg: 'var(--blue-light)' },
                { label: 'Ignorés', value: proposition.resume.totalIgnores, color: 'var(--text2)', bg: 'var(--bg2)' },
              ].map((s) => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: s.color }}>{s.label}</div>
                </div>
              ))}
            </div>

            {proposition.classes.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>
                Aucune classe active trouvée sur l&apos;année courante.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
                {proposition.classes.map((c) => (
                  <div
                    key={c.classe.id}
                    style={{
                      padding: '8px 12px', borderRadius: 9, background: 'var(--bg)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {c.resume.aCreer > 0 ? (
                          <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />
                        ) : (
                          <AlertCircle size={14} style={{ color: 'var(--text3)' }} />
                        )}
                        <strong style={{ fontSize: 12.5, color: 'var(--text)' }}>{c.classe.name}</strong>
                        {c.classe.level && (
                          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
                            ({c.classe.level}{c.classe.filiere ? ` · ${c.classe.filiere}` : ''})
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11.5, fontWeight: 700 }}>
                        <span style={{ color: 'var(--green)' }}>{c.resume.aCreer} à créer</span>
                        <span style={{ color: 'var(--text3)' }}>{c.resume.ignores} ignorés</span>
                        {c.resume.impossibles > 0 && (
                          <span style={{ color: 'var(--amber)' }}>{c.resume.impossibles} sans réf.</span>
                        )}
                      </div>
                    </div>

                    {c.choixRequis.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {c.choixRequis.map((ch) => (
                          <div key={ch.subjectId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11.5, color: 'var(--amber)', fontWeight: 700 }}>
                              {ch.subjectName} — choisir option :
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {ch.options.map((opt) => {
                                const selected = optionsParClasse[c.classe.id]?.[ch.subjectId] === opt
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() =>
                                      setOptionsParClasse((prev) => ({
                                        ...prev,
                                        [c.classe.id]: {
                                          ...(prev[c.classe.id] ?? {}),
                                          [ch.subjectId]: opt,
                                        },
                                      }))
                                    }
                                    style={{
                                      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                      border: '1px solid var(--sidebar)', cursor: 'pointer',
                                      background: selected ? 'var(--sidebar)' : 'var(--surface)',
                                      color: selected ? 'white' : 'var(--sidebar)',
                                    }}
                                  >
                                    {opt}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              background: 'var(--bg2)', color: 'var(--text2)', border: 'none', cursor: 'pointer',
            }}
          >
            Fermer
          </button>
          <button
            type="button"
            disabled={applying || loading || !proposition || proposition.resume.totalProgrammesACreer === 0}
            onClick={handleApply}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 800,
              background: !proposition || proposition.resume.totalProgrammesACreer === 0 ? 'var(--text3)' : 'var(--sidebar)',
              color: 'white', border: 'none',
              cursor: !proposition || proposition.resume.totalProgrammesACreer === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {applying
              ? 'Initialisation...'
              : proposition && proposition.resume.totalProgrammesACreer > 0
                ? `Confirmer (${proposition.resume.totalProgrammesACreer} prog. · ${proposition.resume.totalLeconsACreer} leçons)`
                : 'Tout est déjà initialisé'}
          </button>
        </div>
      </div>
    </div>
  )
}
