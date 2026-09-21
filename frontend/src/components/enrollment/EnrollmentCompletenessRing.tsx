'use client'

import React from 'react'

interface Props {
  score: number // 0..100
  validableSousReserve?: boolean
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export default function EnrollmentCompletenessRing({
  score,
  validableSousReserve = false,
  size = 'md',
  showLabel = true,
}: Props) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)))

  const dimensions = {
    sm: { box: 28, radius: 10, stroke: 3, fontSize: '9px' },
    md: { box: 42, radius: 16, stroke: 4, fontSize: '11px' },
    lg: { box: 64, radius: 24, stroke: 5, fontSize: '15px' },
  }[size]

  const circumference = 2 * Math.PI * dimensions.radius
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference

  let strokeColor = 'var(--blue, #3b82f6)'
  let textColor = 'var(--text, #111827)'

  if (clampedScore === 100) {
    strokeColor = 'var(--green, #16a34a)'
  } else if (validableSousReserve || clampedScore >= 70) {
    strokeColor = '#d97706' // ambre
  } else if (clampedScore < 50) {
    strokeColor = 'var(--red, #ef4444)'
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
      title={`Complétude du dossier : ${clampedScore}% ${validableSousReserve ? '(Validable sous réserve)' : ''}`}
    >
      <div style={{ position: 'relative', width: dimensions.box, height: dimensions.box }}>
        <svg
          width={dimensions.box}
          height={dimensions.box}
          style={{ transform: 'rotate(-90deg)', display: 'block' }}
        >
          {/* Cercle d'arrière plan */}
          <circle
            cx={dimensions.box / 2}
            cy={dimensions.box / 2}
            r={dimensions.radius}
            fill="none"
            stroke="var(--border, #e5e7eb)"
            strokeWidth={dimensions.stroke}
          />
          {/* Cercle de progression */}
          <circle
            cx={dimensions.box / 2}
            cy={dimensions.box / 2}
            r={dimensions.radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={dimensions.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: dimensions.fontSize,
            fontWeight: 800,
            color: textColor,
          }}
        >
          {clampedScore}%
        </div>
      </div>

      {showLabel && validableSousReserve && clampedScore < 100 && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#b45309',
            background: 'rgba(245,158,11,0.12)',
            padding: '2px 7px',
            borderRadius: 6,
            border: '1px solid rgba(217,119,6,0.3)',
          }}
        >
          Sous réserve
        </span>
      )}
    </div>
  )
}
