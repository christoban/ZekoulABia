'use client'
import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, School } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import DelegationSupervisionBanner from './DelegationSupervisionBanner'
import { extractAssignedTeachers } from '@/features/classes/classesShared'
export { extractAssignedTeachers }

import type { AdminSection } from '../_types'
import { btnPrim, btnRetry, type ClassItem, type ClassTarget, type SchoolInfo } from './classes/classesUi'
import ClassesGridView from './classes/ClassesGridView'
import { CreateClassModal, DeleteClassModal, EditClassModal } from './classes/ClassCrudModals'
import ClassPpModal from './classes/ClassPpModal'
import ClassSubgroupsModal from './classes/ClassSubgroupsModal'
import ClassLv2Modal from './classes/ClassLv2Modal'
import ClassPebsModal from './classes/ClassPebsModal'
import ClassALevelModal from './classes/ClassALevelModal'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onNav?: (section: AdminSection) => void
}

export default function SectionClasses({ onToast, onNav }: Props) {
  const t = useT('admin')

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null)
  const [ppTarget, setPpTarget] = useState<ClassTarget | null>(null)
  const [delConfirm, setDelConfirm] = useState<ClassTarget | null>(null)
  const [sgTarget, setSgTarget] = useState<ClassTarget | null>(null)
  const [lv2Target, setLv2Target] = useState<ClassTarget | null>(null)
  const [pebsTarget, setPebsTarget] = useState<ClassTarget | null>(null)
  const [alevelTarget, setAlevelTarget] = useState<ClassTarget | null>(null)

  const fetchClasses = useCallback(async () => {
    const cached = await getCachedData<ClassItem[]>('admin:classes')
    const fallbackCached = !cached?.data ? await getCachedData<ClassItem[]>('staff:classes') : null
    const initialList = cached?.data || fallbackCached?.data
    if (initialList && Array.isArray(initialList) && initialList.length > 0) {
      setClasses(initialList)
      setLoading(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false)
      return
    }

    try {
      if (!initialList || initialList.length === 0) setLoading(true)
      setError(null)
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      const list: ClassItem[] = data.data || []
      setClasses(list)
      await putCachedData('admin:classes', list)
      await putCachedData('staff:classes', list)
    } catch (err) {
      if (!initialList || initialList.length === 0) {
        setError(err instanceof Error ? err.message : t('classes.error.load'))
      }
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { fetchClasses() }, [fetchClasses])

  // Rafraîchissement temps réel quand l'assistant IA agit sur les classes.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'class') fetchClasses()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchClasses])

  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.data) setSchoolInfo(data.data) })
      .catch(() => {})
  }, [])

  const totalEleves = classes.reduce((s, c) => s + c._count.students, 0)

  return (
    <div className="h-full overflow-y-auto px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4 max-w-7xl mx-auto pb-12 font-nunito">
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div className="pb-1.5 border-b border-[var(--border)]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-[15px] md:text-[17px] font-bold font-spectral" style={{ color: 'var(--text)' }}>
            {t('classes.title')}
          </h1>
          <p className="text-[11px] md:text-[12px] font-medium mt-0.5" style={{ color: 'var(--text3)' }}>
            {loading ? '…' : t('classes.subtitle').replace('{count}', String(classes.length)).replace('{students}', String(totalEleves))}
          </p>
        </div>
        <button className="hidden md:inline-block" style={btnPrim} onClick={() => setCreateOpen(true)}>{t('classes.btn_create')}</button>
        <button
          className="md:hidden min-h-[38px] inline-flex items-center gap-[6px] rounded-lg px-[13px] py-[8px] text-[13px] border-0 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}
          onClick={() => setCreateOpen(true)}
        >
          {t('classes.btn_create')}
        </button>
      </div>

      <DelegationSupervisionBanner actorTitle="Censeur / Directrice des Études" domainLabel="Classes & Structuration Pédagogique" onNav={onNav} />

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} color="var(--red)" />
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchClasses} style={btnRetry}>{t('dashboard.retry')}</button>
        </div>
      )}

      {!loading && !error && classes.length === 0 && (
        <div className="px-6 py-12 text-center" style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><School size={40} strokeWidth={1.5} color="var(--text3)" /></div>
          <div className="text-lg md:text-xl font-bold font-spectral mb-2" style={{ color: 'var(--text)' }}>{t('classes.empty.title')}</div>
          <div className="text-sm md:text-base font-medium mb-5" style={{ color: 'var(--text3)' }}>{t('classes.empty.desc')}</div>
          <button style={btnPrim} onClick={() => setCreateOpen(true)}>{t('classes.btn_create')}</button>
        </div>
      )}

      {!loading && !error && classes.length > 0 && (
        <ClassesGridView
          classes={classes}
          schoolInfo={schoolInfo}
          onOpenPP={cls => setPpTarget({ id: cls.id, name: cls.name })}
          onOpenEdit={cls => setEditingClass(cls)}
          onOpenSubgroups={cls => setSgTarget({ id: cls.id, name: cls.name })}
          onOpenLV2={cls => setLv2Target({ id: cls.id, name: cls.name })}
          onOpenPEBS={cls => setPebsTarget({ id: cls.id, name: cls.name })}
          onOpenALevel={cls => setAlevelTarget({ id: cls.id, name: cls.name })}
          onDelete={cls => setDelConfirm({ id: cls.id, name: cls.name })}
        />
      )}

      <CreateClassModal open={createOpen} schoolInfo={schoolInfo} onClose={() => setCreateOpen(false)} onCreated={fetchClasses} onToast={onToast} />
      <EditClassModal target={editingClass} schoolInfo={schoolInfo} onClose={() => setEditingClass(null)} onUpdated={fetchClasses} onToast={onToast} />
      <ClassPpModal target={ppTarget} onClose={() => setPpTarget(null)} onAssigned={fetchClasses} onToast={onToast} />
      <DeleteClassModal
        target={delConfirm}
        onClose={() => setDelConfirm(null)}
        onDeleted={deletedId => {
          setClasses(prev => prev.filter(c => c.id !== deletedId))
          setDelConfirm(null)
        }}
        onToast={onToast}
      />

      {sgTarget && <ClassSubgroupsModal key={sgTarget.id} target={sgTarget} onClose={() => setSgTarget(null)} onToast={onToast} />}
      {lv2Target && <ClassLv2Modal key={lv2Target.id} target={lv2Target} onClose={() => setLv2Target(null)} onToast={onToast} />}
      {pebsTarget && <ClassPebsModal key={pebsTarget.id} target={pebsTarget} schoolInfo={schoolInfo} onClose={() => setPebsTarget(null)} onToast={onToast} />}
      {alevelTarget && <ClassALevelModal key={alevelTarget.id} target={alevelTarget} onClose={() => setAlevelTarget(null)} onToast={onToast} />}
    </div>
  )
}
