'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import MasterTopbar from './_components/MasterTopbar'
import SectionOverview from './_components/SectionOverview'
import SectionSchools from './_components/SectionSchools'
import SectionReferentielsHub from './_components/SectionReferentielsHub'
import SectionLogs from './_components/SectionLogs'
import MasterModals from './_components/MasterModals'
import SchoolSlideOver from './_components/SchoolSlideOver'
import MasterToast from './_components/MasterToast'
import type { Section, SchoolTab, ModalId, Toast, KpiData, ActivityRow, SchoolRow } from './_types'
import {
  fetchMe, fetchSchools, fetchSchoolDetail, fetchLogs, logout, fetchMasterMfaStatus,
  ApiError,
  type MasterUserDto, type SchoolDetailDto, type AuditLogDto,
} from './_api'

let toastId = 0

// On ne filtre JAMAIS par statut côté serveur : on récupère toujours toutes les écoles
// et on laisse le client trier. Sinon les compteurs des autres onglets tombent à 0
// dès qu'on clique sur un onglet à filtre serveur (ex: "Rejetées" → schools = [] pour les actives).
const TAB_STATUS_MAP: Record<SchoolTab, string | undefined> = {
  all:       undefined,
  pending:   undefined,
  approved:  undefined,
  active:    undefined,
  suspended: undefined,
  draft:     undefined,
  rejected:  undefined,
}

function computeKpi(schools: SchoolRow[]): KpiData {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    activeSchools:  schools.filter(s => s.status === 'active').length,
    pendingSchools: schools.filter(s => s.status === 'pending').length,
    pendingInvites: schools.filter(s => s.status === 'draft').length,   // invitations en cours
    newThisMonth:   schools.filter(s => new Date(s.createdAt) >= monthStart).length,
    totalSchools:   schools.length,
    suspendedCount: schools.filter(s => s.status === 'suspended').length,
  }
}

function toSchoolRow(s: { id: string; name: string; subdomain: string; type: string; plan: string; status: string; email?: string | null; createdAt: string; invites?: { email: string; status: string; expiresAt: string }[]; users?: { email: string | null }[] }): SchoolRow {
  const invite = s.invites?.[0]
  const hasPendingInvite = !!invite
  // Email admin : priorité school.email → user ADMIN → email invite
  const adminUserEmail = s.users?.[0]?.email ?? null
  const rawStatus = s.status.toLowerCase()

  // Calcul du statut effectif affiché :
  // • PENDING  + invite active  → 'draft'   (école invitée, onboarding pas encore fait)
  // • PENDING  + pas d'invite   → 'pending' (onboarding fait, attend approbation master)
  // • APPROVED                  → 'approved' (approuvée, attend que l'admin se connecte)
  // • Autres (ACTIVE/SUSPENDED/REJECTED/DRAFT natif) → inchangé
  let status: SchoolRow['status']
  if (rawStatus === 'draft' || (rawStatus === 'pending' && hasPendingInvite)) {
    status = 'draft'
  } else if (rawStatus === 'pending') {
    status = 'pending'
  } else {
    status = rawStatus as SchoolRow['status']
  }

  return {
    id: s.id,
    name: s.name,
    subdomain: s.subdomain,
    type: s.type,
    plan: (s.plan === 'DISCOVERY' ? 'deco' : s.plan === 'STANDARD' ? 'std' : 'prem') as SchoolRow['plan'],
    status,
    // school.email est null tant que l'admin n'a pas créé son compte (statut draft)
    // On utilise invite.email comme fallback : c'est l'adresse où l'invitation a été envoyée
    adminEmail: s.email ?? adminUserEmail ?? invite?.email ?? '',
    // inviteStatus n'a de sens que pour les écoles en phase d'invitation (draft)
    inviteStatus: hasPendingInvite ? invite!.status.toLowerCase() : '-',
    inviteExpiry: invite?.expiresAt ? new Date(invite.expiresAt).toLocaleDateString('fr-CM') : undefined,
    createdAt: new Date(s.createdAt).toLocaleDateString('fr-CM'),
  }
}

