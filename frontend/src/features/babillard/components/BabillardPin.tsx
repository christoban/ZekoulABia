import React from 'react';

interface Props {
  color?: 'red' | 'orange' | 'green';
  size?: number;
}

export default function BabillardPin({ color = 'green', size = 26 }: Props) {
  const colorMap = {
    red: { fill: '#dc2626', stroke: '#991b1b', light: '#f87171' },
    orange: { fill: '#ea580c', stroke: '#9a3412', light: '#fb923c' },
    green: { fill: 'var(--primary)', stroke: 'var(--green2)', light: 'var(--green)' },
  };

  const { fill, stroke, light } = colorMap[color];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35))',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`pin-grad-${color}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={light} />
          <stop offset="55%" stopColor={fill} />
          <stop offset="100%" stopColor={stroke} />
        </radialGradient>
      </defs>
      {/* Tête de punaise */}
      <circle cx="16" cy="14" r="10" fill={`url(#pin-grad-${color})`} stroke={stroke} strokeWidth="1" />
      {/* Reflet lumineux */}
      <ellipse cx="13" cy="11" rx="3.5" ry="2" fill="#ffffff" opacity="0.65" />
      {/* Petit centre métallique */}
      <circle cx="16" cy="14" r="2.2" fill="#fef08a" opacity="0.8" />
    </svg>
  );
}
