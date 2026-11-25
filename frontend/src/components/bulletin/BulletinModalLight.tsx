'use client'

import React from 'react'
import ModalOverlay from '@/components/finance/ModalOverlay'
import { Printer, X, Award, User, BookOpen } from 'lucide-react'

export interface SubjectLineData {
  id: string
  subjectName: string
  coefficient: number
  seq1Score?: number | null
  seq2Score?: number | null
  seq3Score?: number | null
  seq4Score?: number | null
  seq5Score?: number | null
  seq6Score?: number | null
  compositionScore?: number | null
  subjectAverage?: number | null
  subjectRank?: number | null
  teacherComment?: string | null
}

export interface BulletinData {
  id: string
  generalAverage?: number | null
  rank?: number | null
  totalStudents?: number | null
  mention?: string | null
  absenceCount?: number
  classMasterComment?: string | null
  academicPeriod?: { name: string } | null
  academicYear?: { name: string } | null
  subjectLines?: SubjectLineData[]
  studentName?: string
  schoolName?: string
  schoolLogoUrl?: string | null
}

interface Props {
  bulletin: BulletinData | null
  onClose: () => void
}

const NOTE_COLOR = (n: number | null | undefined) => {
  if (n == null) return 'var(--text3)'
  if (n >= 14) return 'var(--green, #16a34a)'
  if (n >= 10) return 'var(--blue, #2563eb)'
  return 'var(--red, #dc2626)'
}

export default function BulletinModalLight({ bulletin, onClose }: Props) {
  if (!bulletin) return null

  const handlePrint = () => {
    window.print()
  }

  const periodName = bulletin.academicPeriod?.name || 'Période académique'
  const yearName = bulletin.academicYear?.name || ''
  const subjects = bulletin.subjectLines || []

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 700 }}>
        {/* Style d'impression dédié */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #bulletin-imprimable, #bulletin-imprimable * {
              visibility: visible;
            }
            #bulletin-imprimable {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 24px;
              background: white !important;
              color: black !important;
            }
            .no-print {
              display: none !important;
            }
          }
        ` }} />

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          type="button"
          className="no-print"
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            background: 'var(--bg2)',
            border: 'none',
            borderRadius: '50%',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text2)',
          }}
          aria-label="Fermer"
        >
          <X size={16} />
        </button>

        {/* Relevé de notes / bulletin */}
        <div
          id="bulletin-imprimable"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '20px',
            fontSize: 12,
            color: 'var(--text)',
          }}
        >
          {/* Entête */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {bulletin.schoolLogoUrl ? (
                <img src={bulletin.schoolLogoUrl} alt="Logo" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--primary)' }}>
                  {bulletin.schoolName ? bulletin.schoolName.slice(0, 2).toUpperCase() : 'ZK'}
                </div>
              )}
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{bulletin.schoolName || 'Établissement Scolaire'}</h2>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Année scolaire {yearName}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800, background: 'var(--primary-subtle)', color: 'var(--primary)' }}>
                {periodName}
              </span>
            </div>
          </div>

          {/* Encart élève */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={15} style={{ color: 'var(--text3)' }} />
              <span style={{ fontWeight: 800, fontSize: 13 }}>{bulletin.studentName || 'Élève'}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11.5 }}>
              <div>Absences : <strong>{bulletin.absenceCount || 0} h</strong></div>
              {bulletin.mention && <div>Mention : <strong>{bulletin.mention}</strong></div>}
            </div>
          </div>

          {/* Tableau des matières */}
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '6px 8px', fontWeight: 800 }}>Matière</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>Coef</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>Moyenne /20</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800 }}>Rang</th>
                  <th style={{ padding: '6px 8px', fontWeight: 800 }}>Appréciation Enseignant</th>
                </tr>
              </thead>
              <tbody>
                {subjects.length > 0 ? (
                  subjects.map((s, idx) => (
                    <tr key={s.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{s.subjectName}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{s.coefficient}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: NOTE_COLOR(s.subjectAverage) }}>
                        {s.subjectAverage != null ? s.subjectAverage.toFixed(2) : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        {s.subjectRank ? `${s.subjectRank}e` : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', color: 'var(--text2)', fontStyle: s.teacherComment ? 'normal' : 'italic' }}>
                        {s.teacherComment || '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)' }}>
                      Détail des matières en cours de consolidation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Synthèse générale */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: NOTE_COLOR(bulletin.generalAverage) }}>
                {bulletin.generalAverage != null ? bulletin.generalAverage.toFixed(2) : '—'} / 20
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 700, marginTop: 2 }}>Moyenne Générale</div>
            </div>
            <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                {bulletin.rank ? `${bulletin.rank}e` : '—'} {bulletin.totalStudents ? `/ ${bulletin.totalStudents}` : ''}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 700, marginTop: 2 }}>Rang dans la classe</div>
            </div>
            <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary)' }}>
                {bulletin.mention || '—'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 700, marginTop: 2 }}>Mention du conseil</div>
            </div>
          </div>

          {/* Appréciation globale */}
          {bulletin.classMasterComment && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>
                Avis du Professeur Principal / Chef d'établissement :
              </div>
              <div style={{ fontStyle: 'italic', fontSize: 12 }}>« {bulletin.classMasterComment} »</div>
            </div>
          )}

          <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 10 }}>
            Relevé de notes officiel ZekoulABia — Consultation hors-ligne & impression sécurisée
          </div>
        </div>

        {/* Boutons actions */}
        <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Printer size={16} />
            Imprimer / Enregistrer en PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--bg2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
