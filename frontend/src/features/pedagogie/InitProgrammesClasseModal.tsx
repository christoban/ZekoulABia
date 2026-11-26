'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Sparkles, CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { inputStyle, labelStyle, type Classe, type OnToast } from './types'

type OptionClassique = 'Latin' | 'Grec'

interface PropositionData {
  classe: {
    id: string
    name: string
    level: string | null
    levelNormalise: string | null
    filiere: string | null
    serie: string | null
  }
  resume: {
    totalMatieres: number
    aCreer: number
    ignores: number
    choixRequis: number
    impossibles: number
    totalLeconsACreer: number
  }
  aCreer: Array<{
    subjectId: string
    subjectName: string
    titre: string
    filiere: string
    subjectNameNational: string
    nbLecons: number
    nbModules: number
  }>
  ignores: Array<{
    subjectId: string
    subjectName: string
    programmeExistantTitre: string
    source: string
    raison: 'PROGRAMME_MANUEL_EXISTANT' | 'DEJA_INITIALISE'
  }>
  choixRequis: Array<{
    subjectId: string
    subjectName: string
    options: OptionClassique[]
    raison: string
  }>
  impossibles: Array<{
    subjectId: string
    subjectName: string
    raison: string
  }>
}

interface Props {
  open: boolean
  classes: Classe[]
  initialClassId?: string
  onClose: () => void
  onApplied: () => void
  onToast: OnToast
}

