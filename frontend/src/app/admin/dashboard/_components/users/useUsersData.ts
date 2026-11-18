'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import { ROLE_TAB_CODES, type StaffTitle, type StudioStudent, type UserItem } from './types'

interface UseUsersDataParams {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onRequireReauth: (userId: string) => void
}

export function useUsersData({ onToast, onRequireReauth }: UseUsersDataParams) {
  const t = useT('admin')
  const [activeTab, setActiveTab] = useState(0)
  const [staffTitles, setStaffTitles] = useState<StaffTitle[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    getCachedData<StaffTitle[]>('admin:staff-titles').then(c => {
      if (c?.data && Array.isArray(c.data)) setStaffTitles(c.data)
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    fetchApi('/api/v2/school/staff-titles')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          setStaffTitles(d.data as StaffTitle[])
          putCachedData('admin:staff-titles', d.data).catch(() => {})
        }
      })
      .catch(() => { /* non bloquant */ })
  }, [])

  const fetchUsers = useCallback(async (roleFilter = '') => {
    const cacheKey = `admin:users:${roleFilter || 'ALL'}`
    const [cachedUsers, cachedCounts] = await Promise.all([
      getCachedData<UserItem[]>(cacheKey),
      getCachedData<Record<string, number>>('admin:users:role-counts'),
    ])

    let localList: UserItem[] | null = (cachedUsers?.data && Array.isArray(cachedUsers.data) && cachedUsers.data.length > 0)
      ? cachedUsers.data
      : null

    if (!localList) {
      const masterCache = await getCachedData<UserItem[]>('admin:users:ALL')
      if (masterCache?.data && Array.isArray(masterCache.data) && masterCache.data.length > 0) {
        localList = roleFilter ? masterCache.data.filter(u => u.role === roleFilter) : masterCache.data
        if (!cachedCounts?.data) {
          setCounts({
            ALL: masterCache.data.length,
            TEACHER: masterCache.data.filter(u => u.role === 'TEACHER').length,
            STUDENT: masterCache.data.filter(u => u.role === 'STUDENT').length,
            PARENT: masterCache.data.filter(u => u.role === 'PARENT').length,
            STAFF: masterCache.data.filter(u => u.role === 'STAFF').length,
          })
        }
      }
    }

    if (localList) {
      let displayList = localList
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        displayList = displayList.filter(u =>
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.studentProfile?.matricule && u.studentProfile.matricule.toLowerCase().includes(q)),
        )
      }
      setUsers(displayList)
      setLoading(false)
    }

    if (cachedCounts?.data) setCounts(cachedCounts.data)

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false)
      return
    }

    try {
      if (!localList || localList.length === 0) setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '100' })
      if (roleFilter) params.set('role', roleFilter)
      if (search) params.set('search', search)
      const res = await fetchApi(`/api/v2/users?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      const userList = data.data || []
      setUsers(userList)
      await putCachedData(cacheKey, userList)
      if (!roleFilter && data.roleCounts) {
        setCounts(data.roleCounts as Record<string, number>)
        await putCachedData('admin:users:role-counts', data.roleCounts)
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const isNet = (typeof navigator !== 'undefined' && !navigator.onLine) || errMsg.includes('fetch') || errMsg.includes('Network')
      if (isNet) {
        if (!localList || localList.length === 0) setUsers([])
      } else if (!localList || localList.length === 0) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement')
      }
    } finally {
      setLoading(false)
    }
  }, [search])

  const currentRoleFilter = ROLE_TAB_CODES[activeTab] ?? ''

  useEffect(() => {
    fetchUsers(ROLE_TAB_CODES[activeTab] ?? '')
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'user') {
        fetchUsers(ROLE_TAB_CODES[activeTab] ?? '')
      }
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchUsers, activeTab])

  const handleDelete = async (userId: string) => {
    if (!(await confirmAction(t('users.delete_confirm')))) return
    try {
      const res = await fetchApi(`/api/v2/users/${userId}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'REAUTH_REQUIRED') {
          onRequireReauth(userId)
          return
        }
        throw new Error(data.message || 'Erreur')
      }
      onToast(t('users.i18n_ext.toast.userDeleted'), 'success')
      fetchUsers(currentRoleFilter)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    }
  }

  const updateStudentPhoto = (studioStudent: StudioStudent | null, newPhotoUrl: string | null) => {
    if (!studioStudent) return
    setUsers(prev => prev.map(u => {
      if (u.studentProfile?.id === studioStudent.id || u.id === studioStudent.id) {
        return {
          ...u,
          studentProfile: u.studentProfile ? { ...u.studentProfile, photoUrl: newPhotoUrl } : null,
        }
      }
      return u
    }))
    onToast('Photo officielle enregistrée avec succès', 'success')
  }

  return {
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
  }
}
