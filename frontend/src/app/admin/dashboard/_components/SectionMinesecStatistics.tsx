'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import MinesecSupplementTab from './minesecStats/MinesecSupplementTab'
import MinesecGenererTab from './minesecStats/MinesecGenererTab'
import {
  btnPri,
  btnSec,
  type ChampManquant,
  type ChampNonResolu,
  type Meta,
  type Submission,
  type Supplement,
} from './minesecStats/types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionMinesecStatistics({ onToast }: Props) {
  const t = useT('admin')
  const [tab, setTab] = useState<'supplement' | 'generer'>('supplement')

  const [supplement, setSupplement] = useState<Supplement | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [form, setForm] = useState<Partial<Supplement>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [champsManquants, setChampsManquants] = useState<ChampManquant[]>([])
  const [champsNonResolus, setChampsNonResolus] = useState<ChampNonResolu[]>([])
  const [generating, setGenerating] = useState(false)
  const [lastSubmission, setLastSubmission] = useState<Submission | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Lire d'abord depuis IndexedDB
      const [cachedSup, cachedSub, cachedMeta] = await Promise.all([
        getCachedData<Supplement>('admin:minesec:supplement').catch(() => null),
        getCachedData<Submission[]>('admin:minesec:submissions').catch(() => null),
        getCachedData<Meta>('admin:minesec:meta').catch(() => null),
      ])
      if (cachedSup?.data) {
        setSupplement(cachedSup.data)
        setForm(cachedSup.data ?? {})
        setLoading(false)
      }
      if (cachedSub?.data) setSubmissions(cachedSub.data)
      if (cachedMeta?.data) setMeta(cachedMeta.data)

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setLoading(false)
        return
      }

      const [supRes, subRes, metaRes] = await Promise.all([
        fetchApi('/api/v2/statistical-campaign/supplement', { credentials: 'include' }),
        fetchApi('/api/v2/statistical-campaign/submissions', { credentials: 'include' }),
        fetchApi('/api/v2/statistical-campaign/meta', { credentials: 'include' }),
      ])
      const supData = await supRes.json()
      const subData = await subRes.json()
      const metaData = await metaRes.json()
      if (supData.success) {
        setSupplement(supData.data)
        setForm(supData.data ?? {})
        if (supData.data) putCachedData('admin:minesec:supplement', supData.data).catch(() => {})
      }
      if (subData.success) {
        setSubmissions(subData.data || [])
        if (subData.data) putCachedData('admin:minesec:submissions', subData.data).catch(() => {})
      }
      if (metaData.success) {
        setMeta(metaData.data)
        if (metaData.data) putCachedData('admin:minesec:meta', metaData.data).catch(() => {})
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const isNet = (typeof navigator !== 'undefined' && !navigator.onLine) ||
        msg.includes('fetch') ||
        msg.includes('Network')
      if (!isNet) {
        onToast(t('minesecStats.errorGeneric'), 'error')
      }
    } finally { setLoading(false) }
  }, [t, onToast])

  useEffect(() => { fetchAll() }, [fetchAll])

  const isStale = useMemo(() => {
    if (!supplement?.lastUpdatedAt) return false
    const days = (Date.now() - new Date(supplement.lastUpdatedAt).getTime()) / 86400000
    return days > 300 // ~10 mois — probablement de la campagne précédente
  }, [supplement])

  const saveSupplement = async () => {
    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/statistical-campaign/supplement', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('minesecStats.supplementSaved'), 'success')
        setSupplement(data.data)
        setChampsManquants([])
      } else onToast(data.message || t('minesecStats.errorGeneric'), 'error')
    } catch { onToast(t('minesecStats.errorGeneric'), 'error') } finally { setSaving(false) }
  }

  const genererDeclaration = async () => {
    setGenerating(true)
    setChampsManquants([])
    setChampsNonResolus([])
    try {
      const res = await fetchApi('/api/v2/statistical-campaign/generer', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!data.success) { onToast(data.message || t('minesecStats.errorGeneric'), 'error'); return }
      const result = data.data
      if (result.status === 'PENDING_MANUAL_DATA') {
        setChampsManquants(result.champsManquants)
        onToast(t('minesecStats.generationBlocked'), 'error')
        setTab('supplement')
      } else {
        setChampsNonResolus(result.champsNonResolus || [])
        setLastSubmission({ id: result.submissionId, status: result.status, generatedAt: new Date().toISOString(), filePath: result.filePath })
        onToast(t('minesecStats.generationSuccess'), 'success')
        fetchAll()
      }
    } catch { onToast(t('minesecStats.errorGeneric'), 'error') } finally { setGenerating(false) }
  }

  const downloadSubmission = (id: string) => {
    window.open(`/api/v2/statistical-campaign/submissions/${id}/download`, '_blank')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{t('common.loading') || '...'}</div>

  return (
    <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 14 }}>
        <h2 className="text-[15px] md:text-[17px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('minesecStats.title')}</h2>
        <p className="text-[11px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 2 }}>{t('minesecStats.subtitle')}</p>
      </div>

      <div className="gap-[6px] md:gap-[8px] mb-[12px] md:mb-[14px]" style={{ display: 'flex' }}>
        <button onClick={() => setTab('supplement')} className="flex-1 md:flex-none rounded-[8px] text-[11.5px] md:text-[12.5px] py-[6px] px-3 md:px-[16px]" style={{ ...(tab === 'supplement' ? btnPri : btnSec), padding: undefined }}>{t('minesecStats.tabSupplement')}</button>
        <button onClick={() => setTab('generer')} className="flex-1 md:flex-none rounded-[8px] text-[11.5px] md:text-[12.5px] py-[6px] px-3 md:px-[16px]" style={{ ...(tab === 'generer' ? btnPri : btnSec), padding: undefined }}>{t('minesecStats.tabGenerer')}</button>
      </div>

      {tab === 'supplement' && (
        <MinesecSupplementTab
          supplement={supplement}
          isStale={isStale}
          meta={meta}
          form={form}
          setForm={setForm}
          champsManquants={champsManquants}
          saving={saving}
          onSave={saveSupplement}
        />
      )}

      {tab === 'generer' && (
        <MinesecGenererTab
          generating={generating}
          lastSubmission={lastSubmission}
          champsNonResolus={champsNonResolus}
          submissions={submissions}
          onGenerer={genererDeclaration}
          onDownload={downloadSubmission}
        />
      )}
    </div>
  )
}
