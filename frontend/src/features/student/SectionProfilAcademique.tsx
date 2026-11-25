'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { TrendingUp, TrendingDown, Minus, Award, AlertTriangle, BookOpen, Package } from 'lucide-react'

interface MatiereProfil {
  subjectId: string
  subjectName: string
  coefficient: number
  moyennesParPeriode: (number | null)[]
  moyenneAnnuelle: number
  classification: 'FORCE' | 'ACQUIS' | 'FAIBLE' | 'CRITIQUE'
  tendance: 'HAUSSE' | 'STABLE' | 'BAISSE'
}

interface ProfilData {
  studentFirstName: string
  studentLastName: string
  periodes: { periodId: string; nom: string; moyenneGenerale: number | null }[]
  matieres: MatiereProfil[]
  forces: string[]
  faiblesses: string[]
  moyenneGeneraleAnnuelle: number | null
}

interface Props {
  studentId: string
  academicYearId?: string
}

const CLASSIFICATION_STYLES: Record<string, { bg: string; color: string; labelKey: string }> = {
  FORCE: { bg: 'var(--green-light)', color: 'var(--green)', labelKey: 'academic.class_force' },
  ACQUIS: { bg: 'var(--blue-light)', color: 'var(--blue)', labelKey: 'academic.class_acquis' },
  FAIBLE: { bg: 'var(--amber-light)', color: 'var(--amber)', labelKey: 'academic.class_faible' },
  CRITIQUE: { bg: 'var(--red-light)', color: 'var(--red)', labelKey: 'academic.class_critique' },
}

