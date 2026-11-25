'use client';
import React from 'react';
import { Check, Clock, AlertCircle } from 'lucide-react';

export type ConcoursStepStatus =
  | 'DRAFT'
  | 'REGISTRATION_OPEN'
  | 'SEATS_ASSIGNED'
  | 'IN_PROGRESS'
  | 'GRADING'
  | 'DELIBERATION'
  | 'PUBLISHED'
  | 'CLOSED'
  | 'RESULTS_PENDING';

interface StepDef {
  key: ConcoursStepStatus;
  label: string;
  shortDesc: string;
}

const STEPS: StepDef[] = [
  { key: 'DRAFT', label: 'Préparation', shortDesc: 'Configuration des épreuves & seuils' },
  { key: 'REGISTRATION_OPEN', label: 'Inscriptions', shortDesc: 'Guichet & import des candidats' },
  { key: 'SEATS_ASSIGNED', label: 'Salles & Convocations', shortDesc: 'Places & listes d\'émargement' },
  { key: 'IN_PROGRESS', label: 'Composition', shortDesc: 'Déroulement des épreuves' },
  { key: 'GRADING', label: 'Correction & Notes', shortDesc: 'Saisie anonymisée par épreuve' },
  { key: 'DELIBERATION', label: 'Délibération', shortDesc: 'Simulation de seuil & quotas' },
  { key: 'PUBLISHED', label: 'Résultats publiés', shortDesc: 'Consultation publique & affichage' },
  { key: 'CLOSED', label: 'Clôturé', shortDesc: 'Bascule vers les inscriptions' },
];

function getStepIndex(status: string): number {
  if (status === 'RESULTS_PENDING') return 4; // correspond à GRADING
  const idx = STEPS.findIndex(s => s.key === status);
  return idx !== -1 ? idx : 0;
}

interface Props {
  currentStatus: ConcoursStepStatus | string;
  onSelectStep?: (status: ConcoursStepStatus) => void;
}

export default function ConcoursLifecycleStepper({ currentStatus, onSelectStep }: Props) {
  const currentIndex = getStepIndex(currentStatus);

  return (
    <div style={{ width: '100%', marginBottom: 24, overflowX: 'auto', paddingBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 700, position: 'relative' }}>
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex || currentStatus === 'CLOSED';
          const isCurrent = idx === currentIndex && currentStatus !== 'CLOSED';
          const isUpcoming = idx > currentIndex && currentStatus !== 'CLOSED';

          let circleBg = 'var(--bg2)';
          let circleBorder = 'var(--border)';
          let circleColor = 'var(--text3)';

          if (isDone) {
            circleBg = 'var(--green)';
            circleBorder = 'var(--green)';
            circleColor = '#ffffff';
          } else if (isCurrent) {
            circleBg = 'var(--surface)';
            circleBorder = 'var(--accent, #2563eb)';
            circleColor = 'var(--accent, #2563eb)';
          }

          return (
            <React.Fragment key={step.key}>
              <div
                onClick={() => onSelectStep?.(step.key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  cursor: onSelectStep ? 'pointer' : 'default',
                  flex: 1,
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: circleBg,
                    border: `2px solid ${circleBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: circleColor,
                    fontWeight: 700,
                    fontSize: 12,
                    boxShadow: isCurrent ? '0 0 0 4px rgba(37, 99, 235, 0.15)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isDone ? <Check size={16} strokeWidth={3} /> : isCurrent ? <Clock size={16} /> : idx + 1}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: isCurrent ? 700 : isDone ? 600 : 500,
                    color: isCurrent ? 'var(--text)' : isDone ? 'var(--text)' : 'var(--text3)',
                    marginTop: 6,
                    lineHeight: 1.2,
                  }}
                >
                  {step.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text3)',
                    marginTop: 2,
                    maxWidth: 100,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={step.shortDesc}
                >
                  {step.shortDesc}
                </span>
              </div>

              {idx < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: idx < currentIndex ? 'var(--green)' : 'var(--border)',
                    marginBottom: 26,
                    zIndex: 1,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