export default function InitProgrammesClasseModal({
  open,
  classes,
  initialClassId,
  onClose,
  onApplied,
  onToast,
}: Props) {
  const [selectedClassId, setSelectedClassId] = useState(initialClassId ?? '')
  const [optionsClassiques, setOptionsClassiques] = useState<Record<string, OptionClassique>>({})
  const [proposition, setProposition] = useState<PropositionData | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [applying, setApplying] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedClassId(initialClassId ?? '')
      setOptionsClassiques({})
      setProposition(null)
      setErrorMsg(null)
    }
  }, [open, initialClassId])

  const lancerApercu = useCallback(
    async (classId: string, opts: Record<string, OptionClassique>) => {
      if (!classId) return
      setLoadingPreview(true)
      setErrorMsg(null)
      try {
        const res = await fetchApi(
          `/api/v2/pedagogie/classes/${classId}/initialiser-programmes/propose`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ optionsClassiques: opts }),
          },
        )
        const json = await res.json()
        if (!res.ok || !json.success) {
          setErrorMsg(json.message ?? "Impossible d'analyser la classe")
          setProposition(null)
        } else {
          setProposition(json.data as PropositionData)
        }
      } catch {
        setErrorMsg('Erreur réseau lors de la prévisualisation')
        setProposition(null)
      } finally {
        setLoadingPreview(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (open && selectedClassId) {
      lancerApercu(selectedClassId, optionsClassiques)
    } else {
      setProposition(null)
    }
  }, [open, selectedClassId, optionsClassiques, lancerApercu])

  const handleConfirmApply = async () => {
    if (!selectedClassId || !proposition || proposition.resume.aCreer === 0) return
    setApplying(true)
    setErrorMsg(null)
    try {
      const res = await fetchApi(
        `/api/v2/pedagogie/classes/${selectedClassId}/initialiser-programmes/apply`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionsClassiques }),
        },
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        setErrorMsg(json.message ?? "Erreur lors de l'initialisation")
      } else {
        const created = json.data?.totalCrees ?? 0
        const lessons = json.data?.totalLeconsCreees ?? 0
        onToast(`${created} programme(s) initialisé(s) (${lessons} leçons)`, 'success')
        onApplied()
        onClose()
      }
    } catch {
      setErrorMsg("Erreur réseau lors de l'initialisation")
    } finally {
      setApplying(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Initialiser les programmes d'une classe"
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 680, maxHeight: '88vh', overflowY: 'auto',
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
          padding: 20, boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: 'var(--sidebar)' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
              Initialiser les programmes d&apos;une classe
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
          Copie les programmes nationaux officiels vers la classe choisie. Les programmes manuels existants ne sont jamais écrasés.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Classe cible *</label>
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value)
              setOptionsClassiques({})
            }}
            style={inputStyle}
          >
            <option value="">— Choisir une classe —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.level ? ` (${c.level})` : ''}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <div style={{
            padding: '10px 12px', borderRadius: 8, marginBottom: 12,
            background: 'var(--red-light)', color: 'var(--red)', fontSize: 12.5, fontWeight: 700,
          }}>
            {errorMsg}
          </div>
        )}

        {loadingPreview && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            <Loader2 size={18} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />
            Analyse préalable (sans écriture)...
          </div>
        )}

        {!loadingPreview && proposition && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Résumé chiffré */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'À créer', value: proposition.resume.aCreer, color: 'var(--green)', bg: 'var(--green-light)' },
                { label: 'Leçons', value: proposition.resume.totalLeconsACreer, color: 'var(--blue)', bg: 'var(--blue-light)' },
                { label: 'Ignorés', value: proposition.resume.ignores, color: 'var(--text2)', bg: 'var(--bg2)' },
                { label: 'Sans réf.', value: proposition.resume.impossibles, color: 'var(--amber)', bg: 'var(--amber-light)' },
              ].map((stat) => (
                <div key={stat.label} style={{ background: stat.bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: stat.color }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Choix requis (ex. 4e/3e Lettres classiques Latin/Grec) */}
            {proposition.choixRequis.length > 0 && (
              <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--amber)', background: 'var(--amber-light)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--amber)', marginBottom: 6 }}>
                  Choix requis avant initialisation
                </div>
                {proposition.choixRequis.map((item) => (
                  <div key={item.subjectId} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                      {item.subjectName} — <span style={{ fontWeight: 500, color: 'var(--text2)' }}>{item.raison}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {item.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() =>
                            setOptionsClassiques((prev) => ({ ...prev, [item.subjectId]: opt }))
                          }
                          style={{
                            padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                            border: '1px solid var(--sidebar)', cursor: 'pointer',
                            background: optionsClassiques[item.subjectId] === opt ? 'var(--sidebar)' : 'var(--surface)',
                            color: optionsClassiques[item.subjectId] === opt ? 'white' : 'var(--sidebar)',
                          }}
                        >
                          Choisir {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* À créer */}
            {proposition.aCreer.length > 0 && (
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle2 size={14} /> Programmes à créer ({proposition.aCreer.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
                  {proposition.aCreer.map((item) => (
                    <div key={item.subjectId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--bg)', fontSize: 12 }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{item.subjectName}</span>
                        {item.subjectNameNational !== item.subjectName && (
                          <span style={{ color: 'var(--text3)', marginLeft: 6 }}>→ {item.subjectNameNational}</span>
                        )}
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', flexShrink: 0 }}>
                        {item.nbLecons} leçons · {item.nbModules} mod.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ignorés */}
            {proposition.ignores.length > 0 && (
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Info size={14} /> Déjà présents / préservés ({proposition.ignores.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {proposition.ignores.map((item) => (
                    <div key={item.subjectId} style={{ fontSize: 12, color: 'var(--text2)', padding: '5px 10px', borderRadius: 7, background: 'var(--bg2)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>{item.subjectName}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {item.raison === 'PROGRAMME_MANUEL_EXISTANT' ? 'Programme manuel conservé' : 'Déjà initialisé'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Impossibles */}
            {proposition.impossibles.length > 0 && (
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertCircle size={14} /> Sans programme national ({proposition.impossibles.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {proposition.impossibles.map((item) => (
                    <div key={item.subjectId} style={{ fontSize: 12, color: 'var(--text2)', padding: '5px 10px', borderRadius: 7, background: 'var(--bg)' }}>
                      <strong>{item.subjectName}</strong> — {item.raison}
                    </div>
                  ))}
                </div>
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
            disabled={applying || loadingPreview || !proposition || proposition.resume.aCreer === 0}
            onClick={handleConfirmApply}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 800,
              background: !proposition || proposition.resume.aCreer === 0 ? 'var(--text3)' : 'var(--sidebar)',
              color: 'white', border: 'none',
              cursor: !proposition || proposition.resume.aCreer === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {applying
              ? 'Initialisation...'
              : proposition && proposition.resume.aCreer > 0
                ? `Confirmer et initialiser (${proposition.resume.aCreer} prog. · ${proposition.resume.totalLeconsACreer} leçons)`
                : 'Rien à initialiser'}
          </button>
        </div>
      </div>
    </div>
  )
}

