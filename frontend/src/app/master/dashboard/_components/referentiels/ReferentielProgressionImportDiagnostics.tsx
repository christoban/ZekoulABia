'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import type { ImportProgressionDiagnosticsDto } from '../../_api'

interface Props {
  diagnostics: ImportProgressionDiagnosticsDto
}

/**
 * Affichage regroupé et repliable des 4 catégories de diagnostics du dry-run.
 * Informatif uniquement : aucun de ces motifs ne provoque de rejet automatique.
 */
export default function ReferentielProgressionImportDiagnostics({ diagnostics }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  const sections = [
    {
      key: 'sans-numero',
      label: 'Leçons sans numéro (TD, TP, Projet, N.B.)',
      count: diagnostics.leconsSansNumero.length,
    },
    {
      key: 'doublons',
      label: 'Numéros de leçon dupliqués',
      count: diagnostics.numerosDupliques.length,
    },
    {
      key: 'parasites',
      label: 'Modules marqués titreModuleParasite',
      count: diagnostics.modulesParasites.length,
    },
    {
      key: 'exclus',
      label: 'Éléments exclus (non importés)',
      count: diagnostics.elementsExclus.length,
    },
  ]

  const totalDiagnostics = sections.reduce((sum, s) => sum + s.count, 0)
  if (totalDiagnostics === 0) return null

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--bg2)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>
        <AlertTriangle size={15} color="var(--orange, #d97706)" />
        <span>Diagnostics d&apos;extraction (informatifs, non bloquants)</span>
      </div>

      {sections.map((sec) => {
        const isOpen = openKey === sec.key
        return (
          <div
            key={sec.key}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : sec.key)}
              disabled={sec.count === 0}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                border: 'none',
                background: 'transparent',
                color: sec.count === 0 ? 'var(--text3)' : 'var(--text)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: sec.count === 0 ? 'default' : 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {sec.label}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'var(--bg2)',
                  color: sec.count > 0 ? 'var(--text)' : 'var(--text3)',
                }}
              >
                {sec.count}
              </span>
            </button>

            {isOpen && sec.count > 0 && (
              <div
                style={{
                  maxHeight: 170,
                  overflowY: 'auto',
                  borderTop: '1px solid var(--border)',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontSize: 12,
                  color: 'var(--text2)',
                }}
              >
                {sec.key === 'sans-numero' &&
                  diagnostics.leconsSansNumero.map((item, idx) => (
                    <div key={`${item.cleProgression}-${item.positionSource}-${idx}`}>
                      <strong>{item.subjectName}</strong> · Mod.{item.moduleOrdre ?? '-'} Pos.
                      {item.positionDansModule} ({item.numeroAffiche || 'sans n°'}) : {item.titre}
                    </div>
                  ))}

                {sec.key === 'doublons' &&
                  diagnostics.numerosDupliques.map((item, idx) => (
                    <div key={`${item.cleProgression}-${item.leconNumero}-${idx}`}>
                      <strong>{item.subjectName}</strong> · n°{item.leconNumero} ({item.portee},{' '}
                      {item.occurrences.length} occurrences) :{' '}
                      {item.occurrences
                        .map((o) => `Mod.${o.moduleOrdre ?? '-'}#${o.positionDansModule} «${o.titre}»`)
                        .join(' ; ')}
                    </div>
                  ))}

                {sec.key === 'parasites' &&
                  diagnostics.modulesParasites.map((item, idx) => (
                    <div key={`${item.cleProgression}-${item.moduleOrdre}-${idx}`}>
                      <strong>{item.subjectName}</strong> · Module {item.moduleOrdre ?? '-'} :{' '}
                      {item.moduleTitre || '(sans titre)'} ({item.nbLecons} leçon(s))
                    </div>
                  ))}

                {sec.key === 'exclus' &&
                  diagnostics.elementsExclus.map((item, idx) => (
                    <div key={`${item.cleProgression}-${item.positionSource}-${idx}`}>
                      <strong>{item.subjectName}</strong> · Mod.{item.moduleOrdre ?? '-'} Pos.
                      {item.positionDansModule} ({item.numeroAffiche || 'exclu'}) : {item.titre}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