export default function SectionProfilAcademique({ studentId, academicYearId }: Props) {
  const t = useT('student')
  const tcommon = useT('common')
  const [data, setData] = useState<ProfilData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [cachedAt, setCachedAt] = useState<number | null>(null)

  const charger = useCallback(async () => {
    if (!studentId) return
    setError(null)

    // 1. Stale-First : lecture instantanée depuis Dexie (< 30ms)
    let hasLocalData = false
    try {
      const cached = await getCachedData<ProfilData>(`student:academic-profile:${studentId}`)
      if (cached?.data) {
        setData(cached.data)
        setFromCache(true)
        setCachedAt(cached.cachedAt)
        setLoading(false)
        hasLocalData = true
      }
    } catch {
      // continuer vers le réseau
    }

    if (!hasLocalData) {
      setLoading(true)
    }

    // 2. Si hors-ligne
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!hasLocalData) {
        setError('OFFLINE_NO_CACHE')
      }
      setLoading(false)
      return
    }

    // 3. Revalidation réseau en tâche de fond si connecté
    try {
      const q = academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ''
      const res = await fetchApi(`/api/v2/students/${studentId}/academic-profile${q}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
        setFromCache(false)
        setCachedAt(Date.now())
        await putCachedData(`student:academic-profile:${studentId}`, json.data).catch(() => {})
      } else if (!hasLocalData) {
        setError(json.message || 'Erreur lors du chargement')
      }
    } catch {
      if (!hasLocalData) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setError('OFFLINE_NO_CACHE')
        } else {
          setError('Impossible de charger le profil académique')
        }
      }
    } finally {
      setLoading(false)
    }
  }, [studentId, academicYearId])

  useEffect(() => {
    charger()
  }, [charger])

  if (loading && !data) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>
        {t('academic.loading')}
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE' && !data) {
    return <OfflineEmptyState />
  }

  if (error && !data) {
    return (
      <div style={{ padding: 16, background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{error}</span>
        <button
          onClick={() => charger()}
          style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--surface)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}
        >
          {tcommon('retry') || 'Réessayer'}
        </button>
      </div>
    )
  }

  if (!data || data.matieres.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <BookOpen size={32} style={{ color: 'var(--text2)', marginBottom: 8 }} />
        <p style={{ color: 'var(--text2)', margin: 0, fontSize: 14 }}>{t('academic.empty')}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {fromCache && cachedAt && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }}>
          <Package size={13} strokeWidth={2} />
          <span>{tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}</span>
        </div>
      )}
      {/* En-tête : Moyenne générale annuelle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'var(--bg2)',
        borderRadius: 10,
        border: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text)' }}>
            {t('academic.title')}
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text2)' }}>
            {data.studentFirstName} {data.studentLastName}
          </p>
        </div>
        {data.moyenneGeneraleAnnuelle !== null && (
          <div style={{
            padding: '5px 12px',
            background: 'var(--blue-light)',
            color: 'var(--blue)',
            borderRadius: 7,
            fontWeight: 700,
            fontSize: 13.5,
          }}>
            {t('academic.annual_average')} : {data.moyenneGeneraleAnnuelle.toFixed(2)}
          </div>
        )}
      </div>

      {/* Forces et Faiblesses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {/* Points forts */}
        <div style={{
          padding: 12,
          background: 'var(--bg2)',
          borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--green)' }}>
            <Award size={15} />
            <strong style={{ fontSize: 13 }}>{t('academic.strengths')}</strong>
          </div>
          {data.forces.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text2)' }}>{t('academic.no_strengths')}</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {data.forces.map((f) => (
                <span
                  key={f}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'var(--green-light)',
                    color: 'var(--green)',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Points à améliorer */}
        <div style={{
          padding: 12,
          background: 'var(--bg2)',
          borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--red)' }}>
            <AlertTriangle size={15} />
            <strong style={{ fontSize: 13 }}>{t('academic.weaknesses')}</strong>
          </div>
          {data.faiblesses.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text2)' }}>{t('academic.no_weaknesses')}</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {data.faiblesses.map((w) => (
                <span
                  key={w}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'var(--red-light)',
                    color: 'var(--red)',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {w}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tableau détaillé des matières */}
      <div style={{
        background: 'var(--bg2)',
        borderRadius: 10,
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', color: 'var(--text2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{t('academic.subject')}</th>
                <th style={{ padding: '8px 10px', color: 'var(--text2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Coef</th>
                {data.periodes.map((p) => (
                  <th key={p.periodId} style={{ padding: '8px 10px', color: 'var(--text2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
                    {p.nom}
                  </th>
                ))}
                <th style={{ padding: '8px 10px', color: 'var(--text2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{t('academic.annual_avg_short')}</th>
                <th style={{ padding: '8px 10px', color: 'var(--text2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{t('academic.status')}</th>
                <th style={{ padding: '8px 12px', color: 'var(--text2)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{t('academic.trend')}</th>
              </tr>
            </thead>
            <tbody>
              {data.matieres.map((m) => {
                const style = CLASSIFICATION_STYLES[m.classification] || CLASSIFICATION_STYLES.ACQUIS
                return (
                  <tr key={m.subjectId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text)', fontSize: 12.5 }}>{m.subjectName}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text2)', fontSize: 12 }}>{m.coefficient}</td>
                    {m.moyennesParPeriode.map((avg, i) => (
                      <td key={i} style={{ padding: '8px 10px', color: avg !== null ? 'var(--text)' : 'var(--text2)', fontSize: 12 }}>
                        {avg !== null ? avg.toFixed(2) : '—'}
                      </td>
                    ))}
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text)', fontSize: 12.5 }}>
                      {m.moyenneAnnuelle.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: style.bg,
                        color: style.color,
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}>
                        {t(style.labelKey)}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {m.tendance === 'HAUSSE' && (
                        <span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5 }}>
                          <TrendingUp size={13} /> {t('academic.trend_up')}
                        </span>
                      )}
                      {m.tendance === 'BAISSE' && (
                        <span style={{ color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5 }}>
                          <TrendingDown size={13} /> {t('academic.trend_down')}
                        </span>
                      )}
                      {m.tendance === 'STABLE' && (
                        <span style={{ color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5 }}>
                          <Minus size={13} /> {t('academic.trend_stable')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
