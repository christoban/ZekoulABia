'use client'

import {
  AlertTriangle,
  Camera,
  FileText,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  School,
  Search,
  Star,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
import { avatarColorFor, type RoleLabelStyle, type StudioStudent, type UserItem } from './types'
import { badge, btnSecSm, tdStyle, thStyle } from './UserSharedPrimitives'

interface UsersListViewProps {
  users: UserItem[]
  loading: boolean
  error: string | null
  search: string
  onSearchChange: (value: string) => void
  onSearch: () => void
  onRetry: () => void
  openDD: string | null
  setOpenDD: (id: string | null) => void
  onEdit: (user: UserItem) => void
  onStudio: (student: StudioStudent) => void
  onTransfer: (user: UserItem) => void
  onOpenDoc: (user: UserItem) => void
  onDelete: (userId: string) => void
}

interface ActionMenuItem {
  icon: LucideIcon
  label: string
  danger: boolean
  onClick: () => void
}

export default function UsersListView({
  users,
  loading,
  error,
  search,
  onSearchChange,
  onSearch,
  onRetry,
  openDD,
  setOpenDD,
  onEdit,
  onStudio,
  onTransfer,
  onOpenDoc,
  onDelete,
}: UsersListViewProps) {
  const t = useT('admin')

  const ROLE_LABEL: Record<string, RoleLabelStyle> = {
    ADMIN: { label: t('users.role_labels.ADMIN'), bg: 'var(--green-light)', color: 'var(--green)' },
    TEACHER: { label: t('users.role_labels.TEACHER'), bg: 'var(--blue-light)', color: 'var(--blue)' },
    STUDENT: { label: t('users.role_labels.STUDENT'), bg: 'var(--primary-light)', color: 'var(--primary)' },
    PARENT: { label: t('users.role_labels.PARENT'), bg: 'var(--amber-light)', color: 'var(--amber)' },
    STAFF: { label: t('users.role_labels.STAFF'), bg: 'var(--orange-light)', color: 'var(--orange)' },
  }

  const formatLastLogin = (dt: string | null): string => {
    if (!dt) return t('users.last_login.never')
    const d = new Date(dt)
    const now = new Date()
    const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000)
    if (diffH < 1) return t('users.last_login.today')
    if (diffH < 24) return t('users.last_login.time').replace('{time}', d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    if (diffH < 48) return t('users.last_login.yesterday_time').replace('{time}', d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  const buildMenuItems = (user: UserItem): ActionMenuItem[] => [
    {
      icon: Pencil,
      label: t('users.action_menu.edit'),
      danger: false,
      onClick: () => {
        setOpenDD(null)
        onEdit(user)
      },
    },
    ...(user.role === 'STUDENT'
      ? [
          {
            icon: Camera,
            label: 'Studio photo officiel',
            danger: false,
            onClick: () => {
              setOpenDD(null)
              onStudio({
                id: user.studentProfile?.id || user.id,
                name: `${user.firstName} ${user.lastName}`,
                matricule: user.studentProfile?.matricule,
                photoUrl: user.studentProfile?.photoUrl,
              })
            },
          },
          {
            icon: RefreshCw,
            label: t('users.action_menu.change_class'),
            danger: false,
            onClick: () => {
              setOpenDD(null)
              onTransfer(user)
            },
          },
          {
            icon: FileText,
            label: t('users.action_menu.generate_doc'),
            danger: false,
            onClick: () => {
              setOpenDD(null)
              onOpenDoc(user)
            },
          },
        ]
      : []),
    {
      icon: Trash2,
      label: t('users.action_menu.delete'),
      danger: true,
      onClick: () => {
        setOpenDD(null)
        onDelete(user.id)
      },
    },
  ]

  return (
    <div className="rounded-none md:rounded-[14px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]">
      <div className="p-0 mb-4 md:p-[10px] md:px-[16px] md:mb-0 md:border-b md:border-[var(--border)]" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div
          className="rounded-[14px] md:rounded-[8px] px-[12px] py-[8px] md:px-[12px] md:py-[6px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none bg-[var(--surface)] md:bg-[var(--bg2)]"
          style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 200 }}
        >
          <Search size={15} strokeWidth={2} color="var(--text3)" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()}
            placeholder={t('users.search_placeholder')}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, width: '100%', color: 'var(--text)' }}
          />
        </div>
        <button className="hidden md:inline-flex" style={{ ...btnSecSm, alignItems: 'center', gap: 6 }} onClick={onSearch}>
          <Search size={13} strokeWidth={2} /> Rechercher
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--red)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={15} strokeWidth={2} /> {error}
          </span>
          <button
            onClick={onRetry}
            style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
          >
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          {t('users.no_users')}
        </div>
      )}

      {!loading && !error && users.length > 0 && (
        <>
          {/* ── Cartes empilées — mobile ── */}
          <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
            {users.map((user) => {
              const rl = ROLE_LABEL[user.role] ?? { label: user.role, bg: 'var(--bg2)', color: 'var(--text2)' }
              const className = user.studentProfile?.class?.name ?? null
              const staffTitle = user.staffProfile?.title ?? null
              const ppClasses = user.classesProfessorPrincipal?.map((c: { name: string }) => c.name) ?? []
              const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
              const menuItems = buildMenuItems(user)
              return (
                <div key={user.id} className="rounded-[14px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 14, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 14, right: 14 }}>
                    <button
                      onClick={() => setOpenDD(openDD === user.id ? null : user.id)}
                      style={{ width: 36, height: 36, borderRadius: 18, background: 'none', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text3)' }}
                    >
                      <MoreHorizontal size={16} strokeWidth={2} />
                    </button>
                    {openDD === user.id && (
                      <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 180, zIndex: 100, overflow: 'hidden' }}>
                        {menuItems.map((item, j) => {
                          const ItemIcon: LucideIcon = item.icon
                          return (
                            <div
                              key={j}
                              onClick={item.onClick}
                              style={{ padding: '7px 11px', fontSize: 12.5, fontWeight: 600, color: item.danger ? 'var(--red)' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
                            >
                              <ItemIcon size={14} strokeWidth={2} /> {item.label}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div className="w-[36px] h-[36px] rounded-[10px] text-[13px] font-bold flex-shrink-0 overflow-hidden relative" style={{ background: avatarColorFor(user.id), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {user.studentProfile?.photoUrl || user.avatarUrl ? (
                        <img
                          src={user.studentProfile?.photoUrl || user.avatarUrl!}
                          alt={`${user.firstName} ${user.lastName}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 30 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13.5 }}>{user.firstName} {user.lastName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email ?? '—'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={badge(rl.bg, rl.color)}>{rl.label}</span>
                    <span style={badge(user.isActive ? 'var(--green-light)' : 'var(--bg2)', user.isActive ? 'var(--green)' : 'var(--text2)')}>
                      {user.isActive ? t('users.i18n_ext.status.active') : t('users.i18n_ext.status.inactive')}
                    </span>
                    {className && <span style={badge('var(--bg2)', 'var(--text2)')}>{className}</span>}
                    {ppClasses.length > 0 && (
                      <span style={{ ...badge('var(--blue-light)', 'var(--blue)'), gap: 4 }}><School size={12} strokeWidth={2} /> PP {ppClasses[0]}</span>
                    )}
                    {staffTitle && (
                      staffTitle === 'Animateur Pédagogique'
                        ? <span style={{ ...badge('var(--green-light)', 'var(--green)'), gap: 4 }}><Star size={12} strokeWidth={2} /> AP</span>
                        : <span style={badge('var(--orange-light)', 'var(--orange)')}>{staffTitle}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bg2)' }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('users.i18n_ext.table.lastLogin')}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 700, marginTop: 2 }}>{formatLastLogin(user.lastLogin)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('users.i18n_ext.table.classTitle')}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500, marginTop: 2 }}>{className ?? staffTitle ?? (ppClasses[0] ? `PP ${ppClasses[0]}` : '—')}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Tableau — desktop ── */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  {[
                    t('users.i18n_ext.table.user'),
                    t('users.i18n_ext.table.role'),
                    t('users.i18n_ext.table.status'),
                    t('users.i18n_ext.table.lastLogin'),
                    t('users.i18n_ext.table.classTitle'),
                    t('users.i18n_ext.table.actions'),
                  ].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const rl = ROLE_LABEL[user.role] ?? { label: user.role, bg: 'var(--bg2)', color: 'var(--text2)' }
                  const className = user.studentProfile?.class?.name ?? null
                  const staffTitle = user.staffProfile?.title ?? null
                  const ppClasses = user.classesProfessorPrincipal?.map((c: { name: string }) => c.name) ?? []
                  const menuItems = buildMenuItems(user)
                  return (
                    <tr
                      key={user.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                    >
                      <td style={tdStyle}>
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-bold text-white relative shadow-2xs"
                            style={{ background: avatarColorFor(user.id) }}
                          >
                            {user.studentProfile?.photoUrl || user.avatarUrl ? (
                              <img
                                src={user.studentProfile?.photoUrl || user.avatarUrl!}
                                alt={`${user.firstName} ${user.lastName}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{user.firstName} {user.lastName}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>{user.email ?? '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}><span style={badge(rl.bg, rl.color)}>{rl.label}</span></td>
                      <td style={tdStyle}>
                        <span style={badge(user.isActive ? 'var(--green-light)' : 'var(--bg2)', user.isActive ? 'var(--green)' : 'var(--text2)')}>
                          {user.isActive ? t('users.i18n_ext.status.active') : t('users.i18n_ext.status.inactive')}
                        </span>
                      </td>
                      <td style={tdStyle}>{formatLastLogin(user.lastLogin)}</td>
                      <td style={tdStyle}>
                        {className ? <span style={badge('var(--bg2)', 'var(--text2)')}>{className}</span>
                          : ppClasses.length > 0
                            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <span style={{ ...badge('var(--blue-light)', 'var(--blue)'), gap: 4 }}><School size={12} strokeWidth={2} /> PP {ppClasses[0]}</span>
                                {staffTitle && (
                                  <span style={{ ...badge(staffTitle === 'Animateur Pédagogique' ? 'var(--green-light)' : 'var(--orange-light)', staffTitle === 'Animateur Pédagogique' ? 'var(--green)' : 'var(--orange)'), gap: 4 }}>
                                    {staffTitle === 'Animateur Pédagogique' ? <><Star size={12} strokeWidth={2} /> AP</> : staffTitle}
                                  </span>
                                )}
                              </div>
                          : (user.role === 'TEACHER' && staffTitle === 'Animateur Pédagogique')
                            ? <span style={{ ...badge('var(--green-light)', 'var(--green)'), gap: 4 }}><Star size={12} strokeWidth={2} /> AP</span>
                          : staffTitle ? <span style={badge('var(--orange-light)', 'var(--orange)')}>{staffTitle}</span>
                          : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            onClick={() => setOpenDD(openDD === user.id ? null : user.id)}
                            style={{ background: 'none', border: '1.5px solid var(--border2)', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', color: 'var(--text3)', transition: 'all 0.12s' }}
                            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)', background: 'var(--green-light)' })}
                            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text3)', background: 'none' })}
                          >
                            <MoreHorizontal size={15} strokeWidth={2} />
                          </button>
                          {openDD === user.id && (
                            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 180, zIndex: 100, overflow: 'hidden' }}>
                              {menuItems.map((item, j) => {
                                const ItemIcon: LucideIcon = item.icon
                                return (
                                  <div
                                    key={j}
                                    onClick={item.onClick}
                                    style={{ padding: '7px 11px', fontSize: 12.5, fontWeight: 600, color: item.danger ? 'var(--red)' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: 'background 0.1s' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = item.danger ? 'var(--red-light)' : 'var(--bg2)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                                  >
                                    <ItemIcon size={14} strokeWidth={2} /> {item.label}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
