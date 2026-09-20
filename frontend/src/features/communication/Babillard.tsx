'use client';

import React from 'react';
import { BabillardBoard } from '@/features/babillard/components/BabillardBoard';

interface BabillardProps {
  role?: string;
  currentUserId?: string;
  title?: string;
  subtitle?: string;
}

export default function Babillard({
  role = 'ADMIN',
  currentUserId,
  title,
  subtitle,
}: BabillardProps) {
  return (
    <div className="h-full w-full overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
      <BabillardBoard
        role={role}
        currentUserId={currentUserId}
        title={title}
        subtitle={subtitle}
      />
    </div>
  );
}