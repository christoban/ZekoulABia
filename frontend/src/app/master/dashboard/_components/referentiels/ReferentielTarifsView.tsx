'use client'

import type { TarifMinesecDto } from '../../_api'
import {
  ActiveStatusPill,
  DesktopEmptyRow,
  MobileEmptyState,
  ReferentielTableHead,
  RowActionButtons,
} from './ReferentielListPrimitives'

interface Props {
  tarifs: TarifMinesecDto[]
  onToggle: (id: string) => void
  onEdit: (item: Record<string, unknown>) => void
}

const HEADERS = [
  { label: 'Type de Frais' },
  { label: 'Année Scolaire' },
  { label: 'Niveau' },
  { label: 'Montant Réglementaire' },
  { label: 'Description / Base Légale' },
  { label: 'Statut' },
  { label: 'Actions', alignRight: true },
]

/** Vue Tarifs MINESEC Réglementaires (cartes mobile + tableau desktop) */
export default function ReferentielTarifsView({ tarifs, onToggle, onEdit }: Props) {
  return (
    <>
      <div className="block md:hidden" style={{ padding: 10 }}>
        {tarifs.length === 0 ? (
          <MobileEmptyState message="Aucun tarif MINESEC configuré. Cliquez sur « Ajouter une entrée »." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tarifs.map(t => (
              <div key={t.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>{t.typeFrais}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>
                      {t.anneeScolaire} · {t.niveau || 'Tous niveaux'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary)' }}>
                      {t.montantFCFA.toLocaleString('fr-FR')} FCFA
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <ActiveStatusPill active={t.actif} pillRadius={999} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>
                    {t.description || 'Barème officiel MINESEC'}
                  </span>
                  <RowActionButtons
                    mobile
                    active={t.actif}
                    onToggle={() => onToggle(t.id)}
                    onEdit={() => onEdit(t as unknown as Record<string, unknown>)}
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
            {tarifs.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                  {t.typeFrais}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                  {t.anneeScolaire}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>
                  {t.niveau || 'Tous'}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--primary)', fontSize: 14 }}>
                  {t.montantFCFA.toLocaleString('fr-FR')} FCFA
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text3)', maxWidth: 220 }}>
                  {t.description || 'Barème officiel MINESEC'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <ActiveStatusPill active={t.actif} pillRadius={10} />
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <RowActionButtons
                    active={t.actif}
                    onToggle={() => onToggle(t.id)}
                    onEdit={() => onEdit(t as unknown as Record<string, unknown>)}
                  />
                </td>
              </tr>
            ))}
            {tarifs.length === 0 && (
              <DesktopEmptyRow colSpan={7} message="Aucun tarif MINESEC configuré. Cliquez sur « Ajouter une entrée »." />
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
