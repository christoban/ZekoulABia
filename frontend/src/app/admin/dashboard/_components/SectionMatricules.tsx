'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { IdCard, Check, HelpCircle, X, AlertTriangle, ArrowLeftRight } from 'lucide-react'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface UnmatchedDetail { ligne: number; nom: string; prenom: string; raison: string }
interface FuzzyMatch {
  ligne: number; studentProfileId: string; userId: string
  nomFichier: string; prenomFichier: string; nomBase: string; prenomBase: string
  dateNaissance: string | null; matriculeNouveau: string
  similarityPercent: number
  status: 'PENDING' | 'CONFIRMED' | 'FLAGGED'
}

interface ImportJob {
  id: string; fileName: string; status: string
  totalRows: number; matchedRows: number; unmatchedRows: number; errorRows: number
  matchedRowsExact?: number; matchedRowsFuzzyConfirmed?: number; flaggedForCorrection?: number
  createdAt: string; processedAt: string | null
  // Ancien import (avant fuzzy matching) : tableau brut. Nouvel import : objet { unmatched, fuzzyMatches }.
  resultDetails: UnmatchedDetail[] | { unmatched: UnmatchedDetail[]; fuzzyMatches: FuzzyMatch[] } | null
}

const btnPri = { padding: '7px 15px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' as const }
const btnSec = { padding: '7px 15px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' as const }

function extractUnmatched(details: ImportJob['resultDetails']): UnmatchedDetail[] {
  if (!details) return []
  if (Array.isArray(details)) return details
  return details.unmatched ?? []
}
function extractFuzzy(details: ImportJob['resultDetails']): FuzzyMatch[] {
  if (!details || Array.isArray(details)) return []
  return details.fuzzyMatches ?? []
}

