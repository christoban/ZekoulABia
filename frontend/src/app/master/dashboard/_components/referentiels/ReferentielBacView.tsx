'use client'

import type { BacCoefficientDto } from '../../_api'
import {
  DesktopEmptyRow,
  MobileEmptyState,
  ReferentielTableHead,
  RowActionButtons,
} from './ReferentielListPrimitives'

interface Props {
  bacCoeffs: BacCoefficientDto[]
  onEdit: (item: Record<string, unknown>) => void
  onDelete: (id: string) => void
}

const HEADERS = [
  { label: 'Matière' },
  { label: 'Série' },
  { label: 'Niveau' },
  { label: 'Coefficient' },
  { label: 'Groupe' },
  { label: 'Source Arrêté' },
  { label: 'Actions', alignRight: true },
]

/** Vue Coefficients BAC (cartes mobile + tableau desktop) */
export default function ReferentielBacView({ bacCoeffs, onEdit, onDelete }: Props) {
  return (
    <>
      <div className="block md:hidden" style={{ padding: 10 }}>
        {bacCoeffs.length === 0 ? (
          <MobileEmptyState message="Aucun coefficient BAC correspondant aux filtres." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bacCoeffs.map(b => (
              <div key={b.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>{b.subjectName}</div>
                  <span style={{ padding: '2px 8px', background: 'var(--amber-light)', color: 'var(--primary)', borderRadius: 6, fontWeight: 800, fontSize: 11.5, whiteSpace: 'nowrap' }}>
                    Coeff {b.coefficient}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11.5 }}>
                  <span style={{ padding: '2px 7px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontWeight: 700, color: 'var(--text)' }}>
                    Série {b.serie}
                  </span>
                  <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{b.niveau}</span>
                  <span style={{
                    padding: '2px 7px', borderRadius: 6, fontSize: 10.5, fontWeight: 700,
                    background: b.groupe === 1 ? 'var(--amber-light)' : 'var(--surface)',
                    color: b.groupe === 1 ? 'var(--amber)' : 'var(--text2)',
                  }}>
                    {b.groupe === 1 ? 'G1 - Principale' : 'G2 - Transversale'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{b.source}</span>
                  <RowActionButtons
                    mobile
                    onEdit={() => onEdit(b as unknown as Record<string, unknown>)}
                    onDelete={() => onDelete(b.id)}
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
            {bacCoeffs.map(b => (
              <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                  {b.subjectName}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '2px 8px', background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
                    {b.serie}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>
                  {b.niveau}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text)' }}>
                  {b.coefficient}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: b.groupe === 1 ? 'var(--amber-light)' : 'var(--bg2)',
                    color: b.groupe === 1 ? 'var(--amber)' : 'var(--text2)',
                  }}>
                    {b.groupe === 1 ? 'G1 - Principale' : 'G2 - Transversale'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text3)' }}>
                  {b.source}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <RowActionButtons
                    onEdit={() => onEdit(b as unknown as Record<string, unknown>)}
                    onDelete={() => onDelete(b.id)}
                  />
                </td>
              </tr>
            ))}
            {bacCoeffs.length === 0 && (
              <DesktopEmptyRow colSpan={7} message="Aucun coefficient BAC correspondant aux filtres." />
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
