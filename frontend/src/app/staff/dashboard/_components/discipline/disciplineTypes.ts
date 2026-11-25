import type React from 'react'

export interface StudentResult {
  id: string
  firstName: string
  lastName: string
}

export interface DisciplineRecord {
  id: string
  type: string
  reason: string
  status: string
  startDate: string | null
  endDate: string | null
  createdAt: string
  student: { id: string; firstName: string; lastName: string }
  decidedBy: { id: string; firstName: string; lastName: string }
}

export const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  WARNING_ORAL:        { bg: 'var(--amber-light)', color: 'var(--amber)' },
  WARNING_WRITTEN:     { bg: 'var(--amber-light)', color: 'var(--amber)' },
  TEMP_EXCLUSION:      { bg: 'var(--red-light)', color: 'var(--red)' },
  COUNCIL_DECISION:    { bg: 'var(--purple-light)', color: 'var(--purple)' },
  PERMANENT_EXCLUSION: { bg: 'var(--red-light)', color: 'var(--red)' },
}

export const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  ACTIVE:   { bg: 'var(--red-light)', color: 'var(--red)' },
  LIFTED:   { bg: 'var(--green-light)', color: 'var(--green)' },
  APPEALED: { bg: 'var(--blue-light)', color: 'var(--blue)' },
}

export interface FormState {
  open: boolean
  loading: boolean
  error: string
  studentSearch: string
  studentResults: StudentResult[]
  selectedStudent: StudentResult | null
  type: string
  reason: string
  startDate: string
  endDate: string
}

export const EMPTY_FORM: FormState = {
  open: false, loading: false, error: '',
  studentSearch: '', studentResults: [], selectedStudent: null,
  type: 'WARNING_ORAL', reason: '', startDate: '', endDate: '',
}

export const SEVERE_TYPES = ['COUNCIL_DECISION', 'PERMANENT_EXCLUSION']

export interface Composition {
  chefEtablissement: string
  censeur: string
  sg: string
  pp: string
  representantParents: string
  representantEleves: string
}

export interface CouncilSession {
  id: string
  motif: string
  composition: Composition
  parentNotifiedAt: string
  scheduledAt: string
  heldAt: string | null
  decision: string | null
  pv: string | null
  status: 'CONVOQUE' | 'TENU' | 'ANNULE'
  student: { id: string; firstName: string; lastName: string }
  presidedBy: { id: string; firstName: string; lastName: string }
}

export const EMPTY_COMPOSITION: Composition = {
  chefEtablissement: '', censeur: '', sg: '', pp: '', representantParents: '', representantEleves: '',
}

export interface ConvokeFormState {
  open: boolean
  loading: boolean
  error: string
  studentSearch: string
  studentResults: StudentResult[]
  selectedStudent: StudentResult | null
  motif: string
  scheduledAt: string
  composition: Composition
}

export const EMPTY_CONVOKE_FORM: ConvokeFormState = {
  open: false, loading: false, error: '',
  studentSearch: '', studentResults: [], selectedStudent: null,
  motif: '', scheduledAt: '', composition: EMPTY_COMPOSITION,
}

export interface TenirFormState {
  open: boolean
  loading: boolean
  error: string
  sessionId: string
  decision: string
  pv: string
  startDate: string
  endDate: string
}

export const EMPTY_TENIR_FORM: TenirFormState = {
  open: false, loading: false, error: '',
  sessionId: '', decision: 'COUNCIL_DECISION', pv: '', startDate: '', endDate: '',
}

export const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }
export const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
export const btnPrim: React.CSSProperties = { padding: '7px 15px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
export const btnSec: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
export const btnRetry: React.CSSProperties = { padding: '5px 12px', borderRadius: 6, background: 'var(--surface)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }
export const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
export const tabSt: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
export const tabActiveSt: React.CSSProperties = { ...tabSt, background: 'var(--green)', color: 'white', border: '1px solid var(--green)' }
export const inputSt: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: 'var(--text)', outline: 'none', background: 'var(--bg)', boxSizing: 'border-box' }
export const labelSt: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }
export const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }
export const tdSt: React.CSSProperties = { padding: '9px 12px', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
