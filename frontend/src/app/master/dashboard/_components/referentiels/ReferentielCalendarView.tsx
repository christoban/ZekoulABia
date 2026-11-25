'use client'

import type { OfficialAcademicCalendarDto } from '../../_api'
import {
  ActiveStatusPill,
  DesktopEmptyRow,
  MobileEmptyState,
  ReferentielTableHead,
  RowActionButtons,
} from './ReferentielListPrimitives'

interface Props {
  calendars: OfficialAcademicCalendarDto[]
  onToggle: (id: string) => void
  onEdit: (item: Record<string, unknown>) => void
}

const HEADERS = [
  { label: 'Année Scolaire' },
  { label: 'Arrêté Ministériel' },
  { label: 'Rentrée Officielle' },
  { label: 'Clôture Officielle' },
  { label: 'Périodes & Vacances' },
  { label: 'Statut' },
  { label: 'Actions', alignRight: true },
]

/** Vue Calendrier Scolaire Officiel (cartes mobile + tableau desktop) */
export default function ReferentielCalendarView({ calendars, onToggle, onEdit }: Props) {
  return (
    <>
      <div className="block md:hidden" style={{ padding: 10 }}>
        {calendars.length === 0 ? (
          <MobileEmptyState message="Aucun calendrier enregistré. Cliquez sur « Ajouter une entrée »." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {calendars.map(cal => (
              <div key={cal.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{cal.academicYear}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)' }}>
                      {cal.establishmentType}
                    </span>
                  </div>
                  <ActiveStatusPill active={cal.active} pillRadius={999} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {cal.arreteReference || 'Arrêté conjoint MINESEC/MINEDUB'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--surface)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11.5 }}>
                  <div>
                    <div style={{ color: 'var(--text3)', fontSize: 10.5, fontWeight: 700 }}>RENTRÉE</div>
                    <div style={{ fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                      {new Date(cal.dateRentreeOfficielle).toLocaleDateString('fr-CM', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text3)', fontSize: 10.5, fontWeight: 700 }}>CLÔTURE</div>
                    <div style={{ fontWeight: 700, color: 'var(--red)', marginTop: 2 }}>
                      {new Date(cal.dateClotureOfficielle).toLocaleDateString('fr-CM', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600 }}>
                    {cal.trimestres?.length || 3} trimestres • {cal.periodesVacances?.length || 2} congés
                  </span>
                  <RowActionButtons
                    mobile
                    active={cal.active}
                    onToggle={() => onToggle(cal.id)}
                    onEdit={() => onEdit(cal as unknown as Record<string, unknown>)}
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
            {calendars.map(cal => (
              <tr key={cal.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text)' }}>
                  {cal.academicYear}
                  <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', background: 'var(--bg2)', borderRadius: 4, color: 'var(--text2)' }}>
                    {cal.establishmentType}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text2)', maxWidth: 220 }}>
                  {cal.arreteReference || 'Arrêté conjoint MINESEC/MINEDUB'}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--primary)' }}>
                  {new Date(cal.dateRentreeOfficielle).toLocaleDateString('fr-CM', { day: 'numeric', month: 'long', year: 'numeric' })}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--red)' }}>
                  {new Date(cal.dateClotureOfficielle).toLocaleDateString('fr-CM', { day: 'numeric', month: 'long', year: 'numeric' })}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text3)' }}>
                  {cal.trimestres?.length || 3} trimestres • {cal.periodesVacances?.length || 2} congés
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <ActiveStatusPill active={cal.active} />
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <RowActionButtons
                    active={cal.active}
                    onToggle={() => onToggle(cal.id)}
                    onEdit={() => onEdit(cal as unknown as Record<string, unknown>)}
                  />
                </td>
              </tr>
            ))}
            {calendars.length === 0 && (
              <DesktopEmptyRow colSpan={7} message="Aucun calendrier enregistré. Cliquez sur « Ajouter une entrée »." />
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
