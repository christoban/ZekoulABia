'use client'

import {
  Calendar,
  GraduationCap,
  Layers,
  Coins,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import type { ReferentielsSummaryDto } from '../../_api'

interface Props {
  summary: ReferentielsSummaryDto | null
  onCreate: () => void
  onCreateUpcomingCalendar: () => void
}

/** Entête, bannière d'alerte rentrée et cartes KPI du hub Référentiels */
export default function ReferentielsSummaryHeader({ summary, onCreate, onCreateUpcomingCalendar }: Props) {
  return (
    <>
      {/* ── Entête Hub ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 220px' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'var(--amber-light)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
              flexShrink: 0,
            }}>
              <ShieldCheck size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 className="text-[18px] md:text-[20px]" style={{ fontFamily: 'var(--font-spectral), Spectral, serif', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                Référentiels Nationaux
              </h1>
              <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '2px 0 0' }}>
                Données ministérielles &amp; templates nationaux • Éditables sans redéploiement
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="hidden lg:inline-flex" style={{
              background: 'var(--green-light)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 8,
              padding: '6px 11px', fontSize: 11.5, fontWeight: 700, color: 'var(--green)',
              alignItems: 'center', gap: 6,
            }}>
              <CheckCircle size={14} />
              <span>Garde-fou : Local toujours gagnant</span>
            </div>
            <button
              type="button"
              onClick={onCreate}
              className="w-full sm:w-auto justify-center"
              style={{
                background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', borderRadius: 9,
                padding: '9px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', minHeight: 38,
                display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                boxShadow: '0 2px 8px rgba(142,42,58,0.18)',
              }}
            >
              <Plus size={15} />
              <span>Ajouter une entrée</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Alerte Proactive Annuelle (Rentrée approchante sans arrêté) ───────── */}
      {summary?.upcomingYearAlert && (
        <div style={{
          background: 'var(--amber-light)', border: '1px solid rgba(217, 119, 6, 0.35)', borderRadius: 12,
          padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 220px' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, background: 'rgba(217, 119, 6, 0.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)', flexShrink: 0,
            }}>
              <AlertTriangle size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--amber)' }}>
                Rappel Annuel : Arrêté ministériel attendu ({summary.nextAcademicYear})
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                {summary.alertMessage}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCreateUpcomingCalendar}
            className="w-full sm:w-auto justify-center"
            style={{
              background: 'var(--amber)', color: '#1c120c', border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36,
            }}
          >
            <Calendar size={14} />
            Saisir le calendrier {summary.nextAcademicYear}
          </button>
        </div>
      )}

      {/* ── Cartes KPI Synthèse (2x2 sur mobile, 4 colonnes sur desktop) ──────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3.5 mb-4">
        <div className="p-3 md:p-4" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.3px' }}>CALENDRIERS</span>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(59, 130, 246, 0.14)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Calendar size={14} />
            </div>
          </div>
          <div className="text-[20px] md:text-[22px]" style={{ fontWeight: 800, color: 'var(--text)', marginTop: 4, lineHeight: 1.1 }}>
            {summary?.counts.calendars ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} />
            <span className="truncate">{summary?.currentAcademicYear ?? '2026-2027'}</span>
          </div>
        </div>

        <div className="p-3 md:p-4" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.3px' }}>COEFFS BAC</span>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(236, 72, 153, 0.14)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <GraduationCap size={14} />
            </div>
          </div>
          <div className="text-[20px] md:text-[22px]" style={{ fontWeight: 800, color: 'var(--text)', marginTop: 4, lineHeight: 1.1 }}>
            {summary?.counts.bacCoefficients ?? '—'}
          </div>
          <div className="truncate" style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>
            Arrêté N° 92/22 (A1 à TI)
          </div>
        </div>

        <div className="p-3 md:p-4" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.3px' }}>MATIÈRES</span>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Layers size={14} />
            </div>
          </div>
          <div className="text-[20px] md:text-[22px]" style={{ fontWeight: 800, color: 'var(--text)', marginTop: 4, lineHeight: 1.1 }}>
            {summary?.counts.cycleSubjects ?? '—'}
          </div>
          <div className="truncate" style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>
            {summary?.counts.templates ?? 19} templates officiels
          </div>
        </div>

        <div className="p-3 md:p-4" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.3px' }}>TARIFS MINESEC</span>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--amber-light)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Coins size={14} />
            </div>
          </div>
          <div className="text-[20px] md:text-[22px]" style={{ fontWeight: 800, color: 'var(--text)', marginTop: 4, lineHeight: 1.1 }}>
            {summary?.counts.tarifs ?? '—'}
          </div>
          <div className="truncate" style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>
            Scolarité &amp; Examens
          </div>
        </div>
      </div>
    </>
  )
}
