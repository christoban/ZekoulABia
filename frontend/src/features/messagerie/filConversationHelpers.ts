import type { ConversationSummary, DisplayMessage } from './types'

export interface RoleBadge {
  label: string
  bg: string
  color: string
}

export function nomAffiche(conversation: ConversationSummary | undefined, currentUserId: string): string {
  if (!conversation) return ''
  if (conversation.name) return conversation.name
  if (conversation.type === 'PRIVATE') {
    const autre = conversation.participants.find((p) => p.id !== currentUserId)
    return autre ? `${autre.firstName} ${autre.lastName}` : 'Conversation'
  }
  return 'Conversation'
}

export function initialesConv(conversation: ConversationSummary | undefined, currentUserId: string): string {
  if (!conversation) return '??'
  if (conversation.type === 'PRIVATE') {
    const autre = conversation.participants.find((p) => p.id !== currentUserId)
    if (!autre) return '??'
    return `${autre.firstName?.[0] ?? ''}${autre.lastName?.[0] ?? ''}`.toUpperCase()
  }
  return conversation.name?.[0]?.toUpperCase() ?? '#'
}

export function avatarColor(id: string): string {
  const colors = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #3b82f6, #06b6d4)',
    'linear-gradient(135deg,var(--primary),var(--primary-hover))',
    'linear-gradient(135deg, #f59e0b, #f97316)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'linear-gradient(135deg,var(--primary),var(--blue))',
    'linear-gradient(135deg, #f97316, #ef4444)',
  ]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function fusionnerMessages(serveur: DisplayMessage[], locaux: DisplayMessage[]): DisplayMessage[] {
  const map = new Map<string, DisplayMessage>()
  for (const m of serveur) map.set(m.id, { ...m, status: 'SENT' })
  for (const m of locaux) if (!map.has(m.id)) map.set(m.id, m)
  return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function formatHeureMessage(dateStr: string | number): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function groupParJour(messages: DisplayMessage[]): { date: string; messages: DisplayMessage[] }[] {
  const groupes: { date: string; messages: DisplayMessage[] }[] = []
  let dernierLabel = ''
  for (const msg of messages) {
    const d = new Date(msg.createdAt)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 3600 * 24))
    let label: string
    if (diff === 0) label = "Aujourd'hui"
    else if (diff === 1) label = 'Hier'
    else label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: numericYearOption() })

    if (label !== dernierLabel) {
      groupes.push({ date: label, messages: [msg] })
      dernierLabel = label
    } else {
      groupes[groupes.length - 1].messages.push(msg)
    }
  }
  return groupes
}

function numericYearOption(): 'numeric' {
  return 'numeric'
}

/** Libellé du rôle (avec staffTitle pour STAFF) */
export function roleLabel(role: string, staffTitle?: string | null): string {
  if (role === 'STAFF' && staffTitle) return staffTitle
  const labels: Record<string, string> = {
    ADMIN: 'Administrateur',
    STAFF: 'Personnel administratif',
    TEACHER: 'Enseignant',
    STUDENT: 'Élève',
    PARENT: 'Parent',
  }
  return labels[role] ?? role
}

export function getRoleBadge(role?: string, staffTitle?: string | null): RoleBadge | null {
  if (!role) return null
  const r = role.toUpperCase()
  if (r === 'TEACHER') {
    return { label: 'Enseignant', bg: 'rgba(59, 130, 246, 0.16)', color: 'var(--blue, #2563eb)' }
  }
  if (r === 'ADMIN') {
    return { label: 'Administration', bg: 'rgba(245, 158, 11, 0.16)', color: 'var(--amber, #d97706)' }
  }
  if (r === 'STAFF') {
    return { label: staffTitle || 'Personnel administratif', bg: 'rgba(234, 88, 12, 0.16)', color: '#ea580c' }
  }
  if (r === 'PARENT') {
    return { label: 'Parent', bg: 'rgba(139, 92, 246, 0.16)', color: '#8b5cf6' }
  }
  if (r === 'STUDENT') {
    return { label: 'Élève', bg: 'rgba(16, 185, 129, 0.16)', color: 'var(--green, #10b981)' }
  }
  return { label: role, bg: 'rgba(107, 114, 128, 0.16)', color: 'var(--text3)' }
}

