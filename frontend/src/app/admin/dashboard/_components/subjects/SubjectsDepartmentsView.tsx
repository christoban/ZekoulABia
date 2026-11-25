'use client'

import type React from 'react'
import { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { AlertTriangle, FolderOpen, Pencil, Search, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { Department, DepartmentView, SubjectItem } from './types'
import { btnPrim, btnRetry } from './subjectsUi'

interface SubjectsDepartmentsViewProps {
  subjects: SubjectItem[]
  allDepartments: DepartmentView[]
  deptLoading: boolean
  deptError: string | null
  onRetry: () => void
  onOpenCreateDept: () => void
  onOpenEditDept: (dept: Department) => void
  onMoveSubject: (subjectId: string, subjectName: string, targetDeptId: string, targetDeptName: string) => void
}

function DeptDroppable({ deptId, children }: { deptId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: deptId })
  return (
    <div ref={setNodeRef} style={{ position: 'relative' }}>
      {isOver && <div style={{ position: 'absolute', inset: 0, borderRadius: 16, border: '2px dashed var(--green)', background: 'rgba(5,150,105,0.05)', zIndex: 10, pointerEvents: 'none' }} />}
      {children}
    </div>
  )
}

function DraggableSubject({ subjectId, deptId, children }: { subjectId: string; deptId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: subjectId, data: { deptId } })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.4 : 1 }}>
      {children}
    </div>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <span>
      {text.slice(0, idx)}
      <strong style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '1px 3px', borderRadius: 4, fontWeight: 900 }}>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </span>
  )
}

