'use client'

import { AppToast } from '@/components/shell/AppToast'
import type { Toast } from '../_types'

export default function ParentToast({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return <AppToast toasts={toasts} onRemove={onRemove} />
}
