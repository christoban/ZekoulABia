'use client'
import { Construction } from 'lucide-react'

interface Props {
  title: string
  description?: string
}

export default function SectionPlaceholder({ title, description }: Props) {
  return (
    <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: 'var(--text3)' }}>
          <Construction size={28} strokeWidth={1.6} />
        </div>
        <div className="text-[18px] md:text-[16px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          {title}
        </div>
        {description && (
          <div className="text-[13px] md:text-[13px]" style={{ color: 'var(--text3)', lineHeight: 1.5 }}>
            {description}
          </div>
        )}
      </div>
    </div>
  )
}
