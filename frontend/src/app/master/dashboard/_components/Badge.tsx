import { cn } from '@/lib/utils'

type BadgeType = 'active' | 'pending' | 'approved' | 'suspended' | 'rejected' | 'draft'
  | 'plan-deco' | 'plan-std' | 'plan-prem'
  | 'event-success' | 'event-warning' | 'event-error' | 'event-info'

const STYLES: Record<BadgeType, string> = {
  draft:        'bg-slate-100 text-slate-500',
  pending:      'bg-amber-50 text-amber-800',
  approved:     'bg-blue-50 text-blue-800',
  active:       'bg-[#d1fae5] text-[#065f46]',
  suspended:    'bg-[#fee2e2] text-[#991b1b]',
  rejected:     'bg-[#1a1a1a] text-[#e5e5e5]',
  'plan-deco':  'bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]',
  'plan-std':   'bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe]',
  'plan-prem':  'bg-[#ede9fe] text-[#5b21b6] border border-[#ddd6fe]',
  'event-success': 'bg-[#f0fdf4] text-[#065f46] font-mono',
  'event-warning': 'bg-[#fef3c7] text-[#92400e] font-mono',
  'event-error':   'bg-[#fee2e2] text-[#991b1b] font-mono',
  'event-info':    'bg-[#dbeafe] text-[#1e40af] font-mono',
}

const HAS_DOT: BadgeType[] = ['draft','pending','approved','active','suspended','rejected']

export default function Badge({ type, children }: { type: BadgeType; children: React.ReactNode }) {
  const hasDot = HAS_DOT.includes(type)
  return (
    <span
      className={cn(STYLES[type] ?? 'bg-slate-100 text-slate-500')}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 8px', borderRadius: 12,
        fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
      }}
    >
      {hasDot && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: 'currentColor', opacity: 0.7 }} />
      )}
      {children}
    </span>
  )
}
