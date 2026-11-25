'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, FileText, Loader2, Copy, X, Download, Sparkles } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

export interface TemplatePreviewStatus {
  ready: boolean
  useMeasuredBulletinRenderer: boolean
  defaultTemplate: string
  defaultGroupingScheme: string
  activeSpec: {
    id: string
    version: number
    name: string
    familyKey: string
    language: string
    validationNotice: string | null
  }
  assignmentsCount: number
  hasIdentityKit: boolean
}

export interface ReprintTarget {
  id: string
  studentName: string
}

async function downloadClassBinaryExport(params: {
  url: string
  filename: string
  periodId?: string
  defaultError: string
}): Promise<void> {
  const { url, filename, periodId, defaultError } = params
  const res = await fetchApi(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(periodId ? { academicPeriodId: periodId } : {}),
  })
  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(errData.message || defaultError)
  }
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.click()
  URL.revokeObjectURL(objectUrl)
}

export async function downloadClassMergedPdf(params: {
  classId: string
  periodId?: string
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}): Promise<void> {
  await downloadClassBinaryExport({
    url: `/api/v2/report-cards/export-pdf/${params.classId}`,
    filename: `bulletins-classe-${params.classId}.pdf`,
    periodId: params.periodId,
    defaultError: 'Erreur lors de la génération du PDF de classe',
  })
  params.onToast('PDF complet de la classe téléchargé avec succès', 'success')
}

export async function downloadClassZipArchive(params: {
  classId: string
  periodId?: string
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}): Promise<void> {
  await downloadClassBinaryExport({
    url: `/api/v2/report-cards/export/${params.classId}`,
    filename: `bulletins-${params.classId}.zip`,
    periodId: params.periodId,
    defaultError: "Erreur lors de l'export du ZIP",
  })
  params.onToast('ZIP téléchargé avec succès', 'success')
}

