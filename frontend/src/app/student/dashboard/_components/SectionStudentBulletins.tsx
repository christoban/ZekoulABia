'use client'
import { useCallback, useState, useEffect } from 'react'
import { ScrollText, Download, Loader2, WifiOff, Eye, Printer } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'
import BulletinModalLight, { type BulletinData } from '@/components/bulletin/BulletinModalLight'
import { getUserSession } from '@/lib/offline/db'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

const MENTION_COLOR = (m: string | null): [string, string] => {
  const map: Record<string, [string, string]> = {
    TB: ['var(--green-light)', 'var(--green)'], B: ['var(--blue-light)', 'var(--blue)'],
    AB: ['var(--amber-light)', 'var(--amber)'], P: ['var(--orange-light)', 'var(--orange)'], I: ['var(--red-light)', 'var(--red)'],
  }
  return map[m ?? ''] ?? ['var(--bg2)', 'var(--text2)']
}

const NOTE_COLOR = (n: number | null) => n !== null ? (n >= 14 ? 'var(--green)' : n >= 10 ? 'var(--blue)' : 'var(--red)') : 'var(--text3)'

function CacheBadge({ cachedAt }: { cachedAt: number | null }) {
  const t = useT('student')
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
      {t('common.offline_badge').replace('{date}', date)}
    </div>
  )
}

export default function SectionStudentBulletins({ onToast, user }: Props) {
  const t = useT('student')
  const tcommon = useT('common')
  const isOnline = useOnlineStatus()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [selectedBulletin, setSelectedBulletin] = useState<BulletinData | null>(null)
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logoUrl: string | null } | null>(null)

  useEffect(() => {
    if (user?.id) {
      getUserSession(user.id).then(s => {
        if (s?.schoolInfo) setSchoolInfo(s.schoolInfo)
      }).catch(() => {})
    }
  }, [user])

  const cacheKey = user ? `student:bulletins:${user.id}` : ''
  const fetchFn = useCallback(async () => {
    const res = await fetchApi('/api/v2/report-cards/my', { credentials: 'include' }).then(r => r.json())
    return (res.reportCards ?? []) as any[]
  }, [user])

  const { data: bulletins, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<any[]>(cacheKey, fetchFn)

  const downloadPdf = async (id: string, label: string) => {
    if (!isOnline) { onToast(t('bulletins.toast_download_offline'), 'warning'); return }
    setDownloading(id)
    try {
      const res = await fetchApi(`/api/v2/report-cards/${id}/pdf`, { credentials: 'include' })
      if (!res.ok) { onToast(t('bulletins.toast_download_error'), 'error'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Bulletin_${label.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onToast(t('bulletins.toast_download_success'), 'success')
    } catch {
      onToast(t('bulletins.toast_download_error'), 'error')
    } finally {
      setDownloading(null)
    }
  }

  if (!user || loading) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (error) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button onClick={refetch}
            style={{ padding: '6px 13px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  const list = bulletins ?? []

  if (!list.length) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={sTitle}>{t('bulletins.title')}</div>
          <div style={sSub}>{t('bulletins.subtitle')}</div>
        </div>
        {fromCache && <CacheBadge cachedAt={cachedAt} />}
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1.5px solid var(--border)', padding: 36, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><ScrollText size={36} strokeWidth={2} /></div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('bulletins.empty_title')}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t('bulletins.empty_subtitle')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 6 : 12 }}>
        <div style={sTitle}>{t('bulletins.title')}</div>
        <div style={sSub}>{t('bulletins.subtitle')}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {list.map((b) => {
          const [mBg, mC] = MENTION_COLOR(b.mention)
          const avg = b.generalAverage
          const rankDisplay = b.rank ? `${b.rank}e` : '—'
          const totalDisplay = b.totalStudents || '—'
          return (
            <div key={b.id} className="rounded-xl border overflow-hidden shadow-xs" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div
                className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg,var(--sidebar),var(--sidebar2))' }}
              >
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 13.5, fontWeight: 700, color: 'white' }}>{b.academicPeriod?.name || t('bulletins.title')}</div>
                {b.mention && <span style={{ background: mBg, color: mC, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}>{b.mention}</span>}
              </div>
              <div className="p-3.5 sm:p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  <div className="rounded-lg p-2.5 text-center" style={{ background: 'var(--bg2)' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: NOTE_COLOR(avg) }}>{avg !== null ? avg.toFixed(1) : '—'}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 700, marginTop: 2 }}>{t('bulletins.average_label')}</div>
                  </div>
                  <div className="rounded-lg p-2.5 text-center" style={{ background: 'var(--bg2)' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>{rankDisplay}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 700, marginTop: 2 }}>{t('bulletins.rank_label').replace('{total}', String(totalDisplay))}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 h-10 sm:h-9 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-[0.99] border"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border2)',
                      color: 'var(--text)',
                    }}
                    onClick={() => {
                      const studentName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Élève'
                      setSelectedBulletin({
                        ...b,
                        studentName,
                        schoolName: schoolInfo?.name,
                        schoolLogoUrl: schoolInfo?.logoUrl,
                      })
                    }}
                  >
                    <Eye size={14} strokeWidth={2} />
                    Consulter
                  </button>

                  <button
                    title={!isOnline ? t('bulletins.toast_download_offline') : undefined}
                    className="flex-1 h-10 sm:h-9 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-[0.99] border-0"
                    style={{
                      background: isOnline ? 'linear-gradient(135deg,var(--primary),var(--primary-hover))' : 'var(--border2)',
                      color: 'white',
                      opacity: downloading === b.id ? 0.7 : 1,
                    }}
                    onClick={() => downloadPdf(b.id, b.academicPeriod?.name || 'bulletin')}
                    disabled={downloading === b.id || !isOnline}
                  >
                    {!isOnline ? <><WifiOff size={13} strokeWidth={2} /> PDF indispo</> : downloading === b.id ? <><Loader2 size={13} strokeWidth={2} className="animate-spin" /> ...</> : <><Download size={13} strokeWidth={2} /> PDF</>}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <BulletinModalLight bulletin={selectedBulletin} onClose={() => setSelectedBulletin(null)} />
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
