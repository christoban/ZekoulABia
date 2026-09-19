'use client'

import { Bell, ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useNotificationCenter, type NotificationTypeFilter, type NotificationReadFilter } from '@/hooks/useNotificationCenter'

const TYPE_FILTERS: NotificationTypeFilter[] = ['ALL', 'ACADEMIC', 'ATTENDANCE', 'COMMUNICATION', 'FINANCIAL', 'AI_ALERT', 'POSITIVE', 'SYSTEM']

function chipStyle(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }
}

export default function NotificationCenter() {
  const t = useT('common')
  const {
    notifications, pagination, loading, fromCache, cachedAt,
    typeFilter, setTypeFilter, readFilter, setReadFilter,
    page, setPage,
    markAsRead, markAllAsRead,
  } = useNotificationCenter()
  return (
    <div className="px-4 py-4 md:px-7 md:py-6 space-y-4 max-w-7xl mx-auto font-nunito" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <h1 className="text-[17px] md:text-[20px] font-bold font-spectral" style={{ color: 'var(--text)' }}>
            {t('notificationCenter.title')}
          </h1>
          <p className="text-xs md:text-[13px] font-medium mt-1" style={{ color: 'var(--text2)' }}>
            {t('notificationCenter.subtitle')}
          </p>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Package size={14} strokeWidth={2} /> {t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button onClick={() => markAllAsRead()} className="px-3.5 py-2 text-xs md:text-[13px] font-bold rounded-lg cursor-pointer border-none self-start sm:self-center transition-all hover:opacity-80" style={{ background: 'var(--surface2)', color: 'var(--text)' }}>
          {t('notifications.markAllRead')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as NotificationTypeFilter)}
          className="py-2 px-3.5 rounded-lg border text-xs md:text-[13px] font-semibold font-nunito focus:outline-none cursor-pointer"
          style={{ border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
          {TYPE_FILTERS.map(tf => <option key={tf} value={tf}>{t(`notificationCenter.types.${tf}`)}</option>)}
        </select>
        <select value={readFilter} onChange={(e) => setReadFilter(e.target.value as NotificationReadFilter)}
          className="py-2 px-3.5 rounded-lg border text-xs md:text-[13px] font-semibold font-nunito focus:outline-none cursor-pointer"
          style={{ border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="ALL">{t('notificationCenter.readFilter.ALL')}</option>
          <option value="UNREAD">{t('notificationCenter.readFilter.UNREAD')}</option>
          <option value="READ">{t('notificationCenter.readFilter.READ')}</option>
        </select>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--text3)', fontSize: 13.5 }}>{t('notificationCenter.loading')}</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--text3)', fontSize: 13.5 }}>{t('notifications.empty')}</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id}
              onClick={() => {
                if (!n.isRead) markAsRead(n.id)
                if (n.metadata && (n.metadata as any).action === 'OPEN_CLOTURE_MODAL') {
                  window.dispatchEvent(new CustomEvent('zekoulabia:open-cloture-modal', { detail: n.metadata }))
                }
              }}
              style={{
                padding: '13px 18px', display: 'flex', gap: 12, alignItems: 'flex-start',
                borderBottom: '1px solid var(--bg2)', cursor: 'pointer',
                background: n.isRead ? 'transparent' : 'var(--bg2)',
              }}>
              <Bell size={18} color="var(--text3)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14.5, fontWeight: n.isRead ? 600 : 800, color: 'var(--text)' }}>{n.title}</span>
                  <span style={chipStyle('var(--bg2)', 'var(--text3)')}>{t(`notificationCenter.types.${n.type}`)}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>{n.body}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{new Date(n.createdAt).toLocaleString('fr-FR')}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 18 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ ...chipStyle('var(--bg2)', 'var(--text2)'), padding: '5px 12px', border: 'none', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text3)' }}>
            {t('notificationCenter.pageOf', { page: pagination.page, pages: pagination.pages })}
          </span>
          <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
            style={{ ...chipStyle('var(--bg2)', 'var(--text2)'), padding: '5px 12px', border: 'none', cursor: page >= pagination.pages ? 'default' : 'pointer', opacity: page >= pagination.pages ? 0.5 : 1 }}>
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