export function SchoolOfficialTemplateBanner({
  onToast,
}: {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) {
  const [status, setStatus] = useState<TemplatePreviewStatus | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const pdfUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    fetchApi('/api/v2/report-cards/template-preview', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { success?: boolean; data?: TemplatePreviewStatus } | null) => {
        if (active && payload?.success && payload.data) {
          setStatus(payload.data)
        }
      })
      .catch(() => {})
    return () => {
      active = false
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
    }
  }, [])

  const openPreview = async () => {
    setModalOpen(true)
    setLoadingPdf(true)
    try {
      const res = await fetchApi('/api/v2/report-cards/template-preview?format=pdf', {
        credentials: 'include',
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(err.message || 'Impossible de générer l’aperçu du modèle')
      }
      const blob = await res.blob()
      const nextUrl = URL.createObjectURL(blob)
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
      pdfUrlRef.current = nextUrl
      setPdfUrl(nextUrl)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur aperçu modèle officiel', 'error')
      setModalOpen(false)
    } finally {
      setLoadingPdf(false)
    }
  }

  const closeModal = () => {
    setModalOpen(false)
  }

  if (!status) return null

  return (
    <>
      <div
        className="mb-3 p-3 rounded-[10px] border flex flex-wrap items-center justify-between gap-2.5"
        style={{
          background: 'var(--surface)',
          borderColor: status.ready ? 'rgba(22,163,74,0.28)' : 'rgba(217,119,6,0.28)',
        }}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className="p-2 rounded-lg flex-shrink-0"
            style={{
              background: status.ready ? 'var(--green-light)' : 'var(--amber-light)',
              color: status.ready ? 'var(--green)' : 'var(--amber)',
            }}
          >
            <Sparkles size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] font-extrabold" style={{ color: 'var(--text)' }}>
                Modèle officiel ZekoulABia : {status.activeSpec.name} ({status.activeSpec.id} v{status.activeSpec.version})
              </span>
              <span
                className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full"
                style={{
                  background: status.ready ? 'var(--green-light)' : 'var(--amber-light)',
                  color: status.ready ? 'var(--green)' : 'var(--amber)',
                }}
              >
                {status.ready ? 'Prêt · Calibré' : 'En cours de calibrage ZekoulABia'}
              </span>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Famille {status.activeSpec.familyKey} · Schéma {status.defaultGroupingScheme} · Langue {status.activeSpec.language}
              {' · '}Calibré en lecture seule par l&apos;équipe ZekoulABia Master
              {status.activeSpec.validationNotice ? ` — Note : ${status.activeSpec.validationNotice}` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openPreview}
          className="px-3 py-1.5 rounded-lg text-[12px] font-bold inline-flex items-center gap-1.5 flex-shrink-0"
          style={{
            background: 'var(--bg2)',
            color: 'var(--text)',
            border: '1px solid var(--border2)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Eye size={13} /> Prévisualiser le modèle officiel
        </button>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[2500] flex items-center justify-center p-3"
          style={{ background: 'rgba(15, 23, 42, 0.55)' }}
          onClick={closeModal}
        >
          <div
            className="w-full max-w-4xl h-[86vh] rounded-xl flex flex-col overflow-hidden shadow-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-4 py-3 flex items-center justify-between gap-2"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <div className="text-[14px] font-extrabold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <FileText size={16} /> Aperçu officiel — {status.activeSpec.name} (élève fictif)
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text3)' }}>
                  Spécimen généré avec des données fictives de démonstration ; aucune donnée élève réelle modifiée.
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    download={`modele-officiel-${status.activeSpec.id}.pdf`}
                    className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold inline-flex items-center gap-1 no-underline"
                    style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border2)' }}
                  >
                    <Download size={13} /> Télécharger
                  </a>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Fermer l’aperçu"
                  className="p-1.5 rounded-lg"
                  style={{ background: 'var(--bg2)', color: 'var(--text2)', border: 'none', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
              {loadingPdf ? (
                <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text2)' }}>
                  <Loader2 size={18} className="animate-spin" /> Génération du spécimen PDF…
                </div>
              ) : pdfUrl ? (
                <iframe title="Aperçu modèle officiel" src={pdfUrl} className="w-full h-full border-0" />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function ReprintDuplicateModal({
  target,
  onClose,
  onToast,
}: {
  target: ReprintTarget | null
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) {
  const [motif, setMotif] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (target) setMotif('')
  }, [target])

  if (!target) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = motif.trim()
    if (!cleaned) {
      onToast('Veuillez saisir un motif officiel pour rééditer ce duplicata.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetchApi(`/api/v2/report-cards/${target.id}/reprint`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motif: cleaned }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(err.message || 'Erreur lors de la réédition du duplicata')
      }
      const reprintCount = res.headers.get('X-Reprint-Count') ?? '?'
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `duplicata-${reprintCount}-${target.studentName.toLowerCase().replace(/\s+/g, '-')}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      onToast(`Duplicata n° ${reprintCount} émis et journalisé`, 'success')
      onClose()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur réédition duplicata', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2500] flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.55)' }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl p-5 shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-[14.5px] font-extrabold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Copy size={16} /> Émettre un duplicata officiel
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text2)', lineHeight: 1.45 }}>
          Élève : <strong>{target.studentName}</strong>. Le document généré portera le filigrane
          <strong> DUPLICATA</strong> et l&apos;opération sera enregistrée dans le journal d&apos;audit.
        </p>
        <label className="block text-[11.5px] font-bold mb-1.5" style={{ color: 'var(--text)' }}>
          Motif obligatoire (ex. perte originale parent, dossier bourse) *
        </label>
        <textarea
          rows={3}
          required
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Indiquez la raison de la réédition…"
          className="w-full rounded-lg p-2.5 text-[12.5px] mb-4 outline-none"
          style={{
            background: 'var(--bg2)',
            color: 'var(--text)',
            border: '1px solid var(--border2)',
            fontFamily: 'inherit',
          }}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[12px] font-bold"
            style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !motif.trim()}
            className="px-3.5 py-1.5 rounded-lg text-[12px] font-bold inline-flex items-center gap-1.5"
            style={{
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              cursor: submitting || !motif.trim() ? 'not-allowed' : 'pointer',
              opacity: submitting || !motif.trim() ? 0.6 : 1,
            }}
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
            Confirmer &amp; télécharger
          </button>
        </div>
      </form>
    </div>
  )
}
