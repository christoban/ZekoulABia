export type ConversationType = 'PRIVATE' | 'CLASS_CHANNEL' | 'PARENT_CHANNEL' | 'SYSTEM'

export interface ContactUser {
  id: string
  firstName: string
  lastName: string
  role: string
}

export interface ConversationSummary {
  id: string
  type: ConversationType
  name: string | null
  classId: string | null
  participants: ContactUser[]
  lastMessage: { id: string; content: string; createdAt: string; senderId: string } | null
  unreadCount: number
}

export interface DisplayMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string | number
  sender?: ContactUser
  moderationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
  moderationReason?: string | null
  status?: 'PENDING' | 'SENT' | 'FAILED'
  readStatuses?: { userId: string; readAt: string }[]
  isRead?: boolean
}

export interface CurrentUser {
  id: string
  role: string
}
