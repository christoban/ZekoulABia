'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { AlertTriangle, Search, X, FolderOpen, Package } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface SubjectItem {
  id: string; name: string; code: string | null
}

interface Department {
  id: string; name: string; color: string
  head: { id: string; firstName: string; lastName: string } | null
  subjects: SubjectItem[]
}

const DEPT_COLORS = [
  { name: 'Lettres', color: 'var(--blue)' },
  { name: 'Sciences Humaines', color: 'var(--amber)' },
  { name: 'Langues Vivantes', color: 'var(--green)' },
  { name: 'Maths & Sciences', color: 'var(--red)' },
  { name: 'Informatique', color: 'var(--purple)' },
  { name: 'Arts & Culture', color: 'var(--orange)' },
  { name: 'Gris', color: 'var(--text3)' },
  { name: 'Personnalisé', color: 'var(--text)' },
]

export default function SectionDepartementsStaff({ onToast }: Props) {
  const t = useT('staff')
  const [search, setSearch] = useState('')

  const fetchDepartmentsFn = useCallback(async (): Promise<Department[]> => {
    const res = await fetchApi('/api/v2/departments', { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur')
    return data.data || []
  }, [])

  const { data: departmentsData, loading, error, fromCache, cachedAt, refetch: fetchDepartments } = useCachedFetch<Department[]>('staff:departments', fetchDepartmentsFn)
  const departments = departmentsData ?? []

  const searchLower = search.toLowerCase()
  const searchMatchCount = search
    ? departments.reduce((sum, d) => sum + d.subjects.filter(s => s.name.toLowerCase().includes(searchLower)).length, 0)
    : 0

  function getColorInfo(color: string) {
    return DEPT_COLORS.find(c => c.color === color) ?? { color, name: color }
  }

  if (error && error !== 'OFFLINE_NO_CACHE') {
    return (
      <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={16} strokeWidth={2} /></span><span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchDepartments} style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>{t('departements.retry')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={sTitle}>{t('departements.title')}</div>
          <div style={sSub}>{loading ? '…' : t('departements.subtitle', { count: departments.length })}</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Package size={13} strokeWidth={2} /> {t('dashboard.cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
      </div>

      {/* Barre outils */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', minWidth: 180, maxWidth: 360 }}>
          <span style={{ display: 'inline-flex' }}><Search size={14} strokeWidth={2} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('departements.searchPlaceholder')}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, width: '100%', color: 'var(--text)' }} />
          {search && <span onClick={() => setSearch('')} style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: 13, display: 'inline-flex' }}><X size={13} strokeWidth={2} /></span>}
        </div>
        {search && searchMatchCount > 0 && (
          <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '3px 9px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
            {t('departements.resultsCount', { count: searchMatchCount })}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
          <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* Empty */}
      {!loading && departments.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 38, marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}><FolderOpen size={38} strokeWidth={1.8} /></div>
          <div style={{ fontSize: 13.5, color: 'var(--text3)' }}>
            {t('departements.empty')}
          </div>
        </div>
      )}

      {/* Grid */}
      {!loading && departments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {departments.sort((a, b) => a.name.localeCompare(b.name)).map(dept => {
            const hasSearch = search.length > 0
            const matchingSubjectIds = new Set(
              dept.subjects.filter(s => s.name.toLowerCase().includes(searchLower)).map(s => s.id)
            )
            const hasAnyMatch = !hasSearch || matchingSubjectIds.size > 0

            return (
              <div key={dept.id} style={{
                background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden',
                opacity: hasSearch && !hasAnyMatch ? 0.4 : 1,
                transition: 'opacity 0.2s',
              }}>
                <div style={{ height: 4, background: dept.color }} />
                <div style={{ padding: '12px 14px' }}>
                  {/* En-tête */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: dept.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{dept.name}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600 }}>({dept.subjects.length})</span>
                    </div>
                  </div>

                  {/* AP */}
                  <div style={{ marginBottom: 8 }}>
                    {dept.head
                      ? <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '2px 7px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                          {t('departements.apLabel', { firstName: dept.head.firstName, lastName: dept.head.lastName })}
                        </span>
                      : <span style={{ color: 'var(--red)', fontSize: 11, fontWeight: 600 }}>{t('departements.apNotAssigned')}</span>
                    }
                  </div>

                  {/* Matières */}
                  {dept.subjects.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {dept.subjects
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(s => {
                          const isMatch = !hasSearch || matchingSubjectIds.has(s.id)
                          return (
                            <div key={s.id} style={{
                              display: 'flex', alignItems: 'center', gap: 5, padding: '3px 6px', borderRadius: 6,
                              opacity: hasSearch && !isMatch ? 0.3 : 1,
                              transition: 'opacity 0.2s',
                            }}>
                              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: isMatch ? 'var(--text)' : 'var(--text3)' }}>
                                {hasSearch && isMatch ? highlightMatch(s.name, search) : s.name}
                              </span>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text3)', fontSize: 11.5, fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
                      {t('departements.noSubjects')}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
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

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }

