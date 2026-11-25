'use client'

import { useState } from 'react'
import { AlertTriangle, Presentation, Search, X } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import { avatarColor, type SubjectItem, type TeacherWithSubjects } from './types'

interface SubjectsByTeacherViewProps {
  subjects: SubjectItem[]
  teachers: TeacherWithSubjects[]
  loading: boolean
  onRefresh: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SubjectsByTeacherView({
  subjects,
  teachers,
  loading,
  onRefresh,
  onToast,
}: SubjectsByTeacherViewProps) {
  const t = useT('admin')
  const [search, setSearch] = useState('')
  const [addingForTeacherId, setAddingForTeacherId] = useState<string | null>(null)

  const assignedSubjectIds = new Set(
    teachers.flatMap(teacher => teacher.teacherProfile?.teacherSubjects?.map(ts => ts.subjectId) ?? []),
  )
  const unassignedSubjs = subjects.filter(s => !assignedSubjectIds.has(s.id))

  return (
    <div>
      <div className="mb-3.5 md:mb-4" style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
        <div
          className="rounded-[11px] md:rounded-[9px] px-3.5 py-2.5 border-0 md:border md:border-[1.5px] md:border-[var(--border)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none bg-[var(--surface)] md:bg-[var(--bg2)]"
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, maxWidth: 380 }}
        >
          <Search size={16} strokeWidth={2} color="var(--text3)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('subjects.teacher_view.search_placeholder')}
            className="text-sm md:text-base font-semibold"
            style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'inherit', width: '100%' }}
          />
          {search && (
            <span onClick={() => setSearch('')} style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: 13, display: 'inline-flex' }}>
              <X size={15} strokeWidth={2} />
            </span>
          )}
        </div>
        <span style={{ fontSize: 13.5, color: 'var(--text3)', fontWeight: 600 }}>
          {teachers.length} enseignant{teachers.length > 1 ? 's' : ''}
        </span>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && teachers.length === 0 && (
        <div className="px-5 py-8 text-center" style={{ background: 'var(--surface)', borderRadius: 13, border: '1.5px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <Presentation size={28} strokeWidth={1.5} />
          </div>
          <div className="text-sm md:text-base font-medium" style={{ color: 'var(--text3)' }}>{t('subjects.teacher_view.no_results')}</div>
        </div>
      )}

      {!loading && teachers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {teachers
            .filter(teacher => !search || `${teacher.firstName} ${teacher.lastName}`.toLowerCase().includes(search.toLowerCase()))
            .map(teacher => {
              const teacherSubjects = teacher.teacherProfile?.teacherSubjects ?? []
              const unassignedForTeacher = subjects.filter(
                s => !teacherSubjects.some(ts => ts.subjectId === s.id),
              )
              return (
                <div key={teacher.id} className="rounded-xl border border-[var(--border)] p-4" style={{ background: 'var(--surface)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div className="w-7.5 h-7.5" style={{ borderRadius: 8, background: avatarColor(teacher.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                          {teacher.firstName[0]?.toUpperCase()}{teacher.lastName[0]?.toUpperCase()}
                        </div>
                        <div className="text-sm md:text-base font-bold" style={{ color: 'var(--text)', minWidth: 0 }}>
                          {teacher.firstName} {teacher.lastName}
                        </div>
                      </div>
                      <span className="text-xs md:text-sm px-3 py-1 font-bold" style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 16, flexShrink: 0 }}>
                        {t('subjects.class_view.count_badge').replace('{count}', String(teacherSubjects.length))}
                      </span>
                    </div>

                    {teacherSubjects.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {teacherSubjects.map(ts => (
                          <span
                            key={ts.subjectId}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--green-light)', color: 'var(--green)', padding: '3px 9px', borderRadius: 17, fontSize: 12, fontWeight: 700 }}
                          >
                            {ts.subject?.name ?? ts.subjectId}
                            <span
                              onClick={async () => {
                                if (!(await confirmAction(t('subjects.teacher_view.remove_confirm').replace('{subject}', ts.subject?.name ?? ts.subjectId).replace('{teacher}', `${teacher.firstName} ${teacher.lastName}`)))) return
                                try {
                                  const res = await fetchApi(`/api/v2/subjects/teachers/${teacher.id}/assign`, {
                                    method: 'POST',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ subjectId: ts.subjectId, action: 'RETIRER' }),
                                  })
                                  if (!res.ok) throw new Error()
                                  onToast(t('subjects.class_view.toast_removed').replace('{name}', ts.subject?.name ?? ts.subjectId), 'success')
                                  onRefresh()
                                } catch {
                                  onToast(t('subjects.departments.toast_move_error'), 'error')
                                }
                              }}
                              style={{ cursor: 'pointer', marginLeft: 2, fontSize: 13, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}
                              title="Retirer"
                            >
                              <X size={13} strokeWidth={2} />
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                    {teacherSubjects.length === 0 && (
                      <div style={{ color: 'var(--text3)', fontSize: 12, fontStyle: 'italic', marginBottom: 10 }}>{t('subjects.teacher_view.no_subjects')}</div>
                    )}

                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setAddingForTeacherId(addingForTeacherId === teacher.id ? null : teacher.id)}
                        style={{
                          padding: '5px 11px',
                          borderRadius: 7,
                          fontSize: 12.5,
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          background: addingForTeacherId === teacher.id ? 'var(--green)' : 'var(--green-light)',
                          color: addingForTeacherId === teacher.id ? 'white' : 'var(--green)',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {t('subjects.teacher_view.btn_add')}
                      </button>

                      {addingForTeacherId === teacher.id && unassignedForTeacher.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 'calc(100% + 4px)',
                          background: 'var(--surface)',
                          border: '1.5px solid var(--border2)',
                          borderRadius: 11,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                          minWidth: 220,
                          maxHeight: 230,
                          overflowY: 'auto',
                          zIndex: 200,
                        }}>
                          <div style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text3)', borderBottom: '1px solid var(--bg2)' }}>
                            {t('subjects.teacher_view.choose_subject')}
                          </div>
                          {unassignedForTeacher.map(sub => (
                            <div
                              key={sub.id}
                              onClick={async () => {
                                try {
                                  const res = await fetchApi(`/api/v2/subjects/teachers/${teacher.id}/assign`, {
                                    method: 'POST',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ subjectId: sub.id, action: 'ASSIGNER' }),
                                  })
                                  if (!res.ok) throw new Error()
                                  onToast(`"${sub.name}" assigné à ${teacher.firstName} ${teacher.lastName}`, 'success')
                                  setAddingForTeacherId(null)
                                  onRefresh()
                                } catch {
                                  onToast("Erreur lors de l'assignation", 'error')
                                }
                              }}
                              style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', borderBottom: '1px solid var(--bg2)' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                            >
                              {sub.name}
                            </div>
                          ))}
                        </div>
                      )}
                      {addingForTeacherId === teacher.id && unassignedForTeacher.length === 0 && (
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 'calc(100% + 4px)',
                          background: 'var(--surface)',
                          border: '1.5px solid var(--border2)',
                          borderRadius: 11,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                          minWidth: 220,
                          zIndex: 200,
                        }}>
                          <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('subjects.teacher_view.all_assigned')}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {!loading && subjects.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 13, border: '1.5px solid var(--border)', overflow: 'hidden', marginTop: 14 }}>
          <div className="px-4 py-3 gap-2 border-b border-[var(--border)] flex items-center">
            <AlertTriangle size={16} strokeWidth={2} style={{ color: 'var(--amber)' }} />
            <span className="text-sm md:text-base font-bold" style={{ color: 'var(--text)' }}>{t('subjects.teacher_view.unassigned_title')}</span>
          </div>
          {unassignedSubjs.length === 0 ? (
            <div className="text-xs md:text-sm py-4 text-center font-medium" style={{ color: 'var(--text3)' }}>
              {t('subjects.teacher_view.all_covered')}
            </div>
          ) : (
            <div className="p-3.5 flex flex-wrap gap-2">
              {unassignedSubjs.map(s => (
                <span key={s.id} style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '3px 9px', borderRadius: 15, fontSize: 12, fontWeight: 700 }}>
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
