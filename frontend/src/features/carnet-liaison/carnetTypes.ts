export interface CarnetTemplateItem {
  id: string
  category: string
  titleFr: string
  titleEn: string
  requiresConfirmation: boolean
}

export interface LiaisonReadReceiptUi {
  id: string
  userId: string
  userName?: string
  userRole?: string
  readAt: string
}

export interface LiaisonResponseUi {
  id: string
  authorId: string
  authorName?: string
  authorRole?: string
  confirmed: boolean | null
  replyText: string | null
  createdAt: string
}

export interface LiaisonEntryUi {
  id: string
  studentId: string
  studentName?: string
  classId: string | null
  className?: string | null
  authorId: string
  authorRole: string
  authorName?: string
  category: string
  title: string
  content: string
  requiresConfirmation: boolean
  confirmationPrompt: string | null
  isUrgent: boolean
  createdAt: string
  readReceipts: LiaisonReadReceiptUi[]
  responses: LiaisonResponseUi[]
}

export interface UnifiedInboxItemUi {
  kind: 'ANNOUNCEMENT' | 'CARNET'
  id: string
  studentId: string | null
  studentName: string | null
  category: string
  title: string
  content: string
  authorName: string | null
  isUrgent: boolean
  isRead: boolean
  requiresConfirmation: boolean
  confirmedByMe: boolean | null
  createdAt: string
  carnetEntry?: LiaisonEntryUi
}

export interface CarnetClassOption {
  id: string
  name: string
}

export interface CarnetStudentOption {
  id: string
  name: string
}

export const CATEGORY_LABELS: Record<string, string> = {
  ALL: 'Toutes catégories',
  INFO: 'Information',
  ABSENCE: 'Absence',
  BEHAVIOR: 'Comportement',
  HOMEWORK: 'Devoirs',
  AUTHORIZATION: 'Autorisation',
  CONVOCATION: 'Convocation',
  HEALTH: 'Santé',
  PAYMENT_RECEIPT: 'Reçu paiement',
  PARENT_NOTE: 'Mot du parent',
}

