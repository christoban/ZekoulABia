'use client'
import { ReactLenis } from 'lenis/react'
import type { ReactNode } from 'react'

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  return (
    <ReactLenis root options={{ duration: 1.1, smoothWheel: true }}>
      {children}
    </ReactLenis>
  )
}