export default function SectionMatricules({ onToast }: Props) {
  const t = useT('admin')
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null)
  const [importing, setImporting] = useState(false)
  const [processingLigne, setProcessingLigne] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchApi('/api/v2/matricules/import-jobs/current', { credentials: 'include' })
      const data = await res.json()
      setJobs(data.data ?? [])
    } catch { /* empty */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    try {
      setImporting(true)
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetchApi('/api/v2/matricules/import', {
        method: 'POST', credentials: 'include', body: fd,
      })
      const data = await res.json()
      if (data.success) {
        const r = data.data
        onToast(
          t('matricules.import_summary_toast')
            .replace('{exact}', String(r.matchedExact ?? r.matched))
            .replace('{fuzzy}', String(r.fuzzyPending ?? 0))
            .replace('{unmatched}', String(r.unmatched))
            .replace('{errors}', String(r.errors)),
          r.unmatched > 0 || (r.fuzzyPending ?? 0) > 0 ? 'info' : 'success',
        )
        setSelectedJob({
          id: r.jobId, fileName: file.name, status: 'COMPLETED',
          totalRows: r.total, matchedRows: r.matched, unmatchedRows: r.unmatched, errorRows: r.errors,
          matchedRowsExact: r.matchedExact, matchedRowsFuzzyConfirmed: 0, flaggedForCorrection: 0,
          createdAt: new Date().toISOString(), processedAt: new Date().toISOString(),
          resultDetails: { unmatched: r.unmatchedDetails ?? [], fuzzyMatches: r.fuzzyMatches ?? [] },
        })
        loadJobs()
      } else {
        onToast(data.message || t('matricules.error_generic'), 'error')
      }
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setImporting(false) }
  }

  const viewJob = async (jobId: string) => {
    try {
      const res = await fetchApi(`/api/v2/matricules/import-jobs/${jobId}`, { credentials: 'include' })
      const data = await res.json()
      setSelectedJob(data.data ?? null)
    } catch { onToast(t('matricules.error_generic'), 'error') }
  }

  const confirmFuzzy = async (ligne: number) => {
    if (!selectedJob) return
    setProcessingLigne(ligne)
    try {
      const res = await fetchApi(`/api/v2/matricules/fuzzy-matches/${selectedJob.id}/${ligne}/confirm`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('matricules.fuzzy_confirmed_toast'), 'success')
        viewJob(selectedJob.id)
        loadJobs()
      } else onToast(data.message || t('matricules.error_generic'), 'error')
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setProcessingLigne(null) }
  }

  const flagFuzzy = async (ligne: number) => {
    if (!selectedJob) return
    setProcessingLigne(ligne)
    try {
      const res = await fetchApi(`/api/v2/matricules/fuzzy-matches/${selectedJob.id}/${ligne}/flag`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        onToast(data.data?.message || t('matricules.fuzzy_flagged_toast'), 'info')
        viewJob(selectedJob.id)
        loadJobs()
      } else onToast(data.message || t('matricules.error_generic'), 'error')
    } catch { onToast(t('matricules.error_generic'), 'error') } finally { setProcessingLigne(null) }
  }

  const unmatchedDetails = extractUnmatched(selectedJob?.resultDetails ?? null)
  const fuzzyMatches = extractFuzzy(selectedJob?.resultDetails ?? null).filter(f => f.status === 'PENDING')

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="mb-[14px] md:mb-[18px]">
        <h2 className="text-[16px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IdCard size={20} strokeWidth={2} /> {t('matricules.title')}
        </h2>
        <div className="text-xs md:text-[12.5px]" style={{ color: 'var(--text3)', marginTop: 2 }}>{t('matricules.subtitle')}</div>
      </div>

      {/* Import */}
      <div className="rounded-xl p-4 md:p-5 mb-4 md:mb-5 border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <h3 className="text-[14px] md:text-[15.5px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 7 }}>{t('matricules.import_title')}</h3>
        <p className="text-[12px] md:text-[12.5px]" style={{ color: 'var(--text2)', marginBottom: 14, lineHeight: 1.45 }}>
          {t('matricules.import_desc')}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()}
            className="text-xs md:text-[13px] py-2 md:py-2 px-3.5 rounded-lg"
            style={{ ...btnSec, flex: 1, textAlign: 'center' }}>{t('matricules.select_file')}</button>
          <button data-help-id="matricules-import-btn" onClick={handleImport} disabled={importing}
            className="text-xs md:text-[13px] py-2 md:py-2 px-3.5 rounded-lg"
            style={{ ...btnPri, flex: 1 }}>{importing ? '...' : t('matricules.start_import')}</button>
        </div>
      </div>

      {/* Historique */}
      <div className="rounded-xl p-3.5 md:p-4 border border-[var(--border)] bg-[var(--surface)]">
        <h3 className="text-[12.5px] md:text-[13.5px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 10, textTransform: 'uppercase' }}>{t('matricules.history')}</h3>
        {loading ? <p className="text-xs md:text-[13px]" style={{ color: 'var(--text2)' }}>{t('common.loading')}</p> : jobs.length === 0 ? (
          <p className="text-xs md:text-[13px]" style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('matricules.no_imports')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {jobs.map(j => {
              const pendingFuzzy = extractFuzzy(j.resultDetails).filter(f => f.status === 'PENDING').length
              return (
                <div key={j.id} className="flex-col md:flex-row items-start md:items-center rounded-lg p-2.5 md:px-3.5 md:py-2.5 border border-[var(--border)]" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7 }}>
                    <span className="text-[12.5px] md:text-[13.5px]" style={{ fontWeight: 600, color: 'var(--text)' }}>{j.fileName}</span>
                    <span className="text-xs" style={{ color: 'var(--text3)' }}>{new Date(j.createdAt).toLocaleDateString()}</span>
                    <span className="text-[10.5px] font-bold" style={{ padding: '2px 8px', borderRadius: 8, background: j.status === 'COMPLETED' ? 'rgba(22,163,74,0.12)' : 'var(--bg2)', color: j.status === 'COMPLETED' ? 'var(--green)' : 'var(--text2)' }}>{j.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3.5 }}><Check size={12} strokeWidth={2} /> {j.matchedRows}</span>
                    {pendingFuzzy > 0 && (
                      <span style={{ padding: '2px 7px', borderRadius: 8, fontWeight: 700, background: 'rgba(234,179,8,0.15)', color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: 3.5 }}>
                        <HelpCircle size={12} strokeWidth={2} /> {pendingFuzzy}
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3.5 }}><X size={12} strokeWidth={2} /> {j.unmatchedRows}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3.5 }}><AlertTriangle size={12} strokeWidth={2} /> {j.errorRows}</span>
                    <button onClick={() => viewJob(j.id)} className="text-xs md:text-[12.5px] px-3 py-1 rounded-md" style={{ ...btnSec }}>{t('matricules.view')}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Détail job sélectionné */}
      {selectedJob && (
        <div className="p-3.5 md:p-4.5 mt-4 border border-[var(--border)] rounded-xl" style={{ background: 'var(--surface)' }}>
          <div className="flex-wrap gap-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }}>
            <h3 className="text-[14px] md:text-[15.5px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('matricules.detail')} — {selectedJob.fileName}</h3>
            <button onClick={() => setSelectedJob(null)} className="text-xs md:text-[12.5px] px-3 py-1 rounded-lg" style={btnSec}>{t('common.close')}</button>
          </div>
          <div className="gap-2" style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 11 }}>
            <span className="text-xs md:text-[12.5px] px-3 py-0.5 rounded-full font-bold" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>{t('matricules.stat_total')} : {selectedJob.totalRows}</span>
            <span className="text-xs md:text-[12.5px] px-3 py-0.5 rounded-full font-bold" style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--green)' }}>{t('matricules.stat_matched')} : {selectedJob.matchedRows}</span>
            {fuzzyMatches.length > 0 && (
              <span className="text-xs md:text-[12.5px] px-3 py-0.5 rounded-full font-bold" style={{ background: 'rgba(234,179,8,0.15)', color: '#b45309' }}>{t('matricules.stat_fuzzy_pending')} : {fuzzyMatches.length}</span>
            )}
            <span className="text-xs md:text-[12.5px] px-3 py-0.5 rounded-full font-bold" style={{ background: 'rgba(234,179,8,0.12)', color: '#b45309' }}>{t('matricules.stat_unmatched')} : {selectedJob.unmatchedRows}</span>
            <span className="text-xs md:text-[12.5px] px-3 py-0.5 rounded-full font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}>{t('matricules.stat_errors')} : {selectedJob.errorRows}</span>
          </div>

          {/* Correspondances probables à confirmer */}
          {fuzzyMatches.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <h4 className="text-[12.5px] md:text-[13.5px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <HelpCircle size={15} strokeWidth={2} /> {t('matricules.fuzzy_section_title')}
              </h4>
              <p className="text-[11.5px] md:text-xs" style={{ color: 'var(--text3)', marginBottom: 9 }}>{t('matricules.fuzzy_section_desc')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {fuzzyMatches.map(f => (
                  <div key={f.ligne} className="rounded-lg p-3 md:px-3.5 md:py-2.5" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.3)' }}>
                    <div className="gap-2 mb-1.5" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div className="gap-3 md:gap-4" style={{ display: 'flex' }}>
                        <div>
                          <div className="text-[9.5px] md:text-[10.5px]" style={{ color: 'var(--text3)', fontWeight: 700, marginBottom: 1, textTransform: 'uppercase' }}>{t('matricules.fuzzy_base_label')}</div>
                          <div className="text-xs md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{f.nomBase} {f.prenomBase}</div>
                        </div>
                        <div style={{ color: 'var(--text3)', alignSelf: 'center', display: 'flex' }}><ArrowLeftRight size={13} strokeWidth={2} /></div>
                        <div>
                          <div className="text-[9.5px] md:text-[10.5px]" style={{ color: 'var(--text3)', fontWeight: 700, marginBottom: 1, textTransform: 'uppercase' }}>{t('matricules.fuzzy_file_label')}</div>
                          <div className="text-xs md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{f.nomFichier} {f.prenomFichier}</div>
                        </div>
                      </div>
                      <span className="text-[10.5px] md:text-[11px] px-2.5 py-0.5" style={{ borderRadius: 12, fontWeight: 700, background: '#b45309', color: '#fff' }}>
                        {f.similarityPercent}% {t('matricules.fuzzy_similarity_label')}
                      </span>
                    </div>
                    {f.dateNaissance && (
                      <div className="text-[11px] md:text-xs" style={{ color: 'var(--text3)', marginBottom: 7 }}>
                        {t('matricules.fuzzy_dob_label')} {f.dateNaissance}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 7 }}>
                      <button data-help-id="matricules-fuzzy-confirm-btn" onClick={() => confirmFuzzy(f.ligne)} disabled={processingLigne === f.ligne}
                        className="flex-1 md:flex-none justify-center text-xs md:text-[12.5px] py-1.5 px-3.5 rounded-lg"
                        style={{ ...btnPri, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Check size={12.5} strokeWidth={2} /> {t('matricules.fuzzy_confirm_btn')}
                      </button>
                      <button onClick={() => flagFuzzy(f.ligne)} disabled={processingLigne === f.ligne}
                        className="flex-1 md:flex-none justify-center text-xs md:text-[12.5px] py-1.5 px-3.5 rounded-lg"
                        style={{ ...btnSec, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12.5} strokeWidth={2} /> {t('matricules.fuzzy_flag_btn')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unmatchedDetails.length > 0 && (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 9px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('matricules.col_ligne')}</th>
                      <th style={{ textAlign: 'left', padding: '6px 9px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('matricules.col_nom')}</th>
                      <th style={{ textAlign: 'left', padding: '6px 9px', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>{t('matricules.col_raison')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedDetails.map((d, i) => (
                      <tr key={i}>
                        <td style={{ padding: '6px 9px', borderBottom: '1px solid var(--bg2)' }}>{d.ligne}</td>
                        <td style={{ padding: '6px 9px', borderBottom: '1px solid var(--bg2)' }}>{d.nom} {d.prenom}</td>
                        <td style={{ padding: '6px 9px', borderBottom: '1px solid var(--bg2)', color: d.raison.includes('Conflit') ? '#b45309' : 'var(--text2)' }}>{d.raison}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
