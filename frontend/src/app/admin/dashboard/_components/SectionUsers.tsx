'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, FileText, MoreVertical, UserCheck, UserPlus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import StudentPhotoStudioModal from '@/app/staff/dashboard/_components/StudentPhotoStudioModal'
import ImportUsersWizardModal from './ImportUsersWizardModal'
import type { SectionUsersProps, StudioStudent, UserItem } from './users/types'
import { btnPrim, btnSecSm, sSub, sTitle } from './users/UserSharedPrimitives'
import { useUsersData } from './users/useUsersData'
import UserInviteModal from './users/UserInviteModal'
import UserCreateModal from './users/UserCreateModal'
import { UserEditModal, UserTransferModal } from './users/UserEditTransferModals'
import UsersListView from './users/UsersListView'
import { UserDocModal, UserReauthModal } from './users/UserDocAndReauthModals'

export default function SectionUsers({ onToast }: SectionUsersProps) {
  const t = useT('admin')

  const ROLE_TABS: { label: string; role: string }[] = [
    { label: t('users.role_tabs.all'), role: '' },
    { label: t('users.role_tabs.teachers'), role: 'TEACHER' },
    { label: t('users.role_tabs.students'), role: 'STUDENT' },
    { label: t('users.role_tabs.parents'), role: 'PARENT' },
    { label: t('users.role_tabs.staff'), role: 'STAFF' },
  ]

  const [openDD, setOpenDD] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserItem | null>(null)
  const [transferUser, setTransferUser] = useState<UserItem | null>(null)
  const [docUser, setDocUser] = useState<UserItem | null>(null)
  const [reauthPourUserId, setReauthPourUserId] = useState<string | null>(null)
  const [studioStudent, setStudioStudent] = useState<StudioStudent | null>(null)

  const [userActionsOpen, setUserActionsOpen] = useState(false)
  const userActionsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (userActionsRef.current && !userActionsRef.current.contains(e.target as Node)) setUserActionsOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const {
    activeTab,
    setActiveTab,
    currentRoleFilter,
    staffTitles,
    users,
    loading,
    error,
    search,
    setSearch,
    counts,
    fetchUsers,
    handleDelete,
    updateStudentPhoto,
  } = useUsersData({ onToast, onRequireReauth: setReauthPourUserId })

  const totalAll = Object.values(counts).reduce((s, n) => s + n, 0)
  const isStudentOrParentTab = currentRoleFilter === 'STUDENT' || currentRoleFilter === 'PARENT'

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <div className="text-[15px] md:text-[17px]" style={sTitle}>{t('users.title')}</div>
          <div className="text-[11px] md:text-[12px]" style={sSub}>{loading ? '…' : t('users.count_label').replace('{count}', String(totalAll))}</div>
        </div>
        <div className="hidden md:flex" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button style={btnSecSm} onClick={() => setCreateOpen(true)}>{t('users.btn_create')}</button>
          <button style={btnPrim} onClick={() => setInviteOpen(true)}>{t('users.btn_invite')}</button>
          <button style={btnSecSm} onClick={() => setImportOpen(true)}>{t('users.btn_import')}</button>
        </div>
        <div className="flex md:hidden items-center gap-[6px] flex-shrink-0">
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-[4px] rounded-full px-3 py-2 text-[12px] min-h-[38px] whitespace-nowrap border-0 shadow-sm"
            style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}
          >
            {t('users.btn_create')}
          </button>
          <div ref={userActionsRef} className="relative flex-shrink-0">
            <button
              onClick={() => setUserActionsOpen(o => !o)}
              aria-label="Menu"
              style={{ width: 38, height: 38, borderRadius: 19, border: 'none', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <MoreVertical size={16} strokeWidth={2} color="var(--text2)" />
            </button>
            {userActionsOpen && (
              <div style={{ position: 'absolute', top: 42, right: 0, width: 170, background: 'var(--surface)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18),0 2px 6px rgba(0,0,0,0.08)', padding: 6, zIndex: 20 }}>
                <div
                  onClick={() => { setUserActionsOpen(false); setInviteOpen(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer' }}
                >
                  <UserPlus size={15} color="var(--text2)" strokeWidth={2} />
                  <span style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500 }}>{t('users.btn_invite')}</span>
                </div>
                <div
                  onClick={() => { setUserActionsOpen(false); setImportOpen(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer' }}
                >
                  <FileText size={15} color="var(--text2)" strokeWidth={2} />
                  <span style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500 }}>{t('users.btn_import')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RACI Governance Banner */}
      <div
        className="mb-4 p-3 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-xs"
        style={{
          background: isStudentOrParentTab
            ? 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(30,58,138,0.04))'
            : 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(47,143,91,0.04))',
          borderColor: isStudentOrParentTab ? 'rgba(59,130,246,0.25)' : 'rgba(16,185,129,0.25)',
          color: 'var(--text)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg flex-shrink-0"
            style={{
              background: isStudentOrParentTab ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
              color: isStudentOrParentTab ? 'var(--blue)' : 'var(--primary)',
            }}
          >
            {isStudentOrParentTab ? <Eye size={16} /> : <UserCheck size={16} />}
          </div>
          <div>
            <p className="font-bold text-xs" style={{ color: 'var(--text)' }}>
              {isStudentOrParentTab
                ? 'Annuaire Général Élèves & Parents — Mode Consultation & Modification de secours'
                : 'Gestion Directe du Personnel & Comptes Staff — Action Administrateur'}
            </p>
            <p className="text-[11.5px]" style={{ color: 'var(--text2)' }}>
              {isStudentOrParentTab
                ? 'La saisie quotidienne des inscriptions est déléguée au Secrétariat (Module Onboarding Élèves). En tant qu’Admin, vous accédez à l’annuaire complet et aux modifications exceptionnelles.'
                : 'Seul l’Administrateur peut créer des comptes pour les Enseignants et le Staff, attribuer les rôles et réinitialiser les accès.'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs — mobile */}
      <div className="relative md:hidden mb-[14px] -mr-4">
        <div className="flex gap-[6px] overflow-x-auto pr-8 py-[2px]" style={{ scrollbarWidth: 'none' }}>
          {ROLE_TABS.map((tab, i) => {
            const cnt = i === 0 ? totalAll : (counts[tab.role] ?? 0)
            const active = activeTab === i
            return (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className="relative flex-shrink-0 flex items-center gap-[6px] rounded-full px-[14px] py-[9px] whitespace-nowrap border-0"
                style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {active && (
                  <motion.div
                    layoutId="users-tab-pill"
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'var(--sidebar)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 text-[13px]" style={{ fontWeight: active ? 700 : 500, color: active ? '#fff' : 'var(--text3)' }}>{tab.label}</span>
                <span className="relative z-10 text-[11px] font-bold rounded-lg px-[6px]" style={{ color: active ? '#fff' : 'var(--text3)', background: active ? 'rgba(255,255,255,0.2)' : 'var(--border)' }}>{cnt}</span>
              </button>
            )
          })}
        </div>
        <div className="pointer-events-none absolute top-0 right-0 bottom-[4px] w-7" style={{ background: 'linear-gradient(90deg,transparent,var(--bg) 65%)' }} />
      </div>

      {/* Tabs — desktop */}
      <div className="hidden md:flex" style={{ gap: 2, background: 'var(--bg2)', padding: 4, borderRadius: 10, marginBottom: 16, width: 'fit-content', flexWrap: 'wrap' }}>
        {ROLE_TABS.map((tab, i) => {
          const cnt = i === 0 ? totalAll : (counts[tab.role] ?? 0)
          return (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              style={{ padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', display: 'flex', alignItems: 'center', gap: 5, background: activeTab === i ? 'var(--surface)' : 'transparent', color: activeTab === i ? 'var(--text)' : 'var(--text3)', boxShadow: activeTab === i ? '0 1px 3px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.12s', whiteSpace: 'nowrap' }}
            >
              {tab.label}
              <span style={{ fontSize: 11, padding: '1.5px 6px', borderRadius: 6, background: activeTab === i ? 'var(--green-light)' : 'var(--border)', color: activeTab === i ? 'var(--green2)' : 'var(--text3)', fontWeight: 800 }}>{cnt}</span>
            </button>
          )
        })}
      </div>

      <UsersListView
        users={users}
        loading={loading}
        error={error}
        search={search}
        onSearchChange={setSearch}
        onSearch={() => fetchUsers(currentRoleFilter)}
        onRetry={() => fetchUsers(currentRoleFilter)}
        openDD={openDD}
        setOpenDD={setOpenDD}
        onEdit={setEditUser}
        onStudio={setStudioStudent}
        onTransfer={setTransferUser}
        onOpenDoc={setDocUser}
        onDelete={handleDelete}
      />

      {inviteOpen && (
        <UserInviteModal
          onClose={() => setInviteOpen(false)}
          onSuccess={msg => {
            onToast(msg, 'success')
            setInviteOpen(false)
            fetchUsers(currentRoleFilter)
          }}
          staffTitles={staffTitles}
        />
      )}

      {editUser && (
        <UserEditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={() => fetchUsers(currentRoleFilter)}
          onToast={onToast}
        />
      )}

      {transferUser && (
        <UserTransferModal
          user={transferUser}
          onClose={() => setTransferUser(null)}
          onSuccess={() => fetchUsers(currentRoleFilter)}
          onToast={onToast}
        />
      )}

      {docUser && <UserDocModal user={docUser} onClose={() => setDocUser(null)} />}

      {importOpen && (
        <ImportUsersWizardModal
          onClose={() => setImportOpen(false)}
          onToast={onToast}
          onSuccess={() => fetchUsers(currentRoleFilter)}
        />
      )}

      {createOpen && (
        <UserCreateModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => fetchUsers(currentRoleFilter)}
          onToast={onToast}
          staffTitles={staffTitles}
        />
      )}

      {reauthPourUserId && (
        <UserReauthModal
          userId={reauthPourUserId}
          onClose={() => setReauthPourUserId(null)}
          onDeleted={() => fetchUsers(currentRoleFilter)}
          onToast={onToast}
        />
      )}

      {studioStudent && (
        <StudentPhotoStudioModal
          student={studioStudent}
          onClose={() => setStudioStudent(null)}
          onSuccess={newUrl => updateStudentPhoto(studioStudent, newUrl)}
          onToast={(msg, type) => onToast(msg, type === 'warning' ? 'info' : type)}
        />
      )}
    </div>
  )
}