export default function SuperAdminDashboard() {
  const [section, setSection] = useState<Section>('overview')
  const [schoolTab, setSchoolTab] = useState<SchoolTab>('all')
  const [modal, setModal] = useState<ModalId>(null)
  const [slideOver, setSlideOver] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [toastCb, setToastCb] = useState<{ msg: string; type: Toast['type'] } | null>(null)

  const [user, setUser] = useState<MasterUserDto | null>(null)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [schools, setSchools] = useState<SchoolRow[]>([])
  const [schoolsLoading, setSchoolsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [schoolDetail, setSchoolDetail] = useState<SchoolDetailDto | null>(null)
  const [schoolDetailLoading, setSchoolDetailLoading] = useState(false)
  const [logs, setLogs] = useState<AuditLogDto[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; name: string; subdomain: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [confirmActionTarget, setConfirmActionTarget] = useState<import('./_types').ConfirmActionTarget | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const refreshSchools = useCallback(async (tab?: SchoolTab, search?: string) => {
    setSchoolsLoading(true)
    try {
      const status = tab ? TAB_STATUS_MAP[tab] : TAB_STATUS_MAP[schoolTab]
      const res = await fetchSchools({ status, search, limit: 100 })
      setSchools(res.data.map(toSchoolRow))
    } catch {
      showToast('Erreur lors du chargement des écoles', 'error')
    } finally {
      setSchoolsLoading(false)
    }
  }, [schoolTab, showToast])

  const refreshLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await fetchLogs({ limit: 100 })
      setLogs(res.data)
    } catch {
      showToast('Erreur lors du chargement des logs', 'error')
    } finally {
      setLogsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          logout().catch(() => {}).finally(() => {
            window.location.replace('/master/login?logout=1')
          })
        }
      })
    fetchMasterMfaStatus().then(d => setMfaEnabled(d.mfaEnabled)).catch(() => {})
    refreshSchools()
    refreshLogs()
  }, [refreshSchools, refreshLogs])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModal(null)
        setSlideOver(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleTabChange = useCallback((tab: SchoolTab) => {
    setSchoolTab(tab)
    refreshSchools(tab, searchTerm)
  }, [refreshSchools, searchTerm])

  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      refreshSchools(schoolTab, term)
    }, 400)
  }, [refreshSchools, schoolTab])

  const handleLogout = useCallback(async () => {
    try {
      await logout()
    } catch { /* ignore */ }
    window.location.href = '/master/login?logout=1'
  }, [])

  const goToSchools = useCallback((tab?: string) => {
    setSection('schools')
    if (tab) {
      const st = tab as SchoolTab
      setSchoolTab(st)
      refreshSchools(st, searchTerm)
    }
  }, [refreshSchools, searchTerm])

  const openSuspend = useCallback((id: string, name: string, subdomain: string) => {
    setSelectedSchoolId(id)
    setSuspendTarget({ id, name, subdomain })
    setModal('suspend')
  }, [])

  const openDelete = useCallback((id: string, name: string) => {
    setSelectedSchoolId(id)
    setDeleteTarget({ id, name })
    setModal('delete')
  }, [])

  const openApprove = useCallback((id: string) => {
    setSelectedSchoolId(id)
    setModal('approve')
  }, [])

  const openReject = useCallback((id: string) => {
    setSelectedSchoolId(id)
    setModal('reject')
  }, [])

  const handleViewDetails = useCallback(async (id: string) => {
    setSlideOver(true)
    setSchoolDetailLoading(true)
    try {
      const detail = await fetchSchoolDetail(id)
      setSchoolDetail(detail)
    } catch {
      showToast('Erreur lors du chargement des détails', 'error')
    } finally {
      setSchoolDetailLoading(false)
    }
  }, [showToast])

  const handleActionDone = useCallback(() => {
    refreshSchools()
    refreshLogs()
  }, [refreshSchools, refreshLogs])

  const kpiData: KpiData = computeKpi(schools)
  const overviewActivity: ActivityRow[] = logs.slice(0, 6).map(log => ({
    date: new Date(log.createdAt).toLocaleString('fr-CM'),
    badge: log.action.includes('reject') ? 'rejected' as const
      : log.action.includes('suspend') ? 'suspended' as const
      : log.action.includes('approv') || log.action.includes('valid') ? 'approved' as const
      : log.action.includes('invit') || log.action.includes('pending') ? 'pending' as const
      : 'active' as const,
    action: log.action,
    school: log.targetId ?? '-',
    operator: log.masterUser?.name ?? 'Système',
  }))

  const filteredSchools = schools

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
      background: '#f7f3ee',
      fontFamily: 'var(--font-nunito), Nunito, sans-serif'
    }}>
      <MasterTopbar
        user={user}
        currentSection={section}
        mfaEnabled={mfaEnabled}
        onNav={setSection}
        onLogout={handleLogout}
      />

      <main style={{ flex: 1, overflow: 'hidden' }}>
        {section === 'overview' && (
          <SectionOverview
            kpi={kpiData}
            activity={overviewActivity}
            onInvite={() => { setSelectedSchoolId(null); setModal('invite') }}
            onGoToSchools={goToSchools}
            onGoToLogs={() => setSection('logs')}
          />
        )}

        {section === 'schools' && (
          <SectionSchools
            schools={filteredSchools}
            loading={schoolsLoading}
            activeTab={schoolTab}
            onTabChange={handleTabChange}
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            onInvite={() => { setSelectedSchoolId(null); setModal('invite') }}
            onApprove={openApprove}
            onReject={openReject}
            onSuspend={openSuspend}
            onDelete={openDelete}
            onViewDetails={handleViewDetails}
            onToast={showToast}
            onRefresh={handleActionDone}
            onConfirmAction={(target) => {
              setConfirmActionTarget(target)
              setModal('confirmAction')
            }}
          />
        )}

        {section === 'referentiels' && (
          <SectionReferentielsHub onToast={showToast} />
        )}

        {section === 'logs' && <SectionLogs logs={logs} loading={logsLoading} onChangePwd={() => setModal('changePwd')} mfaEnabled={mfaEnabled} />}
      </main>

      <MasterModals
        open={modal}
        schoolId={selectedSchoolId}
        suspendTarget={suspendTarget}
        deleteTarget={deleteTarget}
        confirmActionTarget={confirmActionTarget}
        mfaEnabled={mfaEnabled}
        onClose={() => {
          setModal(null)
          setSuspendTarget(null)
          setDeleteTarget(null)
          setConfirmActionTarget(null)
          setSelectedSchoolId(null)
        }}
        onToast={showToast}
        onActionDone={handleActionDone}
      />

      <SchoolSlideOver
        open={slideOver}
        schoolDetail={schoolDetail}
        loading={schoolDetailLoading}
        onClose={() => { setSlideOver(false); setSchoolDetail(null) }}
        onSuspend={(id, name, subdomain) => {
          setSlideOver(false)
          openSuspend(id, name, subdomain)
        }}
      />

      <MasterToast toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
