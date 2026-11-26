'use client'

import DelegationSupervisionBanner from './DelegationSupervisionBanner'
import PedagogieView from '@/features/pedagogie/PedagogieView'
import type { OnToast } from '@/features/pedagogie/types'
import type { AdminSection } from '../_types'

interface Props {
  onToast: OnToast
  onNav?: (section: AdminSection) => void
}

export default function SectionPedagogie({ onToast, onNav }: Props) {
  return (
    <PedagogieView
      onToast={onToast}
      headerExtra={
        <DelegationSupervisionBanner
          actorTitle="Animateur Pédagogique"
          domainLabel="Suivi Pédagogique & Avancement des Programmes"
          onNav={onNav}
        />
      }
    />
  )
}
