'use client'

import { useState } from 'react'
import { AlertTriangle, BookOpen, GraduationCap, Loader2, Trash2, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { ClassItem, ClassSubjectItem } from './types'
import { tdStyle, thStyle } from './subjectsUi'

interface SubjectsByClassViewProps {
  classList: ClassItem[]
  selectedClass: string
  selectedClassName?: string
  classSubjects: ClassSubjectItem[]
  loadingCV: boolean
  classViewError: string | null
  deletingSubjId: string | null
  onSelectClass: (classId: string) => void
  onOpenAddSubject: () => void
  onDeleteSubject: (subjectId: string, subjectName: string) => void
  onUpdateCoefficient: (subjectId: string, coeffStr: string) => Promise<boolean>
}

export default function SubjectsByClassView({
  classList,
  selectedClass,
  selectedClassName,
  classSubjects,
  loadingCV,
  classViewError,
  deletingSubjId,
  onSelectClass,
  onOpenAddSubject,
  onDeleteSubject,
  onUpdateCoefficient,
}: SubjectsByClassViewProps) {
  const t = useT('admin')
  const [editingCoeffId, setEditingCoeffId] = useState<string | null>(null)
  const [editingCoeffValue, setEditingCoeffValue] = useState('')

  const saveCoeff = async (subjectId: string) => {
    const ok = await onUpdateCoefficient(subjectId, editingCoeffValue)
    if (ok) setEditingCoeffId(null)
  }

  return (
    <div>
      <div className="p-3.5 md:p-4.5 mb-4 max-w-lg" style={{ background: 'var(--surface)', borderRadius: 12, border: '1.5px solid var(--border)' }}>
        <div className="text-xs font-bold" style={{ color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {t('subjects.class_view.selector_label')}
        </div>
        <select
          value={selectedClass}
          onChange={e => onSelectClass(e.target.value)}
          className="text-sm md:text-base px-3.5 py-2 rounded-lg"
          style={{ width: '100%', border: '1.5px solid var(--border)', color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', cursor: 'pointer', boxSizing: 'border-box' }}
        >
          <option value="">{t('subjects.class_view.selector_placeholder')}</option>
          {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loadingCV && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {classViewError && (
        <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', color: 'var(--red)', fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={16} strokeWidth={2} /> {classViewError}
        </div>
      )}

      {!loadingCV && selectedClass && classSubjects.length === 0 && !classViewError && (
        <div className="px-5 py-8 text-center" style={{ background: 'var(--surface)', borderRadius: 12, border: '1.5px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: 'var(--text3)' }}>
            <BookOpen size={28} strokeWidth={1.5} />
          </div>
          <div className="text-sm md:text-base font-medium" style={{ color: 'var(--text3)', marginBottom: 6 }} dangerouslySetInnerHTML={{ __html: t('subjects.class_view.no_subjects').replace('{name}', selectedClassName ?? '') }} />
          <div className="text-xs md:text-sm font-medium" style={{ color: 'var(--text3)' }} dangerouslySetInnerHTML={{ __html: t('subjects.class_view.sync_hint') }} />
        </div>
      )}

      {!loadingCV && classSubjects.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="px-4.5 py-3.5 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm md:text-base font-bold" style={{ color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: t('subjects.class_view.program_label').replace('{name}', selectedClassName ?? '') }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="text-xs md:text-sm px-3 py-1" style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 20, fontWeight: 800 }}>
                {t('subjects.class_view.count_badge').replace('{count}', String(classSubjects.length))}
              </span>
              <button
                onClick={onOpenAddSubject}
                className="text-xs md:text-sm px-3.5 py-1.5 rounded-lg font-bold shadow-xs"
                style={{ border: '1.5px solid var(--green)', background: 'var(--green-light)', color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                {t('subjects.class_view.btn_add')}
              </button>
            </div>
          </div>

          {/* ── Cartes empilées — mobile ── */}
          <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
            {classSubjects.map(s => (
              <div key={s.id} className="rounded-[16px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{s.name}</span>
                    {s.classOnly && (
                      <span style={{ marginLeft: 6, background: 'var(--purple-light)', color: 'var(--purple)', padding: '2px 7px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}>
                        {t('subjects.class_view.class_only_badge')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onDeleteSubject(s.subjectId, s.name)}
                    style={{ background: 'none', border: '1.5px solid var(--red-light)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: deletingSubjId === s.subjectId ? 'var(--text3)' : 'var(--red)', opacity: deletingSubjId === s.subjectId ? 0.5 : 1, flexShrink: 0 }}
                    disabled={deletingSubjId === s.subjectId}
                  >
                    {deletingSubjId === s.subjectId ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2} />}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                  {editingCoeffId === s.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={editingCoeffValue}
                        onChange={e => setEditingCoeffValue(e.target.value)}
                        style={{ width: 54, padding: '4px 7px', borderRadius: 6, fontSize: 12.5, border: '1.5px solid var(--green)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'center', outline: 'none' }}
                      />
                      <button
                        onClick={() => saveCoeff(s.subjectId)}
                        style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setEditingCoeffId(null)}
                        style={{ background: 'var(--bg2)', color: 'var(--text2)', border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={() => { setEditingCoeffId(s.id); setEditingCoeffValue(String(s.coefficient)) }}
                      style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '3px 9px', borderRadius: 22, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      ×{s.coefficient}
                    </span>
                  )}
                  {s.code && <code style={{ background: 'var(--bg2)', padding: '2.5px 7px', borderRadius: 5, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', color: 'var(--text2)' }}>{s.code}</code>}
                  {s.serieCode
                    ? <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '2.5px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>{s.serieCode}</span>
                    : <span style={{ color: 'var(--text3)', fontSize: 11.5 }}>{t('subjects.class_view.first_cycle')}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* ── Tableau — desktop ── */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {(t('subjects.class_view_headers') as unknown as string[]).map((h: string, i: number) => (
                    <th key={i} style={{ ...thStyle, textAlign: i === 4 ? 'center' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classSubjects.map(s => (
                  <tr
                    key={s.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                  >
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>
                      {s.name}
                      {s.classOnly && (
                        <span
                          title={t('subjects.class_view.class_only_badge')}
                          style={{ marginLeft: 6, background: 'var(--purple-light)', color: 'var(--purple)', padding: '1.5px 6.5px', borderRadius: 11, fontSize: 11, fontWeight: 800, verticalAlign: 'middle' }}
                        >
                          {t('subjects.class_view.class_only_badge')}
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {s.code ? <code style={{ background: 'var(--bg2)', padding: '2.5px 7px', borderRadius: 6, fontSize: 12 }}>{s.code}</code> : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      {editingCoeffId === s.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={editingCoeffValue}
                            onChange={e => setEditingCoeffValue(e.target.value)}
                            style={{ width: 54, padding: '4px 7px', borderRadius: 6, fontSize: 12.5, border: '1.5px solid var(--green)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'center', outline: 'none' }}
                          />
                          <button
                            onClick={() => saveCoeff(s.subjectId)}
                            style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setEditingCoeffId(null)}
                            style={{ background: 'var(--bg2)', color: 'var(--text2)', border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' }}
                          >
                            <X size={12} strokeWidth={2} />
                          </button>
                        </div>
                      ) : (
                        <span
                          onClick={() => { setEditingCoeffId(s.id); setEditingCoeffValue(String(s.coefficient)) }}
                          style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                          title={t('subjects.class_view.coeff_edit_tooltip')}
                        >
                          ×{s.coefficient}
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {s.serieCode
                        ? <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '3px 9px', borderRadius: 16, fontSize: 12, fontWeight: 700 }}>{s.serieCode}</span>
                        : <span style={{ color: 'var(--text3)', fontSize: 12 }}>{t('subjects.class_view.first_cycle')}</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        onClick={() => onDeleteSubject(s.subjectId, s.name)}
                        style={{ background: 'none', border: '1.5px solid var(--red-light)', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', color: deletingSubjId === s.subjectId ? 'var(--text3)' : 'var(--red)', opacity: deletingSubjId === s.subjectId ? 0.5 : 1 }}
                        disabled={deletingSubjId === s.subjectId}
                        onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'var(--red-light)' })}
                        onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'none' })}
                      >
                        {deletingSubjId === s.subjectId ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedClass && !loadingCV && (
        <div className="py-7 text-center" style={{ color: 'var(--text3)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <GraduationCap size={25} strokeWidth={1.5} />
          </div>
          <div className="text-xs md:text-sm font-medium">{t('subjects.class_view.no_selection')}</div>
        </div>
      )}
    </div>
  )
}
