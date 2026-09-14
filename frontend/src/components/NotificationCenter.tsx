'use client'

import { Bell, ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useNotificationCenter, type NotificationTypeFilter, type NotificationReadFilter } from '@/hooks/useNotificationCenter'

const TYPE_FILTERS: NotificationTypeFilter[] = ['ALL', 'ACADEMIC', 'ATTENDANCE', 'COMMUNICATION', 'FINANCIAL', 'AI_ALERT', 'POSITIVE', 'SYSTEM']

function chipStyle(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, borderRadius: 20, padding: '5px 12px', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }
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
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{t('notificationCenter.title')}</div>
          <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 500, marginTop: 4 }}>{t('notificationCenter.subtitle')}</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <Package size={14} strokeWidth={2} /> {t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button onClick={() => markAllAsRead()} style={{ ...chipStyle('var(--bg2)', 'var(--text2)'), border: 'none', cursor: 'pointer' }}>
          {t('notifications.markAllRead')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as NotificationTypeFilter)}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}>
          {TYPE_FILTERS.map(tf => <option key={tf} value={tf}>{t(`notificationCenter.types.${tf}`)}</option>)}
        </select>
        <select value={readFilter} onChange={(e) => setReadFilter(e.target.value as NotificationReadFilter)}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="ALL">{t('notificationCenter.readFilter.ALL')}</option>
          <option value="UNREAD">{t('notificationCenter.readFilter.UNREAD')}</option>
          <option value="READ">{t('notificationCenter.readFilter.READ')}</option>
        </select>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>{t('notificationCenter.loading')}</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>{t('notifications.empty')}</div>
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
                padding: '14px 20px', display: 'flex', gap: 12, alignItems: 'flex-start',
                borderBottom: '1px solid var(--bg2)', cursor: 'pointer',
                background: n.isRead ? 'transparent' : 'var(--bg2)',
              }}>
              <Bell size={16} color="var(--text3)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: n.isRead ? 600 : 800, color: 'var(--text)' }}>{n.title}</span>
                  <span style={chipStyle('var(--bg2)', 'var(--text3)')}>{t(`notificationCenter.types.${n.type}`)}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>{n.body}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{new Date(n.createdAt).toLocaleString('fr-FR')}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 18 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ ...chipStyle('var(--bg2)', 'var(--text2)'), border: 'none', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)' }}>
            {t('notificationCenter.pageOf', { page: pagination.page, pages: pagination.pages })}
          </span>
          <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
            style={{ ...chipStyle('var(--bg2)', 'var(--text2)'), border: 'none', cursor: page >= pagination.pages ? 'default' : 'pointer', opacity: page >= pagination.pages ? 0.5 : 1 }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
