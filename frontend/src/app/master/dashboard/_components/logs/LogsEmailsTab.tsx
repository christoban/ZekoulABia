'use client'

import { CheckCircle2, XCircle, Search, Info } from 'lucide-react'
import Badge from '../Badge'
import type { EmailLogDto } from '../../_api'
import { tdStyle, thStyle } from './logsConstants'
import { EmptyRow, MobileEmpty, MobileLogRow } from './LogsTablePrimitives'

interface Props {
  emailLogs: EmailLogDto[]
  loading: boolean
  search: string
  onSearchChange: (val: string) => void
  onSearchSubmit: (search: string) => void
}

/** Onglet Emails sortants (OTP, bulletins, paiements) */
export default function LogsEmailsTab({
  emailLogs,
  loading,
  search,
  onSearchChange,
  onSearchSubmit,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', flex: 1, minWidth: 0 }}>
          <Search size={15} color="var(--text3)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearchSubmit(search)}
            placeholder="Rechercher par email ou sujet..."
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, width: '100%', minWidth: 0 }}
          />
        </div>
        <button
          type="button"
          onClick={() => onSearchSubmit(search)}
          aria-label="Rechercher"
          style={{ padding: '8px 14px', minHeight: 38, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
        >
          <Search size={14} className="md:hidden" />
          <span className="hidden md:inline">Rechercher</span>
        </button>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
          Emails envoyés à travers toutes les écoles (OTP, bulletins, paiements, etc.)
        </div>
        <div className="block md:hidden">
          {loading
            ? <MobileEmpty msg="Chargement..." />
            : emailLogs.length === 0
              ? <MobileEmpty msg="Aucun email enregistré. Les emails des écoles actives apparaissent ici." />
              : emailLogs.map((log, i) => (
                <MobileLogRow
                  key={log.id}
                  last={i === emailLogs.length - 1}
                  badge={
                    <Badge type={log.status === 'sent' ? 'event-success' : 'event-error'}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {log.status === 'sent' ? <><CheckCircle2 size={12} /> Envoyé</> : <><XCircle size={12} /> Échoué</>}
                      </span>
                    </Badge>
                  }
                  date={new Date(log.createdAt).toLocaleString('fr-CM')}
                  primary={log.subject}
                  secondary={[log.to, log.school?.name, log.provider].filter((v): v is string => typeof v === 'string' && v.length > 0).join(' · ')}
                />
              ))}
        </div>
        <div className="hidden md:block" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                {['Date', 'Destinataire', 'Sujet', 'École', 'Statut', 'Provider'].map(h => (
                  <th key={h} style={{ ...thStyle, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <EmptyRow cols={6} msg="Chargement..." />
                : emailLogs.length === 0
                  ? <EmptyRow cols={6} msg="Aucun email enregistré. Les emails des écoles actives apparaissent ici." />
                  : emailLogs.map((log, i) => (
                    <tr key={log.id} style={{ borderBottom: i < emailLogs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString('fr-CM')}</td>
                      <td style={tdStyle}>{log.to}</td>
                      <td style={{ ...tdStyle, maxWidth: 240, wordBreak: 'break-word' }}>{log.subject}</td>
                      <td style={tdStyle}>{log.school?.name ?? '—'}</td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        <Badge type={log.status === 'sent' ? 'event-success' : 'event-error'}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {log.status === 'sent' ? <><CheckCircle2 size={13} /> Envoyé</> : <><XCircle size={13} /> Échoué</>}
                          </span>
                        </Badge>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text3)', fontSize: 13 }}>{log.provider ?? '—'}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.28)', borderRadius: 10, fontSize: 12, color: 'var(--text2)', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5 }}>
        <Info size={15} style={{ flexShrink: 0 }} /> Les emails d&apos;invitation et d&apos;approbation envoyés par le master admin sont tracés dans l&apos;onglet <strong>Actions admin</strong>.
      </div>
    </div>
  )
}