export default function SubjectsDepartmentsView({
  subjects,
  allDepartments,
  deptLoading,
  deptError,
  onRetry,
  onOpenCreateDept,
  onOpenEditDept,
  onMoveSubject,
}: SubjectsDepartmentsViewProps) {
  const t = useT('admin')
  const [deptSearch, setDeptSearch] = useState('')
  const [openDeptMenu, setOpenDeptMenu] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const depsWithoutAp = allDepartments.filter(d => !d.head && d.name !== 'Non classé')
  const deptSearchLower = deptSearch.toLowerCase()
  const searchMatchCount = deptSearch
    ? allDepartments.reduce((sum, d) => sum + d.subjects.filter(s => s.name.toLowerCase().includes(deptSearchLower)).length, 0)
    : 0

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const subjectId = active.id as string
    const targetDeptId = over.id as string
    const subjectName = subjects.find(s => s.id === subjectId)?.name ?? subjectId
    const targetDept = allDepartments.find(d => d.id === targetDeptId)
    if (!targetDept) return
    onMoveSubject(subjectId, subjectName, targetDeptId, targetDept.name)
  }

  return (
    <DndContext sensors={sensors} onDragStart={e => setActiveDragId(e.active.id as string)} onDragEnd={handleDragEnd}>
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-3.5 md:mb-4">
        <div
          className="rounded-[11px] md:rounded-[9px] px-3.5 py-2.5 border-0 md:border md:border-[1.5px] md:border-[var(--border)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none bg-[var(--surface)] md:bg-[var(--bg2)] md:max-w-[380px]"
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
        >
          <Search size={16} strokeWidth={2} color="var(--text3)" />
          <input
            value={deptSearch}
            onChange={e => setDeptSearch(e.target.value)}
            placeholder={t('subjects.departments.search_placeholder')}
            className="text-sm md:text-base font-semibold"
            style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'inherit', width: '100%' }}
          />
          {deptSearch && (
            <span onClick={() => setDeptSearch('')} style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: 13, display: 'inline-flex' }}>
              <X size={15} strokeWidth={2} />
            </span>
          )}
        </div>
        {(deptSearch && searchMatchCount > 0) || depsWithoutAp.length > 0 ? (
          <div className="flex flex-wrap items-center gap-[7px]">
            {deptSearch && searchMatchCount > 0 && (
              <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '4px 11px', borderRadius: 18, fontSize: 12.5, fontWeight: 800 }}>
                {t('subjects.departments.subject_count').replace('{count}', String(searchMatchCount))}
              </span>
            )}
            {depsWithoutAp.length > 0 && (
              <span style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '4px 11px', borderRadius: 18, fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
                {t('subjects.departments.ap_warning').replace('{count}', String(depsWithoutAp.length))}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {deptLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 34, height: 34, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!deptLoading && deptError && (
        <div style={{ background: 'var(--red-light)', borderRadius: 13, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5 }}>
            <AlertTriangle size={16} strokeWidth={2} /> {deptError}
          </span>
          <button onClick={onRetry} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!deptLoading && !deptError && allDepartments.length === 0 && (
        <div className="px-5 py-8 text-center" style={{ background: 'var(--surface)', borderRadius: 13, border: '1.5px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <FolderOpen size={28} strokeWidth={1.5} />
          </div>
          <div className="text-sm md:text-base font-medium mb-3" style={{ color: 'var(--text3)' }}>
            {t('subjects.departments.no_depts')}
          </div>
          <button className="w-full md:w-auto justify-center" style={{ ...btnPrim, display: 'inline-flex', alignItems: 'center' }} onClick={onOpenCreateDept}>
            {t('subjects.departments.btn_create')}
          </button>
        </div>
      )}

      {!deptLoading && !deptError && allDepartments.length > 0 && (
        <div className="grid grid-cols-1 md:[grid-template-columns:repeat(auto-fill,minmax(350px,1fr))]" style={{ gap: 16 }}>
          {allDepartments.map(dept => {
            const isVirtual = dept._virtual
            const hasSearch = deptSearch.length > 0
            const matchingSubjectIds = new Set(
              dept.subjects.filter(s => s.name.toLowerCase().includes(deptSearchLower)).map(s => s.id),
            )
            const hasAnyMatch = !hasSearch || matchingSubjectIds.size > 0

            return (
              <DeptDroppable key={dept.id} deptId={dept.id}>
                <div style={{
                  background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)',
                  opacity: hasSearch && !hasAnyMatch ? 0.4 : 1,
                  transition: 'opacity 0.2s',
                }}>
                  <div className="h-[5px]" style={{ borderTopLeftRadius: 14, borderTopRightRadius: 14, background: isVirtual ? 'var(--border2)' : dept.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }} />
                  <div className="p-4 md:p-4.5">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: isVirtual ? 'var(--border2)' : dept.color, flexShrink: 0 }} />
                        <span className="text-sm md:text-base font-bold" style={{ color: 'var(--text)' }}>{dept.name}</span>
                        <span className="text-xs md:text-sm font-bold" style={{ color: 'var(--text3)' }}>({dept.subjects.length})</span>
                      </div>
                      {!isVirtual && (
                        <button
                          onClick={() => onOpenEditDept(dept)}
                          style={{ background: 'var(--bg2)', border: 'none', borderRadius: 6, padding: '3.5px 7px', cursor: 'pointer', fontSize: 12.5, color: 'var(--text2)', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' }}
                          title={t('subjects.departments.edit_modal.title')}
                        >
                          <Pencil size={13} strokeWidth={2} />
                        </button>
                      )}
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      {dept.head
                        ? <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '2.5px 9px', borderRadius: 15, fontSize: 12, fontWeight: 700 }}>
                            AP : {dept.head.firstName} {dept.head.lastName}
                          </span>
                        : !isVirtual
                          ? <span style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={13} strokeWidth={2} /> {t('subjects.departments.no_head')}</span>
                          : <span style={{ color: 'var(--text3)', fontSize: 12, fontStyle: 'italic' }}>{t('subjects.departments.unassigned')}</span>}
                    </div>

                    {dept.subjects.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {[...dept.subjects]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(s => {
                            const isMatch = !hasSearch || matchingSubjectIds.has(s.id)
                            return (
                              <DraggableSubject key={s.id} subjectId={s.id} deptId={dept.id}>
                                <div
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 7, padding: '5.5px 8px', borderRadius: 7,
                                    background: isMatch && activeDragId === s.id ? 'var(--green-light)' : 'transparent',
                                    opacity: hasSearch && !isMatch ? 0.3 : 1,
                                    transition: 'opacity 0.2s, background 0.15s',
                                    cursor: 'grab', userSelect: 'none',
                                  }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isMatch && activeDragId === s.id ? 'var(--green-light)' : 'transparent'}
                                >
                                  <span style={{ fontSize: 13, color: 'var(--text3)', cursor: 'grab', opacity: activeDragId === s.id ? 1 : 0.3 }}>⠿</span>
                                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: isMatch ? 'var(--text)' : 'var(--text3)' }}>
                                    {hasSearch && isMatch ? highlightMatch(s.name, deptSearch) : s.name}
                                  </span>
                                  <span style={{ position: 'relative' }}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setOpenDeptMenu(openDeptMenu === s.id ? null : s.id) }}
                                      style={{ background: 'none', border: 'none', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', fontSize: 14, color: 'var(--text3)', fontFamily: 'inherit' }}
                                    >
                                      ⋯
                                    </button>
                                    {openDeptMenu === s.id && (
                                      <div style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 175, zIndex: 200, overflow: 'hidden' }}>
                                        <div style={{ padding: '6px 9px', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--bg2)' }}>
                                          {t('subjects.departments.move_to')}
                                        </div>
                                        {allDepartments.filter(other => other.id !== dept.id).map(other => (
                                          <div
                                            key={other.id}
                                            onClick={() => { setOpenDeptMenu(null); onMoveSubject(s.id, s.name, other.id, other.name) }}
                                            style={{ padding: '7px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                                          >
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: other.color, flexShrink: 0 }} />
                                            {other.name}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </span>
                                </div>
                              </DraggableSubject>
                            )
                          })}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text3)', fontSize: 12.5, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                        {t('subjects.departments.subjects_zero')}
                      </div>
                    )}

                    {isVirtual && (
                      <div style={{ marginTop: 7, background: 'var(--red-light)', borderRadius: 7, padding: '7px 11px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={14} strokeWidth={2} color="var(--red)" />
                        <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{t('subjects.teacher_view.unassigned_title')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </DeptDroppable>
            )
          })}
        </div>
      )}

      <DragOverlay>
        {activeDragId ? (
          <div style={{ padding: '8px 14px', background: 'var(--surface)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', fontWeight: 700, fontSize: 14, color: 'var(--text)', border: '2px solid var(--green)' }}>
            {subjects.find(s => s.id === activeDragId)?.name ?? activeDragId}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
