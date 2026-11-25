'use client'
import { useState, useEffect, useCallback } from 'react'
import { HandCoins, Upload, CheckCircle2, Download, Loader2, WifiOff } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { OfflineActionRefusedError } from '@/lib/offline/actionRegistry'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface Transaction {
  id: string
  type: 'COLLECTE' | 'DEPENSE'
  montant: number
  categorie: string | null
  description: string | null
  date: string
  valide: boolean
  justificatifUrl?: string | null
}

interface Solde {
  totalCollectes: number
  totalDepenses: number
  solde: number
  depensesEnAttenteDeJustificatifOuValidation: number
}

const EMPTY_FORM = { type: 'COLLECTE' as 'COLLECTE' | 'DEPENSE', montant: '', categorie: '', description: '' }

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

function chipStyle(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, borderRadius: 12, padding: '3px 9px', fontSize: 11.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }
}

export default function SectionAPEEStaff({ onToast }: Props) {
  const t = useT('staff')
  const [solde, setSolde] = useState<Solde | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [sending, setSending] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const { isOnline, addToQueue } = useSyncQueue()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rSolde, rTx] = await Promise.all([
        fetchApi('/api/v2/apee/solde', { credentials: 'include' }),
        fetchApi('/api/v2/apee/transactions', { credentials: 'include' }),
      ])
      const dSolde = await rSolde.json()
      const dTx = await rTx.json()
      if (dSolde.success) setSolde(dSolde.data)
      if (dTx.success) setTransactions(dTx.data)
    } catch { onToast(t('apee.toast.loadError'), 'error') }
    finally { setLoading(false) }
  }, [onToast, t])

  useEffect(() => { load() }, [load])

  // Rafraîchissement temps réel quand l'assistant IA enregistre/valide une transaction APEE.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'apeeTransaction') load()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [load])

  const submitTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    const montant = parseFloat(form.montant)
    if (!form.montant || isNaN(montant) || montant <= 0) { onToast(t('apee.toast.amountInvalid'), 'error'); return }

    const payload = { type: form.type, montant, categorie: form.categorie.trim() || undefined, description: form.description.trim() || undefined }

    if (!isOnline) {
      try {
        await addToQueue({ type: 'APEE_TRANSACTION', endpoint: '/api/v2/apee/transactions', method: 'POST', payload })
        onToast(t('apee.toast.createQueued'), 'success')
        setForm(EMPTY_FORM)
      } catch (err) {
        onToast(err instanceof OfflineActionRefusedError ? err.message : (err instanceof Error ? err.message : t('apee.toast.createError')), 'error')
      }
      return
    }

    setSending(true)
    try {
      const res = await fetchApi('/api/v2/apee/transactions', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      onToast(t('apee.toast.createSuccess'), 'success')
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('apee.toast.createError'), 'error')
    } finally { setSending(false) }
  }

  const uploadJustificatif = async (id: string, file: File) => {
    setUploadingId(id)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetchApi(`/api/v2/apee/transactions/${id}/justificatif`, { method: 'POST', credentials: 'include', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      onToast(t('apee.toast.uploadSuccess'), 'success')
      load()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('apee.toast.uploadError'), 'error')
    } finally { setUploadingId(null) }
  }

  const validerDepense = async (id: string) => {
    setValidatingId(id)
    try {
      const res = await fetchApi(`/api/v2/apee/transactions/${id}/valider`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      onToast(t('apee.toast.validateSuccess'), 'success')
      load()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('apee.toast.validateError'), 'error')
    } finally { setValidatingId(null) }
  }

  const downloadRapport = async () => {
    try {
      const r = await fetchApi('/api/v2/apee/rapport.pdf', { credentials: 'include' })
      if (!r.ok) throw new Error(t('apee.toast.reportError'))
      const blob = await r.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'rapport-apee.pdf'
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('apee.toast.reportError'), 'error')
    }
  }

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{t('apee.title')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 500, marginTop: 2 }}>{t('apee.subtitle')}</div>
        </div>
        <button onClick={downloadRapport} style={{ ...chipStyle('var(--bg2)', 'var(--text2)'), border: 'none', cursor: 'pointer' }}>
          <Download size={13} /> {t('apee.downloadReport')}
        </button>
      </div>

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '8px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={16} strokeWidth={2} /></span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>{t('apee.offlineHint')}</span>
        </div>
      )}

      {solde && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: t('apee.totalCollectes'), value: fmtCFA(solde.totalCollectes), color: 'var(--green)' },
            { label: t('apee.totalDepenses'), value: fmtCFA(solde.totalDepenses), color: 'var(--red)' },
            { label: t('apee.solde'), value: fmtCFA(solde.solde), color: 'var(--blue)' },
            { label: t('apee.enAttente'), value: String(solde.depensesEnAttenteDeJustificatifOuValidation), color: 'var(--amber)' },
          ].map((k) => (
            <div key={k.label} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{k.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: k.color, marginTop: 3 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 12 }}>
        <form onSubmit={submitTransaction} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9, height: 'fit-content' }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <HandCoins size={15} /> {t('apee.newTransaction')}
          </div>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'COLLECTE' | 'DEPENSE' })}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}>
            <option value="COLLECTE">{t('apee.typeCollecte')}</option>
            <option value="DEPENSE">{t('apee.typeDepense')}</option>
          </select>
          <input type="number" min="1" placeholder={t('apee.amountPlaceholder')} value={form.montant}
            onChange={(e) => setForm({ ...form, montant: e.target.value })}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }} />
          <input type="text" placeholder={t('apee.categoryPlaceholder')} value={form.categorie}
            onChange={(e) => setForm({ ...form, categorie: e.target.value })}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }} />
          <textarea placeholder={t('apee.descriptionPlaceholder')} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical', background: 'var(--surface)', color: 'var(--text)' }} />
          <button type="submit" disabled={sending}
            style={{ ...chipStyle('var(--green)', 'white'), border: 'none', cursor: sending ? 'default' : 'pointer', justifyContent: 'center', opacity: sending ? 0.7 : 1, padding: '6px 12px' }}>
            {sending ? <Loader2 size={13} className="animate-spin" /> : t('apee.submit')}
          </button>
        </form>

        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{t('apee.history')}</div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('apee.loading')}</div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('apee.noTransactions')}</div>
          ) : (
            <div>
              {transactions.map((tx) => (
                <div key={tx.id} style={{ padding: '9px 14px', borderBottom: '1px solid var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={chipStyle(tx.type === 'COLLECTE' ? 'var(--green-light)' : 'var(--red-light)', tx.type === 'COLLECTE' ? 'var(--green)' : 'var(--red)')}>
                        {tx.type === 'COLLECTE' ? t('apee.typeCollecte') : t('apee.typeDepense')}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{fmtCFA(tx.montant)}</span>
                      {tx.valide && <span style={chipStyle('var(--green-light)', 'var(--green)')}><CheckCircle2 size={11} /> {t('apee.validated')}</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
                      {tx.categorie || '—'} {tx.description ? `· ${tx.description}` : ''} · {new Date(tx.date).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  {tx.type === 'DEPENSE' && !tx.valide && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {!tx.justificatifUrl ? (
                        <label style={{ ...chipStyle('var(--blue-light)', 'var(--blue)'), cursor: 'pointer' }}>
                          {uploadingId === tx.id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} {t('apee.uploadJustificatif')}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadJustificatif(tx.id, f) }} />
                        </label>
                      ) : (
                        <button onClick={() => validerDepense(tx.id)} disabled={validatingId === tx.id}
                          style={{ ...chipStyle('var(--green-light)', 'var(--green)'), border: 'none', cursor: 'pointer' }}>
                          {validatingId === tx.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} {t('apee.validate')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
