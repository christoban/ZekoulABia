'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Book,
  AlertTriangle,
  Smartphone,
  Check,
  Circle,
  CreditCard,
  Search,
  WifiOff,
  RefreshCw,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  ExternalLink,
  Copy,
  Phone,
  Info,
} from 'lucide-react'
import type { Toast } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import { isExamClass, getExamLabel, isSchoolPrivate } from '@/lib/academicExamDetector'

interface Props {
  onToast: (msg: string, type?: Toast['type']) => void
  userId?: string
}

interface Child {
  studentId: string
  prenom: string
  nom: string
  classeNom?: string
  matricule?: string | null
}

interface Payment {
  id: string
  amount: number
  status: string
  paidAt: string | null
  method: string
  feeType?: string
  cautionStatus?: string
  refundedAt?: string | null
}

function getPaidAmount(payments: Payment[] = []): number {
  return (payments || [])
    .filter((p) => p.status === 'PAID' || p.status === 'SUCCESS' || p.status === 'COMPLETED')
    .reduce((s, p) => s + p.amount, 0)
}

interface Invoice {
  id: string
  amount: number
  currency: string
  status: string
  dueDate: string | null
  createdAt: string
  description: string | null
  student: { id: string; firstName: string; lastName: string }
  feePlan: { id: string; name: string; feeType: string; amount: number } | null
  payments: Payment[]
}

