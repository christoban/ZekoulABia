'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ShieldAlert, RefreshCw, Search, Building2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  fetchPlatformSettings,
  updatePlatformSettings,
  fetchSuppressedOutboundMessages,
  type SuppressedOutboundMessageDto,
} from '../_api'
import type { MasterUserDto, SchoolDto } from '../_types'

interface Props {
  user: MasterUserDto | null
  schools?: SchoolDto[]
  onToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export default function SectionModeTest({ user, schools = [], onToast }: Props) {
  const t = useT('master')

  const isSuperAdmin = user?.role === 'super_admin'
  const hasGlobalSchoolView = isSuperAdmin || user?.role === 'platform_admin'
  const canManageSchools =
    hasGlobalSchoolView || user?.role === 'school_manager'

  const realSchools = useMemo(
    () =>
      schools.filter(
        (s) => s.subdomain !== 'system' && !s.subdomain.startsWith('fixture-'),
      ),
    [schools],
  )

  const [modeTest, setModeTest] = useState<boolean | null>(null)
  const [disabledSchoolIds, setDisabledSchoolIds] = useState<string[]>([])
  const [modeTestBusy, setModeTestBusy] = useState(false)
  const [schoolBusyId, setSchoolBusyId] = useState<string | null>(null)
  const [confirmDesactivation, setConfirmDesactivation] = useState(false)
  const [schoolSearch, setSchoolSearch] = useState('')
  const [filtreEcoleMessages, setFiltreEcoleMessages] = useState<string>('')
  const [messagesSupprimes, setMessagesSupprimes] = useState<SuppressedOutboundMessageDto[]>([])
  const [messagesSupprimesLoading, setMessagesSupprimesLoading] = useState(false)

  const chargerMessagesSupprimes = useCallback(async (schoolIdFilter?: string) => {
    if (!canManageSchools) return
    const effectiveFilter = hasGlobalSchoolView
      ? schoolIdFilter || null
      : schoolIdFilter || realSchools[0]?.id || null
    if (!hasGlobalSchoolView && !effectiveFilter) {
      setMessagesSupprimes([])
      return
    }
    setMessagesSupprimesLoading(true)
    try {
      const rows = await fetchSuppressedOutboundMessages(100, effectiveFilter)
      setMessagesSupprimes(rows)
    } catch {
      setMessagesSupprimes([])
    } finally {
      setMessagesSupprimesLoading(false)
    }
  }, [canManageSchools, hasGlobalSchoolView, realSchools])

  const chargerModeTest = useCallback(async () => {
    if (!canManageSchools) return
    try {
      const settings = await fetchPlatformSettings()
      setModeTest(settings.outboundMessagingEnabled)
      setDisabledSchoolIds(settings.disabledSchoolIds ?? [])
      await chargerMessagesSupprimes(filtreEcoleMessages)
    } catch {
      setModeTest(null)
    }
  }, [canManageSchools, chargerMessagesSupprimes, filtreEcoleMessages])

  useEffect(() => {
    if (!hasGlobalSchoolView && !filtreEcoleMessages && realSchools.length > 0) {
      setFiltreEcoleMessages(realSchools[0].id)
    }
  }, [hasGlobalSchoolView, filtreEcoleMessages, realSchools])

  useEffect(() => {
    void chargerModeTest()
  }, [chargerModeTest])

  const basculerModeTestGlobal = async (prochainEtat: boolean) => {
    if (!isSuperAdmin) return
    setModeTestBusy(true)
    try {
      const updated = await updatePlatformSettings(prochainEtat)
      setModeTest(updated.outboundMessagingEnabled)
      setDisabledSchoolIds(updated.disabledSchoolIds ?? disabledSchoolIds)
      setConfirmDesactivation(false)
      window.dispatchEvent(
        new CustomEvent('zekoulabia:mode-test-changed', {
          detail: { outboundMessagingEnabled: updated.outboundMessagingEnabled },
        })
      )
      onToast(
        updated.outboundMessagingEnabled
          ? t('mode_test.statut_actif')
          : t('mode_test.statut_inactif'),
        updated.outboundMessagingEnabled ? 'success' : 'warning'
      )
      await chargerMessagesSupprimes(filtreEcoleMessages)
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erreur lors du changement de mode test', 'error')
    } finally {
      setModeTestBusy(false)
    }
  }

  const basculerModeTestEcole = async (schoolId: string, schoolName: string, prochainEtatEnvoiActif: boolean) => {
    if (!canManageSchools) return
    setSchoolBusyId(schoolId)
    try {
      const updated = await updatePlatformSettings(prochainEtatEnvoiActif, schoolId)
      setModeTest(updated.outboundMessagingEnabled)
      setDisabledSchoolIds(updated.disabledSchoolIds ?? [])
      window.dispatchEvent(new CustomEvent('zekoulabia:mode-test-changed'))
      onToast(
        prochainEtatEnvoiActif
          ? `${schoolName} : ${t('mode_test.statut_actif')}`
          : `${schoolName} : ${t('mode_test.active_badge')}`,
        prochainEtatEnvoiActif ? 'success' : 'warning'
      )
      await chargerMessagesSupprimes(filtreEcoleMessages)
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erreur lors de la mise à jour de l’établissement', 'error')
    } finally {
      setSchoolBusyId(null)
    }
  }

  const schoolNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of realSchools) {
      map.set(s.id, s.name)
    }
    return map
  }, [realSchools])

  const filteredSchools = useMemo(() => {
    const q = schoolSearch.trim().toLowerCase()
    const list = !q
      ? realSchools
      : realSchools.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.subdomain.toLowerCase().includes(q) ||
            (s.city ?? '').toLowerCase().includes(q)
        )
    return [...list].sort((a, b) => {
      const aInTest = disabledSchoolIds.includes(a.id) ? 0 : 1
      const bInTest = disabledSchoolIds.includes(b.id) ? 0 : 1
      if (aInTest !== bInTest) return aInTest - bInTest
      return a.name.localeCompare(b.name, 'fr')
    })
  }, [realSchools, schoolSearch, disabledSchoolIds])

  if (!canManageSchools) {
    return (
      <div style={{ padding: 16 }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            color: 'var(--text2)',
            fontSize: 13,
          }}
        >
          {t('mode_test.restricted_access')}
        </div>
      </div>
    )
  }

  return (
    <div
      className="px-3.5 pt-3.5 pb-6 md:px-6 md:pt-5 md:pb-12"
      style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 className="text-[18px] md:text-[20px]" style={{ margin: 0, fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
                {t('mode_test.titre')}
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text3)' }}>
                {isSuperAdmin
                  ? t('mode_test.subtitle_super')
                  : t('mode_test.subtitle_operator')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void chargerModeTest()}
            aria-label={t('mode_test.rafraichir')}
            title={t('mode_test.rafraichir')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '7px 12px',
              minHeight: 38,
              minWidth: 38,
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">{t('mode_test.rafraichir')}</span>
          </button>
        </div>

        {/* 1. Carte Interrupteur Global Plateforme */}
        {modeTest !== null && (
          <div
            style={{
              background: modeTest ? 'var(--surface)' : 'var(--red-light)',
              border: `1.5px solid ${modeTest ? 'var(--border)' : 'var(--red)'}`,
              borderRadius: 12,
              padding: 'clamp(12px, 3.6vw, 18px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>{t('mode_test.global_title')}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: modeTest ? 'var(--green-light)' : 'var(--surface)',
                      color: modeTest ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {modeTest ? t('mode_test.statut_actif') : t('mode_test.statut_inactif')}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4 }}>
                  {modeTest ? t('mode_test.desc_actif') : t('mode_test.desc_inactif')}
                </div>
              </div>

              {isSuperAdmin ? (
                modeTest ? (
                  <button
                    type="button"
                    disabled={modeTestBusy}
                    onClick={() => setConfirmDesactivation(true)}
                    className="w-full sm:w-auto"
                    style={{
                      padding: '8px 14px',
                      minHeight: 38,
                      borderRadius: 9,
                      border: '1px solid var(--red)',
                      background: 'var(--surface)',
                      color: 'var(--red)',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: modeTestBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {t('mode_test.btn_desactiver')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={modeTestBusy}
                    onClick={() => void basculerModeTestGlobal(true)}
                    className="w-full sm:w-auto"
                    style={{
                      padding: '8px 14px',
                      minHeight: 38,
                      borderRadius: 9,
                      border: 'none',
                      background: 'var(--green)',
                      color: '#fff',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: modeTestBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {t('mode_test.btn_activer')}
                  </button>
                )
              ) : (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: 'var(--text2)',
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    padding: '6px 10px',
                    borderRadius: 8,
                  }}
                >
                  {/* Réservé au Fondateur (super_admin) */}
                  {t('mode_test.reserved_founder')}
                </span>
              )}
            </div>

            {/* Confirmation avant désactivation globale */}
            {confirmDesactivation && modeTest && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 10,
                  background: 'var(--red-light)',
                  border: '1px solid var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>
                  {t('mode_test.confirm_texte')}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={modeTestBusy}
                    onClick={() => setConfirmDesactivation(false)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 7,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t('mode_test.confirm_annuler')}
                  </button>
                  <button
                    type="button"
                    disabled={modeTestBusy}
                    onClick={() => void basculerModeTestGlobal(false)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 7,
                      border: 'none',
                      background: 'var(--red)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: modeTestBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {t('mode_test.confirm_oui')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Mode Test par Établissement */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 'clamp(12px, 3.6vw, 18px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Building2 size={16} />
                <span>{t('mode_test.per_school_title')}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: disabledSchoolIds.length > 0 ? 'var(--red-light)' : 'var(--bg2)',
                    color: disabledSchoolIds.length > 0 ? 'var(--red)' : 'var(--text2)',
                  }}
                >
                  {t('mode_test.per_school_badge', { count: disabledSchoolIds.length })}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4 }}>
                {t('mode_test.per_school_desc')}
              </div>
            </div>

            <div className="w-full sm:w-auto" style={{ position: 'relative', minWidth: 220 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input
                type="text"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder={t('mode_test.search_school')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 10px 8px 30px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg2)',
                  fontSize: 12.5,
                  color: 'var(--text)',
                }}
              />
            </div>
          </div>

          {filteredSchools.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '12px 0' }}>
              {t('mode_test.no_school')}
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredSchools.map((school) => {
                const ecoleEnModeTest = disabledSchoolIds.includes(school.id)
                const effectifEnModeTest = modeTest === false || ecoleEnModeTest
                const busy = schoolBusyId === school.id

                return (
                  <div
                    key={school.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${ecoleEnModeTest ? 'var(--red)' : 'var(--border)'}`,
                      background: ecoleEnModeTest ? 'var(--red-light)' : 'var(--bg)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 180, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{school.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>
                          ({school.subdomain})
                        </span>
                        {effectifEnModeTest && (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '1px 7px',
                              borderRadius: 999,
                              background: 'var(--surface)',
                              color: 'var(--red)',
                            }}
                          >
                            {modeTest === false ? t('mode_test.via_global') : t('mode_test.active_badge')}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>
                        {school.city ?? t('mode_test.city_unknown')} · {t('mode_test.status_label')} : {school.status}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void basculerModeTestEcole(school.id, school.name, ecoleEnModeTest)}
                      className="w-full sm:w-auto"
                      style={{
                        padding: '7px 12px',
                        minHeight: 36,
                        borderRadius: 8,
                        border: ecoleEnModeTest ? 'none' : '1px solid var(--red)',
                        background: ecoleEnModeTest ? 'var(--green)' : 'var(--surface)',
                        color: ecoleEnModeTest ? '#fff' : 'var(--red)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: busy ? 'wait' : 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      {ecoleEnModeTest ? t('mode_test.btn_enable_school_sends') : t('mode_test.btn_put_in_test')}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 3. Journal des messages supprimés (7 derniers jours) */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 'clamp(12px, 3.6vw, 18px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
              3. {t('mode_test.supprimes_titre')}
            </div>
            <div className="w-full sm:w-auto" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={filtreEcoleMessages}
                onChange={(e) => {
                  const val = e.target.value
                  setFiltreEcoleMessages(val)
                  void chargerMessagesSupprimes(val)
                }}
                className="flex-1 sm:flex-initial"
                style={{
                  padding: '6px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--border)',
                  background: 'var(--bg2)',
                  fontSize: 12,
                  color: 'var(--text)',
                }}
              >
                {hasGlobalSchoolView && <option value="">{t('mode_test.all_schools')}</option>}
                {realSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={messagesSupprimesLoading}
                onClick={() => void chargerMessagesSupprimes(filtreEcoleMessages)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--border)',
                  background: 'var(--bg2)',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: messagesSupprimesLoading ? 'wait' : 'pointer',
                }}
              >
                {t('mode_test.rafraichir')}
              </button>
            </div>
          </div>

          {messagesSupprimes.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '12px 0' }}>
              {t('mode_test.supprimes_vide')}
            </div>
          ) : (
            <>
              {/* Vue Mobile (< md) : cartes empilées natives */}
              <div className="flex md:hidden" style={{ flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                {messagesSupprimes.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text)' }}>{m.channel} · {m.eventType}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {m.schoolId ? (schoolNameById.get(m.schoolId) ?? m.schoolId) : t('mode_test.unattached')}
                    </div>
                    <div style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--text)' }}>
                      {m.recipientMasked}
                    </div>
                  </div>
                ))}
              </div>

              {/* Vue Desktop (>= md) : tableau */}
              <div className="hidden md:block" style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 10px' }}>{t('mode_test.col_date')}</th>
                      <th style={{ padding: '8px 10px' }}>{t('mode_test.col_canal')}</th>
                      <th style={{ padding: '8px 10px' }}>{t('mode_test.col_type')}</th>
                      <th style={{ padding: '8px 10px' }}>{t('mode_test.col_school')}</th>
                      <th style={{ padding: '8px 10px' }}>{t('mode_test.col_destinataire')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messagesSupprimes.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text)' }}>{m.channel}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>{m.eventType}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>
                          {m.schoolId ? (schoolNameById.get(m.schoolId) ?? m.schoolId) : t('mode_test.unattached')}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--text)' }}>{m.recipientMasked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
