'use client'

import type { OfficialProgressionDto } from '../../_api'
import {
  ActiveStatusPill,
  DesktopEmptyRow,
  MobileEmptyState,
  ReferentielTableHead,
  RowActionButtons,
} from './ReferentielListPrimitives'

interface Props {
  progressions: OfficialProgressionDto[]
  onEdit: (item: Record<string, unknown>) => void
  onDelete: (id: string) => void
}

const HEADERS = [
  { label: 'Template' },
  { label: 'Niveau' },
  { label: 'Matière' },
  { label: 'Titre du Programme' },
  { label: 'Chapitres Types' },
  { label: 'Statut' },
  { label: 'Actions', alignRight: true },
]

/** Vue Programmes & Progressions Types (cartes mobile + tableau desktop) */
export default function ReferentielProgressionsView({ progressions, onEdit, onDelete }: Props) {
  return (
    <>
      <div className="block md:hidden" style={{ padding: 10 }}>
        {progressions.length === 0 ? (
          <MobileEmptyState message="Aucun programme configuré. Cliquez sur « Ajouter une entrée »." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {progressions.map(p => (
              <div key={p.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>{p.subjectName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>{p.titre}</div>
                  </div>
                  <ActiveStatusPill active={p.active} pillRadius={999} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{p.templateCode}</span>
                    <span>·</span>
                    <span style={{ fontWeight: 700, color: 'var(--text2)' }}>{p.level}</span>
                    <span>·</span>
                    <span>{p.chapitres?.length || 0} ch.</span>
                  </div>
                  <RowActionButtons
                    mobile
                    onEdit={() => onEdit(p as unknown as Record<string, unknown>)}
                    onDelete={() => onDelete(p.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hidden md:block" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <ReferentielTableHead columns={HEADERS} />
          <tbody>
            {progressions.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                  {p.templateCode}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                  {p.level}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                  {p.subjectName}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>
                  {p.titre}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text3)' }}>
                  {p.chapitres?.length || 0} chapitres configurés
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <ActiveStatusPill active={p.active} pillRadius={10} />
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <RowActionButtons
                    onEdit={() => onEdit(p as unknown as Record<string, unknown>)}
                    onDelete={() => onDelete(p.id)}
                  />
                </td>
              </tr>
            ))}
            {progressions.length === 0 && (
              <DesktopEmptyRow colSpan={7} message="Aucun programme configuré. Cliquez sur « Ajouter une entrée »." />
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
