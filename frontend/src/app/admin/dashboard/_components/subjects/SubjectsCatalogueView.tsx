'use client'

import { useState } from 'react'
import { AlertTriangle, BarChart3, Loader2, MoreHorizontal, Pencil, Search, Trash2, Users, type LucideIcon } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { SubjectItem } from './types'
import { btnRetry, tdStyle, thStyle } from './subjectsUi'

interface SubjectsCatalogueViewProps {
  subjects: SubjectItem[]
  loading: boolean
  error: string | null
  deletingId: string | null
  onRetry: () => void
  onOpenAssign: (sub: SubjectItem) => void
  onOpenEdit: (sub: SubjectItem) => void
  onOpenCoeff: (sub: SubjectItem) => void
  onDelete: (sub: SubjectItem, closeMenu: () => void) => void
}

export default function SubjectsCatalogueView({
  subjects,
  loading,
  error,
  deletingId,
  onRetry,
  onOpenAssign,
  onOpenEdit,
  onOpenCoeff,
  onDelete,
}: SubjectsCatalogueViewProps) {
  const t = useT('admin')
  const [search, setSearch] = useState('')
  const [openDD, setOpenDD] = useState<string | null>(null)

  const filtered = subjects.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || Boolean(s.code?.toLowerCase().includes(search.toLowerCase())),
  )

  const buildMenuItems = (sub: SubjectItem) => [
    { icon: Users, key: 'assign_teacher', action: () => { setOpenDD(null); onOpenAssign(sub) }, danger: false },
    { icon: Pencil, key: 'edit', action: () => { setOpenDD(null); onOpenEdit(sub) }, danger: false },
    { icon: BarChart3, key: 'bac_coefficients', action: () => { setOpenDD(null); onOpenCoeff(sub) }, danger: false },
    { icon: Trash2, key: 'delete', action: () => onDelete(sub, () => setOpenDD(null)), danger: false },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} strokeWidth={2} /> {error}
        </span>
        <button onClick={onRetry} style={btnRetry}>Réessayer</button>
      </div>
    )
  }

  return (
    <div className="rounded-none md:rounded-[16px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]">
      <div className="p-0 mb-3 md:p-3 md:px-4 md:mb-0 md:border-b md:border-[var(--border)]">
        <div
          className="rounded-[12px] md:rounded-[8px] px-3.5 py-2.5 md:px-4 md:py-2.5 border-0 md:border md:border-[1.5px] md:border-[var(--border)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none bg-[var(--surface)] md:bg-[var(--bg2)]"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Search size={16} strokeWidth={2} color="var(--text3)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('subjects.search_placeholder')}
            className="text-sm md:text-base font-semibold"
            style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'inherit', width: '100%' }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-8 flex flex-col items-center text-center gap-2" style={{ color: 'var(--text3)' }}>
          <Search size={28} strokeWidth={1.5} color="var(--border2)" />
          <div className="text-sm md:text-base font-medium">
            {subjects.length === 0 ? 'Aucune matière configurée' : 'Aucun résultat'}
          </div>
        </div>
      ) : (
        <>
          {/* ── Cartes empilées — mobile ── */}
          <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
            {filtered.map(sub => {
              const items = buildMenuItems(sub)
              return (
                <div key={sub.id} className="rounded-[16px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 16, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 16, right: 16 }}>
                    <button
                      onClick={() => setOpenDD(openDD === sub.id ? null : sub.id)}
                      style={{ width: 32, height: 32, borderRadius: 16, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text3)' }}
                    >
                      {deletingId === sub.id ? <Loader2 size={16} strokeWidth={2} className="animate-spin" /> : <MoreHorizontal size={16} strokeWidth={2} />}
                    </button>
                    {openDD === sub.id && (
                      <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 11, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 190, zIndex: 100, overflow: 'hidden' }}>
                        {items.map((item, j) => {
                          const ItemIcon: LucideIcon = item.icon
                          return (
                            <div
                              key={j}
                              onClick={item.action}
                              style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: item.danger ? 'var(--red)' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                              <ItemIcon size={15} strokeWidth={2} /> {t(`subjects.action_menu.${item.key}`)}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ paddingRight: 36, fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{sub.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '2.5px 8.5px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>×{sub.coefficient}</span>
                    {sub.code && <code style={{ background: 'var(--bg2)', padding: '2.5px 7px', borderRadius: 5, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', color: 'var(--text2)' }}>{sub.code}</code>}
                    <span style={{ background: 'var(--bg2)', color: 'var(--text2)', padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600 }}>{sub.hoursPerWeek}h</span>
                    <span style={{ background: 'var(--bg2)', color: 'var(--text2)', padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600 }}>{t(`subjects.type_labels.${sub.subjectType}`) || sub.subjectType}</span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ background: sub.teacherSubjects.length > 0 ? 'var(--green-light)' : 'var(--bg2)', color: sub.teacherSubjects.length > 0 ? 'var(--green)' : 'var(--text2)', padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
                      {sub.teacherSubjects.length > 0 ? t('subjects.assign_status.assigned').replace('{count}', String(sub.teacherSubjects.length)) : t('subjects.assign_status.unassigned')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Tableau — desktop ── */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {(t('subjects.table_headers') as unknown as string[]).map((h: string, i: number) => (
                    <th key={i} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(sub => {
                  const items = buildMenuItems(sub)
                  return (
                    <tr
                      key={sub.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                    >
                      <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)', fontSize: 13.5 }}>{sub.name}</td>
                      <td style={tdStyle}>
                        {sub.code ? <code style={{ background: 'var(--bg2)', padding: '3px 8px', borderRadius: 6, fontSize: 12.5 }}>{sub.code}</code> : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '3px 9px', borderRadius: 20, fontSize: 12.5, fontWeight: 800 }}>×{sub.coefficient}</span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)', fontSize: 13.5 }}>{sub.hoursPerWeek}h</td>
                      <td style={tdStyle}>{t(`subjects.type_labels.${sub.subjectType}`) || sub.subjectType}</td>
                      <td style={tdStyle}>
                        <span style={{ background: sub.teacherSubjects.length > 0 ? 'var(--green-light)' : 'var(--bg2)', color: sub.teacherSubjects.length > 0 ? 'var(--green)' : 'var(--text2)', padding: '3px 9.5px', borderRadius: 20, fontSize: 12.5, fontWeight: 800 }}>
                          {sub.teacherSubjects.length > 0 ? t('subjects.assign_status.assigned').replace('{count}', String(sub.teacherSubjects.length)) : t('subjects.assign_status.unassigned')}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            onClick={() => setOpenDD(openDD === sub.id ? null : sub.id)}
                            style={{ background: 'none', border: '1.5px solid var(--border2)', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', color: 'var(--text3)' }}
                            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)', background: 'var(--green-light)' })}
                            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text3)', background: 'none' })}
                          >
                            {deletingId === sub.id ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : <MoreHorizontal size={15} strokeWidth={2} />}
                          </button>
                          {openDD === sub.id && (
                            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 11, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 190, zIndex: 100, overflow: 'hidden' }}>
                              {items.map((item, j) => {
                                const ItemIcon: LucideIcon = item.icon
                                return (
                                  <div
                                    key={j}
                                    onClick={item.action}
                                    style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: item.danger ? 'var(--red)' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = item.danger ? 'var(--red-light)' : 'var(--bg2)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                                  >
                                    <ItemIcon size={15} strokeWidth={2} /> {t(`subjects.action_menu.${item.key}`)}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
