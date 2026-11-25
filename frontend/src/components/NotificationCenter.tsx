'use client'

import { Bell, ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useNotificationCenter, type NotificationTypeFilter, type NotificationReadFilter } from '@/hooks/useNotificationCenter'
import { handleNotificationClick } from '@/lib/notificationNavigation'

const TYPE_FILTERS: NotificationTypeFilter[] = ['ALL', 'ACADEMIC', 'ATTENDANCE', 'COMMUNICATION', 'FINANCIAL', 'AI_ALERT', 'POSITIVE', 'SYSTEM']

function chipStyle(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }
}

export default function NotificationCenter({ onNav }: { onNav?: (section: string) => void } = {}) {
  const t = useT('common')
  const {
    notifications, pagination, loading, fromCache, cachedAt,
    typeFilter, setTypeFilter, readFilter, setReadFilter,
    page, setPage,
    markAsRead, markAllAsRead,
  } = useNotificationCenter()
  return (
    <div className="px-3.5 py-3 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4 max-w-7xl mx-auto font-nunito" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--border)]">
        <div>
          <h1 className="text-base sm:text-xl font-bold font-spectral" style={{ color: 'var(--text)' }}>
            {t('notificationCenter.title')}
          </h1>
          <p className="text-xs sm:text-sm font-medium mt-0.5" style={{ color: 'var(--text2)' }}>
            {t('notificationCenter.subtitle')}
          </p>
          {fromCache && cachedAt && (
            <div className="mt-2 text-[11px] sm:text-xs font-semibold px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5" style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', color: 'var(--amber)' }}>
              <Package size={13} strokeWidth={2} />
              <span>{t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}</span>
            </div>
          )}
        </div>
        <button onClick={() => markAllAsRead()} className="w-full sm:w-auto px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl cursor-pointer border-none transition-all hover:opacity-80 text-center" style={{ background: 'var(--surface2)', color: 'var(--text)' }}>
          {t('notifications.markAllRead')}
        </button>
      </div>

      {/* Filtres : Segmented control pour l'état de lecture + Puces défilables pour le type */}
      <div className="flex flex-col gap-2.5">
        {/* Volet 1 : Lues / Non lues / Toutes */}
        <div className="flex items-center bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)] shadow-xs w-full sm:w-fit">
          {(['ALL', 'UNREAD', 'READ'] as NotificationReadFilter[]).map((rf) => {
            const active = readFilter === rf
            return (
              <button
                key={rf}
                type="button"
                onClick={() => setReadFilter(rf)}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border-0 cursor-pointer ${
                  active
                    ? 'bg-[var(--sidebar)] text-white shadow-xs'
                    : 'bg-transparent text-[var(--text3)] hover:text-[var(--text2)]'
                }`}
              >
                {t(`notificationCenter.readFilter.${rf}`)}
              </button>
            )
          })}
        </div>

        {/* Volet 2 : Type de notification (défilement horizontal fluide sans jamais sortir de l'écran) */}
        <div className="w-full overflow-x-auto no-scrollbar flex items-center gap-1.5 py-0.5" style={{ scrollbarWidth: 'none' }}>
          {TYPE_FILTERS.map((tf) => {
            const active = typeFilter === tf
            return (
              <button
                key={tf}
                type="button"
                onClick={() => setTypeFilter(tf)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all border cursor-pointer ${
                  active
                    ? 'bg-[var(--sidebar)] text-white border-[var(--sidebar)] shadow-xs'
                    : 'bg-[var(--surface)] text-[var(--text2)] border-[var(--border)] hover:bg-[var(--bg2)]'
                }`}
              >
                {t(`notificationCenter.types.${tf}`)}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div className="py-10 text-center text-xs sm:text-sm font-medium" style={{ color: 'var(--text3)' }}>{t('notificationCenter.loading')}</div>
        ) : notifications.length === 0 ? (
          <div className="py-10 text-center text-xs sm:text-sm font-medium" style={{ color: 'var(--text3)' }}>{t('notifications.empty')}</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id}
              onClick={() => {
                handleNotificationClick(n, { markAsRead, onNav })
              }}
              className="p-3.5 sm:p-4 flex gap-3 items-start border-b border-[var(--bg2)] cursor-pointer transition-colors"
              style={{
                background: n.isRead ? 'transparent' : 'var(--bg2)',
              }}>
              <Bell size={17} className="mt-0.5 flex-shrink-0" style={{ color: n.isRead ? 'var(--text3)' : 'var(--sidebar)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <span className="text-[13.5px] sm:text-[14.5px] font-bold" style={{ color: 'var(--text)' }}>{n.title}</span>
                  <span className="text-[10.5px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                    {t(`notificationCenter.types.${n.type}`)}
                  </span>
                </div>
                <div className="text-xs sm:text-[13px] leading-relaxed" style={{ color: 'var(--text2)' }}>{n.body}</div>
                <div className="text-[11px] sm:text-xs mt-1.5 font-medium" style={{ color: 'var(--text3)' }}>
                  {new Date(n.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
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
