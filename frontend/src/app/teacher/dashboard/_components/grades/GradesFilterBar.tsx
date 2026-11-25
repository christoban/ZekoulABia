'use client'
import { Target, AlertTriangle, CheckCircle2, X, Download, Upload, Loader2 } from 'lucide-react'
import {
  btnPrim,
  btnSec,
  filterSt,
  thSt,
  tdSt,
  type TeacherClassOption,
  type TeacherSubjectOption,
  type TeacherSequenceOption,
  type GradesImportResult,
  type TranslateFn,
} from './types'

interface Props {
  classes: TeacherClassOption[]
  subjects: TeacherSubjectOption[]
  sequences: TeacherSequenceOption[]
  selectedClass: string
  selectedSubject: string
  selectedSequence: string
  loading: boolean
  importing: boolean
  rosterLabel: string | null
  importResult: GradesImportResult | null
  onSelectClass: (v: string) => void
  onSelectSubject: (v: string) => void
  onSelectSequence: (v: string) => void
  onLoadGrades: () => void
  onDownloadTemplate: () => void
  onImportExcel: (file: File) => void
  onDismissImportResult: () => void
  t: TranslateFn
}

export default function GradesFilterBar({
  classes,
  subjects,
  sequences,
  selectedClass,
  selectedSubject,
  selectedSequence,
  loading,
  importing,
  rosterLabel,
  importResult,
  onSelectClass,
  onSelectSubject,
  onSelectSequence,
  onLoadGrades,
  onDownloadTemplate,
  onImportExcel,
  onDismissImportResult,
  t,
}: Props) {
  return (
    <>
      <div className="p-2.5 sm:p-3 border-b border-[var(--border)] flex flex-col sm:flex-row gap-2 sm:gap-2.5 items-stretch sm:items-center flex-wrap">
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-2.5 flex-1 items-center">
          <select
            className="w-full sm:w-auto h-9"
            style={filterSt}
            value={selectedClass}
            onChange={e => onSelectClass(e.target.value)}
          >
            <option value="">{t('grades_section.filter_class')}</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            className="w-full sm:w-auto h-9"
            style={filterSt}
            value={selectedSubject}
            onChange={e => onSelectSubject(e.target.value)}
          >
            <option value="">{t('grades_section.filter_subject')}</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select
            className="w-full sm:w-auto h-9"
            style={filterSt}
            value={selectedSequence}
            onChange={e => onSelectSequence(e.target.value)}
          >
            <option value="">{t('grades_section.filter_sequence')}</option>
            {sequences.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <button
            className="w-full sm:w-auto h-9 px-4 shrink-0 inline-flex items-center justify-center font-bold"
            style={btnPrim}
            onClick={onLoadGrades}
            disabled={loading}
          >
            {t('grades_section.load')}
          </button>
        </div>

        <div className="flex gap-2 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]">
          <button
            className="flex-1 sm:flex-initial h-8.5 px-2.5 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5"
            style={btnSec}
            onClick={onDownloadTemplate}
            title={t('grades_section.template_tooltip')}
          >
            <Download size={13} strokeWidth={2} />
            <span>{t('grades_section.download_template')}</span>
          </button>
          <label
            className="flex-1 sm:flex-initial h-8.5 px-2.5 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5"
            style={{ ...btnSec, cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1 }}
          >
            {importing ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <Upload size={13} strokeWidth={2} />}
            <span>{importing ? t('grades_section.import_loading') : t('grades_section.import_excel')}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              disabled={importing}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) { onImportExcel(file); e.target.value = '' }
              }}
            />
          </label>
        </div>
      </div>

      {rosterLabel && (
        <div style={{ background: 'var(--blue-light)', border: '1.5px solid var(--blue)', borderRadius: 8, padding: '8px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><Target size={15} strokeWidth={2} /></span>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--blue)' }}>{rosterLabel}</span>
        </div>
      )}

      {importResult && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: importResult.errors.length > 0 ? 8 : 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 13, color: importResult.errors.length > 0 ? 'var(--amber)' : 'var(--green)' }}>
              {importResult.errors.length > 0 ? <AlertTriangle size={14} strokeWidth={2} /> : <CheckCircle2 size={14} strokeWidth={2} />}
              {t('grades_section.toast_import_result').replace('{imported}', String(importResult.imported))}
              {importResult.errors.length > 0 && ` · ${t('grades_section.toast_import_errors').replace('{count}', String(importResult.errors.length))}`}
            </span>
            <button
              onClick={onDismissImportResult}
              style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
              <X size={15} strokeWidth={2} />
            </button>
          </div>
          {importResult.errors.length > 0 && (
            <div style={{ background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 7, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead>
                    <tr>
                      {[t('grades_section.import_table_line'), t('grades_section.import_table_matricule'), t('grades_section.import_table_error')].map(h => (
                        <th key={h} style={{ ...thSt, background: 'var(--red-light)', color: 'var(--red)', padding: '6px 10px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((e, i) => (
                      <tr key={i} style={{ borderTop: '1px solid rgba(220,38,38,0.1)' }}>
                        <td style={{ ...tdSt, color: 'var(--red)', fontWeight: 700, width: 50 }}>{e.line}</td>
                        <td style={{ ...tdSt, fontWeight: 700 }}>{e.matricule || '—'}</td>
                        <td style={{ ...tdSt, color: 'var(--red)' }}>{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
