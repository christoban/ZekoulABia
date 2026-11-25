import type { CSSProperties } from 'react'

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export interface Classe { id: string; name: string }
export interface Subject { id: string; name: string }
export interface Chapitre { id: string; titre: string; ordre: number; volumeHeuresPrevu: number }
export interface Programme { id: string; titre: string; chapitres: Chapitre[] }
export interface CahierEntry {
  id: string
  date: string
  contenuRealise: string | null
  contenuLibre?: string | null
  devoirsDonnes: string | null
  class: { id: string; name: string }
  subject: { id: string; name: string }
  chapitre: { id: string; titre: string; ordre: number } | null
}
export interface ScanResult {
  chapitreDetecte: string | null
  contenuRealise: string | null
  devoirsDonnes: string | null
  confidence: number
  error?: string
}
export interface PendingCahierPayload {
  _className?: string
  classId?: string
  _subjectName?: string
  subjectId?: string
  contenuRealise?: string
  contenuLibre?: string
  devoirsDonnes?: string
  date?: string
}

export type CahierTab = 'saisie' | 'historique'

export const SEL: CSSProperties = {
  width: '100%', minHeight: 36, padding: '6px 26px 6px 10px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: 'var(--text)',
  background: 'var(--surface)', outline: 'none', boxSizing: 'border-box', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238c6b45' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}

export const LBL: CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text2)',
  letterSpacing: '0.3px', marginBottom: 3, display: 'block',
}

export const AREA: CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--border)',
  fontSize: 13, fontWeight: 500, fontFamily: 'inherit', color: 'var(--text)',
  background: 'var(--surface)', outline: 'none', boxSizing: 'border-box', resize: 'vertical',
}