function invStatus(tf: (k: string) => string): Record<string, { bg: string; color: string; label: string }> {
  return {
    PENDING:   { bg: 'var(--amber-light)', color: 'var(--amber)', label: tf('invoice_status.PENDING') },
    PAID:      { bg: 'var(--green-light)', color: 'var(--green)', label: tf('invoice_status.PAID') },
    OVERDUE:   { bg: 'var(--red-light)', color: 'var(--red)', label: tf('invoice_status.OVERDUE') },
    CANCELLED: { bg: 'var(--bg2)', color: 'var(--text2)', label: tf('invoice_status.CANCELLED') },
    PARTIAL:   { bg: 'var(--blue-light)', color: 'var(--blue)', label: tf('invoice_status.PARTIAL') },
  }
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

function getDueDateInfo(dueDateStr: string | null, isPaid: boolean) {
  if (isPaid) return { status: 'PAID' as const, label: 'Facture soldée', color: 'var(--green)', bg: 'var(--green-light)' }
  if (!dueDateStr) return { status: 'NONE' as const, label: 'Délai standard', color: 'var(--text3)', bg: 'var(--bg2)' }

  const now = new Date()
  const due = new Date(dueDateStr)
  const diffTime = due.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const formattedDate = due.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

  if (diffDays < 0) {
    return {
      status: 'OVERDUE' as const,
      label: `En retard de ${Math.abs(diffDays)} j (${formattedDate})`,
      color: 'var(--red)',
      bg: 'var(--red-light)',
      urgent: true,
    }
  }
  if (diffDays <= 7) {
    return {
      status: 'URGENT' as const,
      label: `Échéance dans ${diffDays} j (${formattedDate})`,
      color: 'var(--amber)',
      bg: 'var(--amber-light)',
      urgent: true,
    }
  }
  return {
    status: 'NORMAL' as const,
    label: `Date limite : ${formattedDate}`,
    color: 'var(--blue)',
    bg: 'var(--blue-light)',
    urgent: false,
  }
}

export default function SectionParentPayments({ onToast, userId }: Props) {
  const t = useT('parent')
  const tf = useT('finance')
  const tc = useT('common')
  const isOnline = useOnlineStatus()

  const [childFilter, setChildFilter] = useState('')
  const [statusTab, setStatusTab] = useState<'ALL' | 'UNPAID' | 'URGENT' | 'PAID'>('ALL')
  const [guideOpen, setGuideOpen] = useState(false)
  const [schoolData, setSchoolData] = useState<{ ownership?: string; minesecSchoolCode?: string } | null>(null)

  // ── Modal paiement ──────────────────────────────────────────────────────────
  const [modal, setModal] = useState<{
    open: boolean
    invoiceId: string
    amount: number
    maxAmount: number
    label: string
    method: 'MTN_MOMO' | 'ORANGE_MONEY'
    phone: string
    loading: boolean
    error: string
  }>({
    open: false,
    invoiceId: '',
    amount: 0,
    maxAmount: 0,
    label: '',
    method: 'MTN_MOMO',
    phone: '',
    loading: false,
    error: '',
  })

  // 1. Récupération enfants (mis en cache)
  const childrenCacheKey = userId ? `parent:children:${userId}` : 'parent:children:default'
  const fetchChildrenFn = useCallback(async (): Promise<Child[]> => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' })
    const d = await res.json()
    if (!d.success) return []
    return (d.data || []).map((c: any) => ({
      studentId: c.studentId,
      prenom: c.prenom,
      nom: c.nom,
      classeNom: c.classeNom || '',
      matricule: c.matricule || null,
    }))
  }, [])
  const { data: cachedChildren } = useCachedFetch<Child[]>(childrenCacheKey, fetchChildrenFn)
  const children = cachedChildren ?? []

  // 2. Récupération factures (mis en cache)
  const invoicesCacheKey = userId
    ? `parent:invoices:${userId}:${childFilter || 'all'}`
    : `parent:invoices:default:${childFilter || 'all'}`

  const fetchInvoicesFn = useCallback(async (): Promise<Invoice[]> => {
    const params = new URLSearchParams({ limit: '50' })
    if (childFilter) params.set('studentId', childFilter)
    const res = await fetchApi(`/api/v2/parent/invoices?${params}`, { credentials: 'include' })
    const d = await res.json()
    if (!res.ok) throw new Error(d.message || tf('errors.server_error'))
    return d.data || []
  }, [childFilter, tf])

  const { data: cachedInvoices, loading, error, refetch: reloadInvoices } = useCachedFetch<Invoice[]>(
    invoicesCacheKey,
    fetchInvoicesFn
  )

  const [offlineFallbackInvoices, setOfflineFallbackInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    if (error === 'OFFLINE_NO_CACHE' && !cachedInvoices && userId) {
      if (childFilter) {
        getCachedData<Invoice[]>(`parent:invoices:${userId}:${childFilter}`).then((cached) => {
          if (cached?.data && Array.isArray(cached.data)) setOfflineFallbackInvoices(cached.data)
        }).catch(() => {})
      } else {
        Promise.all(
          children.map((c) => getCachedData<Invoice[]>(`parent:invoices:${userId}:${c.studentId}`))
        ).then((results) => {
          const merged: Invoice[] = []
          const seenIds = new Set<string>()
          for (const r of results) {
            if (r?.data && Array.isArray(r.data)) {
              for (const inv of r.data) {
                if (!seenIds.has(inv.id)) {
                  seenIds.add(inv.id)
                  merged.push(inv)
                }
              }
            }
          }
          if (merged.length > 0) {
            setOfflineFallbackInvoices(merged)
            putCachedData(`parent:invoices:${userId}:all`, merged).catch(() => {})
          }
        }).catch(() => {})
      }
    }
  }, [error, cachedInvoices, userId, childFilter, children])

  const invoices = cachedInvoices ?? (offlineFallbackInvoices.length > 0 ? offlineFallbackInvoices : [])

  // Rafraîchissement temps réel
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'payment') reloadInvoices()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [reloadInvoices])

  // Infos école (public vs privé + code MINESEC)
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetchApi('/api/v2/school/me', { credentials: 'include' })
        const d = await res.json()
        if (d?.data) {
          setSchoolData({
            ownership: d.data.ownership,
            minesecSchoolCode: d.data.minesecSchoolCode,
          })
        }
      } catch {
        /* silencieux */
      }
    })()
  }, [])

  // ── Logique intelligente MINESEC ───────────────────────────────────────────
  const isPrivate = isSchoolPrivate(schoolData?.ownership)
  const examChildren = useMemo(() => {
    return children.filter((c) => isExamClass(c.classeNom))
  }, [children])

  // Si établissement privé : afficher MINESEC UNIQUEMENT si au moins un enfant est en classe d'examen
  // Si établissement public : afficher MINESEC pour les inscriptions et examens
  const showMinesecSection = !isPrivate || examChildren.length > 0

  const handleCopy = (text: string, label: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    onToast(`${label} copié dans le presse-papier`, 'info')
  }

  const openModal = (inv: Invoice) => {
    if (!isOnline) {
      onToast(t('payments.offlineMessage'), 'warning')
      return
    }
    const paidAmt = getPaidAmount(inv.payments)
    const remaining = Math.max(0, inv.amount - paidAmt)
    setModal({
      open: true,
      invoiceId: inv.id,
      amount: remaining,
      maxAmount: remaining,
      label: inv.feePlan?.name ?? inv.description ?? 'Facture',
      method: 'MTN_MOMO',
      phone: '',
      loading: false,
      error: '',
    })
  }

  const submitPayment = async () => {
    if (!isOnline) {
      setModal((m) => ({ ...m, error: t('payments.offlineMessage') }))
      return
    }
    if (!modal.phone.trim()) {
      setModal((m) => ({ ...m, error: t('payments.phoneRequired') }))
      return
    }
    if (modal.amount <= 0 || modal.amount > modal.maxAmount) {
      setModal((m) => ({ ...m, error: `Montant invalide (maximum : ${fmtCFA(modal.maxAmount)})` }))
      return
    }
    setModal((m) => ({ ...m, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/parent/pay', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: modal.invoiceId,
          method: modal.method,
          phoneNumber: modal.phone,
          amount: modal.amount,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || tf('errors.generic_error'))
      onToast(t('payments.paymentInitiated'), 'success')
      setModal((m) => ({ ...m, open: false }))
      reloadInvoices()
    } catch (err) {
      setModal((m) => ({ ...m, error: err instanceof Error ? err.message : tf('errors.generic_error'), loading: false }))
    }
  }

  // Calculs synthétiques
  const unpaid = invoices.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE' || i.status === 'PARTIAL')
  const totalDu = unpaid.reduce((s, i) => {
    const paid = getPaidAmount(i.payments)
    return s + Math.max(0, i.amount - paid)
  }, 0)

  const urgentInvoices = unpaid.filter((i) => {
    const dueInfo = getDueDateInfo(i.dueDate, false)
    return dueInfo.status === 'OVERDUE' || dueInfo.status === 'URGENT'
  })

  // Filtrage selon l'onglet d'état
  const filteredInvoices = invoices.filter((inv) => {
    const paidAmt = getPaidAmount(inv.payments)
    const isPaid = inv.status === 'PAID' || paidAmt >= inv.amount

    if (statusTab === 'PAID') return isPaid
    if (statusTab === 'UNPAID') return !isPaid
    if (statusTab === 'URGENT') {
      if (isPaid) return false
      const dueInfo = getDueDateInfo(inv.dueDate, false)
      return dueInfo.status === 'OVERDUE' || dueInfo.status === 'URGENT'
    }
    return true
  })

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4 mb-2 sm:mb-3">
        <div>
          <div style={sTitle}>Factures & Règlements de Scolarité</div>
          <div style={sSub}>Consultez l&apos;ensemble de vos frais d&apos;établissement (APEE, scolarité, tranches) et délais</div>
        </div>
        <div className="flex items-center gap-2">
          {children.length > 0 && (
            <select
              value={childFilter}
              onChange={(e) => setChildFilter(e.target.value)}
              className="w-full sm:w-auto h-10 sm:h-9"
              style={sSelect}
            >
              <option value="">{t('payments.allChildren')}</option>
              {children.map((c) => (
                <option key={c.studentId} value={c.studentId}>
                  {c.prenom} {c.nom} {c.classeNom ? `(${c.classeNom})` : ''}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => reloadInvoices()}
            title="Rafraîchir"
            className="h-10 sm:h-9 px-3 rounded-lg border flex items-center justify-center cursor-pointer transition-colors"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Avertissement hors-ligne gracieux */}
      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <WifiOff size={18} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
            Mode hors-ligne : vous consultez vos factures et historiques en cache. Les règlements nécessitent une connexion active.
          </div>
        </div>
      )}

      {/* Alerte Échéances Imminentes ou Dépassées */}
      {urgentInvoices.length > 0 && (
        <div style={{ background: 'var(--red-light)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={20} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)' }}>
              Alerte échéance : {urgentInvoices.length} facture(s) arrivée(s) à date limite ou urgente(s)
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 2 }}>
              Veuillez régulariser ces règlements auprès de l&apos;intendance pour éviter tout blocage scolaire.
            </div>
          </div>
        </div>
      )}

      {/* Récapitulatif montant restant dû */}
      {unpaid.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div className="flex items-center gap-2.5">
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--amber-light)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>
                {unpaid.length} paiement(s) en attente
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                Scolarité, APEE et contributions d&apos;établissement
              </div>
            </div>
          </div>
          <div className="text-right">
            <span style={{ fontSize: 11, color: 'var(--text3)', display: 'block' }}>Reste total à régler</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--red)' }}>{fmtCFA(totalDu)}</span>
          </div>
        </div>
      )}

      {/* ── Volet MINESEC conditionnel (Riche & Documenté d'après sources officielles) ── */}
      {showMinesecSection && (
        <div style={{ background: 'var(--blue-light)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: 12, padding: '14px 16px' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2.5">
              <Book size={20} style={{ color: 'var(--blue)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--blue)' }}>
                  {isPrivate
                    ? "Guide Officiel MINESEC : Frais d'Examens d'État (cartescolaire.cm)"
                    : "Paiements Réglementaires MINESEC (Inscriptions & Examens d'État)"}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--blue)', marginTop: 2 }}>
                  {isPrivate ? (
                    <>
                      Établissement privé : Paiement obligatoire pour les examens d&apos;État (
                      {examChildren.map((c) => `${c.prenom} - ${getExamLabel(c.classeNom)}`).join(', ')})
                    </>
                  ) : (
                    "Conformément aux directives ministérielles, les frais d'inscription et d'examens publics s'effectuent via le guichet unique national."
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setGuideOpen((o) => !o)}
              className="h-8 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer self-start sm:self-auto shrink-0"
              style={{ background: 'var(--surface)', color: 'var(--blue)', borderColor: 'var(--blue)' }}
            >
              {guideOpen ? 'Masquer la procédure' : 'Voir la procédure détaillée'}
            </button>
          </div>

          {guideOpen && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(37,99,235,0.2)', fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }} className="space-y-4">
              
              {/* 1. Identification des enfants concernés et matricules */}
              <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)] mb-2 flex items-center gap-1.5">
                  <FileText size={12} /> Enfants & Matricules Nationaux nécessaires pour le guichet MINESEC
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {(isPrivate ? examChildren : children).map((c) => (
                    <div key={c.studentId} className="flex items-center justify-between p-2 rounded-md bg-[var(--bg2)] border border-[var(--border)]">
                      <div>
                        <span className="font-bold text-[var(--text)]">{c.prenom} {c.nom}</span>
                        <span className="text-[11px] text-[var(--text3)] block">{c.classeNom || 'Classe standard'} {isExamClass(c.classeNom) ? `· ${getExamLabel(c.classeNom)}` : ''}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[var(--primary)] text-[11.5px] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
                          {c.matricule || 'Matricule école'}
                        </span>
                        {c.matricule && (
                          <button
                            type="button"
                            onClick={() => handleCopy(c.matricule!, 'Matricule')}
                            title="Copier le matricule"
                            className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text3)] hover:text-[var(--text)] cursor-pointer border-0 bg-transparent"
                          >
                            <Copy size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Procédures pas-à-pas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Méthode A : En ligne sur cartescolaire.cm */}
                <div className="p-3.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-xs text-[var(--blue)] mb-2 flex items-center gap-1.5">
                      <CreditCard size={14} /> Méthode 1 : En ligne sur le portail officiel
                    </div>
                    <ol className="m-0 pl-4 space-y-1.5 text-xs text-[var(--text2)]">
                      <li>Accédez au portail national officiel <strong>cartescolaire.cm/pay-fees</strong>.</li>
                      <li>Sélectionnez le type d&apos;opération : {isPrivate ? "« Frais d'examen officiel » (BEPC, Probatoire, Baccalauréat)" : "« Frais de scolarité publique » ou « Frais d'examen »"}.</li>
                      <li>Saisissez le <strong>matricule national</strong> de l&apos;élève (affiché ci-dessus).</li>
                      <li>Choisissez votre opérateur de paiement (MTN MoMo, Orange Money, Express Union).</li>
                      <li>Validez la notification reçue sur votre téléphone en entrant votre code secret.</li>
                    </ol>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center gap-2">
                    <a
                      href="https://cartescolaire.cm/pay-fees"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-bold text-white no-underline transition-opacity hover:opacity-90"
                      style={{ background: 'var(--blue)' }}
                    >
                      <ExternalLink size={12} /> Accéder à cartescolaire.cm
                    </a>
                  </div>
                </div>

                {/* Méthode B : USSD Mobile direct sans connexion */}
                <div className="p-3.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-xs text-[var(--blue)] mb-2 flex items-center gap-1.5">
                      <Smartphone size={14} /> Méthode 2 : Directement par téléphone (USSD)
                    </div>
                    <div className="space-y-2 text-xs text-[var(--text2)]">
                      <div className="p-2 rounded bg-[var(--bg2)] border border-[var(--border)]">
                        <span className="font-bold text-[var(--text)] block mb-0.5">MTN Mobile Money :</span>
                        <span>Composez <strong className="font-mono text-[var(--primary)]">*126*007#</strong> &gt; Choisir <strong>MINESEC</strong> &gt; Saisir le matricule de l&apos;élève &gt; Confirmer avec le code PIN MoMo.</span>
                      </div>
                      <div className="p-2 rounded bg-[var(--bg2)] border border-[var(--border)]">
                        <span className="font-bold text-[var(--text)] block mb-0.5">Orange Money :</span>
                        <span>Composez <strong className="font-mono text-[var(--primary)]">#150*42#</strong> &gt; Choisir <strong>Paiement MINESEC</strong> &gt; Saisir le matricule de l&apos;élève &gt; Confirmer avec votre code secret OM.</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[var(--border)] text-[11px] text-[var(--text3)] flex items-center gap-1">
                    <Info size={12} /> Les SMS de confirmation contiennent votre ID de transaction officiel.
                  </div>
                </div>
              </div>

              {/* 3. Validation impérative & Quittance officielle */}
              <div className="p-3 rounded-lg bg-[var(--bg2)] border border-[var(--border)] flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-[var(--green)] shrink-0 mt-0.5" />
                <div className="text-xs text-[var(--text2)] leading-relaxed">
                  <strong className="text-[var(--text)] block mb-0.5">Quittance numérique officielle obligatoire (Délai 24h à 48h) :</strong>
                  Après votre paiement, attendez entre 24h et 48h pour la synchronisation ministérielle. Rendez-vous ensuite sur <a href="https://cartescolaire.cm/verify-payment" target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--blue)] underline">cartescolaire.cm/verify-payment</a> pour télécharger la quittance officielle munie d&apos;un QR Code certifié. Déposez-en une copie au secrétariat de l&apos;école pour finaliser l&apos;inscription.
                </div>
              </div>

              {/* 4. Assistance & Hotline officielle MINESEC */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[var(--text3)] pt-1">
                <div className="flex items-center gap-1.5">
                  <Phone size={13} />
                  <span>Assistance téléphonique MINESEC : <strong>+237 678 873 377</strong> / <strong>contact@cartescolaire.cm</strong></span>
                </div>
                <a
                  href="https://cartescolaire.cm/verify-payment"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[var(--blue)] hover:underline inline-flex items-center gap-1"
                >
                  <Search size={12} /> Vérifier une quittance
                </a>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ── Onglets de filtrage rapide des factures ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {[
          { id: 'ALL' as const, label: `Toutes (${invoices.length})` },
          { id: 'UNPAID' as const, label: `À régler (${unpaid.length})` },
          { id: 'URGENT' as const, label: `Urgentes / Échues (${urgentInvoices.length})` },
          { id: 'PAID' as const, label: `Soldées (${invoices.length - unpaid.length})` },
        ].map((tab) => {
          const active = statusTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id)}
              className="h-8 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer shrink-0"
              style={{
                background: active ? 'var(--sidebar)' : 'var(--surface)',
                color: active ? 'white' : 'var(--text2)',
                borderColor: active ? 'transparent' : 'var(--border)',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Liste des factures ── */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading && !invoices.length ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>
            Chargement des factures…
          </div>
        ) : error && !invoices.length ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--red)', fontWeight: 700, fontSize: 12.5 }}>
            {error}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
            <Smartphone size={38} className="mx-auto mb-2 text-[var(--text3)]" />
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Aucune facture trouvée dans cette vue</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Toutes vos obligations scolaires sont à jour pour ces critères.</div>
          </div>
        ) : (
          <>
            {/* Vue mobile : cartes tactiles riches */}
            <div className="md:hidden divide-y divide-[var(--border)]">
              {filteredInvoices.map((inv) => {
                const INV_STATUS = invStatus(tf)
                const st = INV_STATUS[inv.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: inv.status }
                const paid = getPaidAmount(inv.payments)
                const remaining = Math.max(0, inv.amount - paid)
                const isPaid = remaining === 0 || inv.status === 'PAID'
                const canPay = !isPaid
                const dueInfo = getDueDateInfo(inv.dueDate, isPaid)

                return (
                  <div key={inv.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[13px] font-bold text-[var(--text)]">
                          {inv.student.firstName} {inv.student.lastName}
                        </div>
                        <div className="text-[12px] font-semibold text-[var(--primary)] mt-0.5">
                          {inv.feePlan?.name ?? inv.description ?? 'Frais scolaires'}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 12,
                          fontSize: 10.5,
                          fontWeight: 700,
                          background: st.bg,
                          color: st.color,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {st.label}
                      </span>
                    </div>

                    {/* Badge d'échéance */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-2 py-0.5 rounded-md text-[10.5px] font-bold inline-flex items-center gap-1"
                        style={{ background: dueInfo.bg, color: dueInfo.color }}
                      >
                        <Clock size={10} />
                        {dueInfo.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-center text-xs">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[var(--text3)]">Total</div>
                        <div className="font-bold text-[var(--text)] mt-0.5">{fmtCFA(inv.amount)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[var(--text3)]">Réglé</div>
                        <div className="font-bold mt-0.5" style={{ color: paid > 0 ? 'var(--green)' : 'var(--text3)' }}>
                          {paid > 0 ? fmtCFA(paid) : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[var(--text3)]">Reste</div>
                        <div className="font-bold mt-0.5" style={{ color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>
                          {remaining > 0 ? fmtCFA(remaining) : 'Soldé'}
                        </div>
                      </div>
                    </div>

                    {canPay && (
                      <button
                        onClick={() => openModal(inv)}
                        disabled={!isOnline}
                        className="w-full h-9 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                          background: isOnline
                            ? 'linear-gradient(135deg,var(--primary),var(--primary-hover))'
                            : 'var(--border)',
                          color: isOnline ? 'white' : 'var(--text3)',
                        }}
                      >
                        <Smartphone size={13} />
                        {isOnline ? `Payer par Mobile Money (${fmtCFA(remaining)})` : 'Connexion requise pour payer'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Vue desktop : tableau complet avec colonne échéance */}
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead>
                  <tr>
                    {['Élève', 'Libellé de la facture', 'Montant', 'Réglé', 'Reste dû', 'Échéance / Délai', 'Statut', 'Actions'].map((h) => (
                      <th key={h} style={thSt}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => {
                    const INV_STATUS = invStatus(tf)
                    const st = INV_STATUS[inv.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: inv.status }
                    const paid = getPaidAmount(inv.payments)
                    const remaining = Math.max(0, inv.amount - paid)
                    const isPaid = remaining === 0 || inv.status === 'PAID'
                    const canPay = !isPaid
                    const dueInfo = getDueDateInfo(inv.dueDate, isPaid)

                    return (
                      <tr
                        key={inv.id}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg)')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--surface)')}
                      >
                        <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                          {inv.student.firstName} {inv.student.lastName}
                        </td>
                        <td style={{ ...tdSt, fontWeight: 600, color: 'var(--primary)' }}>
                          {inv.feePlan?.name ?? inv.description ?? 'Frais scolaires'}
                        </td>
                        <td style={{ ...tdSt, fontWeight: 700 }}>{fmtCFA(inv.amount)}</td>
                        <td style={tdSt}>
                          <span style={{ fontWeight: 700, color: paid > 0 ? 'var(--green)' : 'var(--text3)' }}>
                            {paid > 0 ? fmtCFA(paid) : '—'}
                          </span>
                        </td>
                        <td style={tdSt}>
                          <span style={{ fontWeight: 700, color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>
                            {remaining > 0 ? fmtCFA(remaining) : <Check size={14} strokeWidth={2.5} />}
                          </span>
                        </td>
                        <td style={tdSt}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background: dueInfo.bg,
                              color: dueInfo.color,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Clock size={11} />
                            {dueInfo.label}
                          </span>
                        </td>
                        <td style={tdSt}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              background: st.bg,
                              color: st.color,
                            }}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td style={tdSt}>
                          {canPay && (
                            <button
                              style={{
                                ...btnPay,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                opacity: isOnline ? 1 : 0.6,
                                cursor: isOnline ? 'pointer' : 'not-allowed',
                              }}
                              disabled={!isOnline}
                              onClick={() => openModal(inv)}
                            >
                              <Smartphone size={12} />
                              {isOnline ? 'Payer' : 'Connexion requise'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal paiement */}
      {modal.open && (
        <div
          onClick={() => !modal.loading && setModal((m) => ({ ...m, open: false }))}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="px-4 py-4 md:px-6 md:py-5"
            style={{ background: 'var(--surface)', borderRadius: 14, width: 420, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
          >
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Règlement Mobile Money
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{modal.label}</div>

            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Reste total dû</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{fmtCFA(modal.maxAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Montant à débiter</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min={100}
                    max={modal.maxAmount}
                    value={modal.amount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0
                      setModal((s) => ({ ...s, amount: Math.min(val, s.maxAmount) }))
                    }}
                    style={{
                      width: 130,
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 800,
                      textAlign: 'right',
                      border: '1.5px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--green)',
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>FCFA</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>Opérateur Mobile Money</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['MTN_MOMO', 'ORANGE_MONEY'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setModal((s) => ({ ...s, method: m }))}
                  className="h-10 sm:h-9"
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    border: '1.5px solid',
                    borderColor: modal.method === m ? 'var(--green)' : 'var(--border)',
                    background: modal.method === m ? 'var(--green-light)' : 'var(--surface)',
                    color: modal.method === m ? 'var(--green)' : 'var(--text3)',
                    transition: 'all 0.12s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Circle size={8} fill={m === 'MTN_MOMO' ? 'var(--amber)' : 'var(--orange)'} stroke="none" />
                  {m === 'MTN_MOMO' ? 'MTN MoMo' : 'Orange Money'}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>Numéro de débit Mobile Money</div>
            <input
              className="h-11 sm:h-9"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--border)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12, outline: 'none', background: 'var(--surface)', color: 'var(--text)' }}
              type="tel"
              placeholder="Ex: 677000000"
              value={modal.phone}
              onChange={(e) => setModal((m) => ({ ...m, phone: e.target.value }))}
            />

            {modal.error && (
              <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{modal.error}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setModal((m) => ({ ...m, open: false }))}
                disabled={modal.loading}
                className="h-11 sm:h-9"
                style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Annuler
              </button>
              <button
                onClick={submitPayment}
                disabled={modal.loading || !isOnline}
                className="h-11 sm:h-9"
                style={{
                  flex: 2,
                  padding: '7px 12px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
                  color: 'white',
                  border: 'none',
                  cursor: modal.loading ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: modal.loading || !isOnline ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {modal.loading ? 'Demande en cours…' : <><Smartphone size={13} strokeWidth={2} /> Confirmer le paiement</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
const sSelect: React.CSSProperties = { padding: '5px 10px', borderRadius: 8, fontSize: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer' }
const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '9px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
const btnPay: React.CSSProperties = { padding: '4px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
