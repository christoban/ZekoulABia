'use client'

import { ShieldAlert } from 'lucide-react'
import type { ImportProgressionDryRunDto } from '../../_api'
import ReferentielProgressionImportDiagnostics from './ReferentielProgressionImportDiagnostics'

const ACTION_LABELS: Record<'CREATE' | 'UPDATE' | 'UNCHANGED' | 'CONFLICT_MANUAL', string> = {
  CREATE: 'Création',
  UPDATE: 'Mise à jour',
  UNCHANGED: 'Inchangé',
  CONFLICT_MANUAL: 'Modifié manuellement',
}

interface Props {
  dryRun: ImportProgressionDryRunDto
  confirmOverwriteIds: string[]
  onToggleConfirmManualId: (id: string) => void
  skipManuallyEdited: boolean
  onSkipManuallyEditedChange: (checked: boolean) => void
}

/**
 * Aperçu dry-run (étape 1 de la modale d'import) :
 * résumé chiffré, rejets bloquants, gestion des conflits manuels, diagnostics regroupés et tableau par matière.
 */
export default function ReferentielProgressionImportPreview({
  dryRun,
  confirmOverwriteIds,
  onToggleConfirmManualId,
  skipManuallyEdited,
  onSkipManuallyEditedChange,
}: Props) {
  const stats = [
    { label: 'Niveau', val: dryRun.level || '-' },
    { label: 'À créer', val: String(dryRun.resume.aCreer) },
    { label: 'Mises à jour', val: String(dryRun.resume.aMettreAJour) },
    { label: 'Inchangés', val: String(dryRun.resume.inchanges) },
    { label: 'Conflits manuels', val: String(dryRun.resume.conflitsManuels) },
    { label: 'Rejetés', val: String(dryRun.resume.rejetes) },
  ]

  return (
    <>
      {/* Résumé chiffré */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 8,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '8px 10px',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>{stat.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{stat.val}</div>
          </div>
        ))}
      </div>

      {/* Rejets bloquants */}
      {dryRun.rejets.length > 0 && (
        <div
          style={{
            border: '1px solid var(--red, #dc2626)',
            borderRadius: 10,
            padding: 12,
            background: 'var(--bg2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--red, #dc2626)' }}>
            {dryRun.rejets.length} rejet(s) bloquant(s) — corrigez le fichier avant import
          </div>
          {dryRun.rejets.map((r, idx) => (
            <div key={`${r.code}-${idx}`} style={{ fontSize: 12, color: 'var(--text)' }}>
              <strong>[{r.code}]</strong> {r.subjectName || '(lot)'} : {r.message}
            </div>
          ))}
        </div>
      )}

      {/* Conflits manuels */}
      {dryRun.conflitsManuels.length > 0 && (
        <div
          style={{
            border: '1px solid var(--orange, #d97706)',
            borderRadius: 10,
            padding: 12,
            background: 'var(--bg2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--text)',
            }}
          >
            <ShieldAlert size={16} color="var(--orange, #d97706)" />
            <span>
              {dryRun.conflitsManuels.length} ligne(s) modifiée(s) manuellement — décision requise
            </span>
          </div>
          {dryRun.conflitsManuels.map((c) => {
            const checked = Boolean(c.existingId && confirmOverwriteIds.includes(c.existingId))
            return (
              <label
                key={c.cleProgression}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!c.existingId}
                  onChange={() => c.existingId && onToggleConfirmManualId(c.existingId)}
                />
                <span>
                  Écraser <strong>{c.subjectName}</strong> ({c.templateCode} · {c.level}
                  {c.filiere ? ` · ${c.filiere}` : ''})
                </span>
              </label>
            )
          })}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              cursor: 'pointer',
              paddingTop: 4,
              borderTop: '1px solid var(--border)',
            }}
          >
            <input
              type="checkbox"
              checked={skipManuallyEdited}
              onChange={(e) => onSkipManuallyEditedChange(e.target.checked)}
            />
            <span>Ignorer les lignes modifiées manuellement non cochées ci-dessus</span>
          </label>
        </div>
      )}

      {/* Diagnostics regroupés */}
      <ReferentielProgressionImportDiagnostics diagnostics={dryRun.diagnostics} />

      {/* Aperçu par matière */}
      {dryRun.actions.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 10px' }}>Matière</th>
                <th style={{ padding: '8px 10px' }}>Cible</th>
                <th style={{ padding: '8px 10px' }}>Leçons</th>
                <th style={{ padding: '8px 10px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {dryRun.actions.map((a) => (
                <tr key={a.cleProgression} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{a.subjectName}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text2)' }}>
                    {a.templateCode} · {a.level} {a.filiere ? `· ${a.filiere}` : ''}
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>
                    {a.nbChapitresRetenus}
                    {a.nbChapitresExclus > 0 ? ` (${a.nbChapitresExclus} excl.)` : ''}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{ACTION_LABELS[a.action]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

