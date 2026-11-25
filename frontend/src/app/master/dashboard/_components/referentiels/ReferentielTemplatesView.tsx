'use client'

import type { TemplateSubjectDto } from '../../_api'
import {
  DesktopEmptyRow,
  MobileEmptyState,
  ReferentielTableHead,
  RowActionButtons,
} from './ReferentielListPrimitives'

interface Props {
  templateSubjects: TemplateSubjectDto[]
  filterSubsystem: 'FRANCOPHONE' | 'ANGLOPHONE'
  onEdit: (item: Record<string, unknown>) => void
  onDelete: (id: string) => void
}

const HEADERS = [
  { label: 'Template' },
  { label: 'Niveau' },
  { label: 'Filière' },
  { label: 'Matière' },
  { label: 'Coeff' },
  { label: 'Heures/Semaine' },
  { label: 'Actions', alignRight: true },
]

/** Vue Matières & Volumes par Template (cartes mobile + tableau desktop) */
export default function ReferentielTemplatesView({
  templateSubjects,
  filterSubsystem,
  onEdit,
  onDelete,
}: Props) {
  return (
    <>
      <div className="block md:hidden" style={{ padding: 10 }}>
        {templateSubjects.length === 0 ? (
          <MobileEmptyState message="Aucune matière trouvée pour ce template et ces filtres." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {templateSubjects.map(ts => (
              <div key={ts.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>{ts.subjectName}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'var(--amber-light)', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                    Coeff {ts.coefficient} {ts.weeklyPeriods ? `· ${ts.weeklyPeriods}h` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text2)' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{ts.templateCode}</span>
                    <span>·</span>
                    <span style={{ fontWeight: 700 }}>{ts.classLevel}</span>
                    <span>·</span>
                    <span>{ts.filiere}</span>
                  </div>
                  <RowActionButtons
                    mobile
                    onEdit={() => onEdit({ ...ts, subsystem: filterSubsystem })}
                    onDelete={() => onDelete(ts.id)}
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
            {templateSubjects.map(ts => (
              <tr key={ts.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                  {ts.templateCode}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                  {ts.classLevel}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>
                  {ts.filiere}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                  {ts.subjectName}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text)' }}>
                  {ts.coefficient}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text3)' }}>
                  {ts.weeklyPeriods ? `${ts.weeklyPeriods}h` : '—'}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <RowActionButtons
                    onEdit={() => onEdit({ ...ts, subsystem: filterSubsystem })}
                    onDelete={() => onDelete(ts.id)}
                  />
                </td>
              </tr>
            ))}
            {templateSubjects.length === 0 && (
              <DesktopEmptyRow colSpan={7} message="Aucune matière trouvée pour ce template et ces filtres." />
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
