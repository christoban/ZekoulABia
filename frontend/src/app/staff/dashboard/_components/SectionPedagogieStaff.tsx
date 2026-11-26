'use client'

import PedagogieView from '@/features/pedagogie/PedagogieView'
import type { OnToast } from '@/features/pedagogie/types'

interface Props {
  onToast: OnToast
}

export default function SectionPedagogieStaff({ onToast }: Props) {
  return <PedagogieView onToast={onToast} />
}
