'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useNotifications } from '@/hooks/NotificationContext'

interface Props {
  /** Pour le lien « Voir tout » du menu déroulant — navigue vers la section 'notifications',
   * identique sur les 5 dashboards. Omis : le lien reste caché (contexte sans navigation, ex. page publique). */
  onNav?: (section: string) => void
}

const MAX_DROPDOWN_ITEMS = 8

export default function NotificationBell({ onNav }: Props) {
  const t = useT('common')
  const { recentNotifications, unreadCount, hasSeen, markAsRead, markAllAsRead, registerSeen } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOpen = () => {
    setOpen(o => {
      const next = !o
      if (next) registerSeen()
      return next
    })
  }

  const attention = unreadCount > 0 && !hasSeen

  // Non lues d'abord (l'ordre de récence au sein de chaque groupe est déjà garanti par le tri
  // du backend), puis les 8 premières — le reste reste consultable via « Voir tout ».
  const dropdownItems = [...recentNotifications]
    .sort((a, b) => Number(a.isRead) - Number(b.isRead))
    .slice(0, MAX_DROPDOWN_ITEMS)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <style>{`
        @keyframes zek-bell-shake {
          0%, 34%, 100% { transform: rotate(0deg) scale(1); }
          3% { transform: rotate(-16deg) scale(1.1); }
          6% { transform: rotate(15deg) scale(1.1); }
          9% { transform: rotate(-13deg) scale(1.08); }
          12% { transform: rotate(12deg) scale(1.08); }
          15% { transform: rotate(-10deg) scale(1.06); }
          18% { transform: rotate(9deg) scale(1.06); }
          21% { transform: rotate(-6deg) scale(1.03); }
          24% { transform: rotate(5deg) scale(1.03); }
          27% { transform: rotate(-3deg) scale(1.01); }
          30% { transform: rotate(0deg) scale(1); }
        }
        @keyframes zek-bell-bg-pulse {
          0%, 100% { background: var(--red-light); border-color: var(--red); }
          50% { background: #fca5a5; border-color: #dc2626; }
        }
        @keyframes zek-bell-ping {
          0% { transform: scale(1); opacity: 0.55; }
          80%, 100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes zek-bell-dot-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.4); }
        }
        .zek-bell-active { animation: zek-bell-bg-pulse 1.4s ease-in-out infinite; }
        .zek-bell-active .zek-bell-icon { animation: zek-bell-shake 2.1s ease-in-out infinite; }
        .zek-bell-active .zek-bell-ping { animation: zek-bell-ping 1.4s cubic-bezier(0,0,0.4,1) infinite; }
        .zek-bell-active .zek-bell-dot { animation: zek-bell-dot-pulse 1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .zek-bell-active { animation: none !important; background: var(--red-light) !important; border-color: var(--red) !important; }
          .zek-bell-active .zek-bell-icon { animation: none !important; }
          .zek-bell-active .zek-bell-ping { animation: none !important; display: none !important; }
          .zek-bell-active .zek-bell-dot { animation: none !important; }
        }
      `}</style>

      <div
        onClick={toggleOpen}
        className={attention ? 'zek-bell-active' : undefined}
        style={{ width: 32, height: 32, borderRadius: 8, background: attention ? 'var(--red-light)' : 'var(--bg2)', border: `1px solid ${attention ? 'var(--red)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', transition: 'background 0.2s, border-color 0.2s' }}
      >
        {attention && (
          <span className="zek-bell-ping" style={{ position: 'absolute', inset: -3, borderRadius: 10, background: 'var(--red)', pointerEvents: 'none' }} />
        )}
        <Bell className="zek-bell-icon" size={15} color={attention ? '#b91c1c' : 'var(--text2)'} style={{ transformOrigin: '50% 15%', position: 'relative' }} />
        {unreadCount > 0 && (
          <div className="zek-bell-dot" style={{ position: 'absolute', top: 4, right: 4, minWidth: 14, height: 14, padding: '0 3px', background: 'var(--red)', borderRadius: 7, border: '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-lg)', zIndex: 1000, display: 'flex', flexDirection: 'column', maxHeight: 460 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <button onClick={() => markAllAsRead()} style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {dropdownItems.length === 0 ? (
              <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                {t('notifications.empty')}
              </div>
            ) : dropdownItems.map(n => (
              <div
                key={n.id}
                onClick={() => !n.isRead && markAsRead(n.id)}
                style={{
                  padding: '12px 18px', cursor: n.isRead ? 'default' : 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: n.isRead ? 'transparent' : 'var(--bg2)',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}
              >
                {!n.isRead && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', marginTop: 5, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.isRead ? 600 : 800, color: 'var(--text)' }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{n.body}</div>
                </div>
              </div>
            ))}
          </div>

          {onNav && (
            <button
              onClick={() => { setOpen(false); onNav('notifications') }}
              style={{ flexShrink: 0, padding: '11px 18px', background: 'none', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--green)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {t('notifications.viewAll')} <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
