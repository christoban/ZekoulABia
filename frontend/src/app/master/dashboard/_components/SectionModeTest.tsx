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
  const t = useT('admin')

  const isSuperAdmin = user?.role === 'super_admin'
  const hasGlobalSchoolView = isSuperAdmin || user?.role === 'platform_admin'
  const canManageSchools =
    hasGlobalSchoolView || user?.role === 'school_manager'

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
      : schoolIdFilter || schools[0]?.id || null
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
  }, [canManageSchools, hasGlobalSchoolView, schools])

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
    if (!hasGlobalSchoolView && !filtreEcoleMessages && schools.length > 0) {
      setFiltreEcoleMessages(schools[0].id)
    }
  }, [hasGlobalSchoolView, filtreEcoleMessages, schools])

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
          ? 'Envois sortants globaux réactivés'
          : 'Mode test global activé (envois sortants coupés sur toute la plateforme)',
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
          ? `Mode test désactivé pour ${schoolName} (envois sortants actifs)`
          : `Mode test activé pour ${schoolName} (envois sortants coupés pour cet établissement)`,
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
    for (const s of schools) {
      map.set(s.id, s.name)
    }
    return map
  }, [schools])

  const filteredSchools = useMemo(() => {
    const q = schoolSearch.trim().toLowerCase()
    const list = !q
      ? schools
      : schools.filter(
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
  }, [schools, schoolSearch, disabledSchoolIds])

  if (!canManageSchools) {
    return (
      <div style={{ padding: 24 }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}
        >
          Accès réservé aux opérateurs autorisés (`super_admin`, `platform_admin`, `school_manager`).
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 20px 48px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                {t('dashboard.mode_test_titre')}
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {isSuperAdmin
                  ? 'Contrôle Fondateur (super_admin) — Global Plateforme & Par Établissement'
                  : 'Contrôle Mode test sur vos établissements créés ou assignés'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void chargerModeTest()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            {t('dashboard.mode_test_rafraichir')}
          </button>
        </div>

        {/* 1. Carte Interrupteur Global Plateforme */}
        {modeTest !== null && (
          <div
            style={{
              background: modeTest ? 'var(--surface)' : 'var(--red-light)',
              border: `1.5px solid ${modeTest ? 'var(--border)' : 'var(--red)'}`,
              borderRadius: 12,
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>1. Coupe-circuit Global Plateforme</span>
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
                    {modeTest ? t('dashboard.mode_test_statut_actif') : t('dashboard.mode_test_statut_inactif')}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {modeTest ? t('dashboard.mode_test_desc_actif') : t('dashboard.mode_test_desc_inactif')}
                </div>
              </div>

              {isSuperAdmin ? (
                modeTest ? (
                  <button
                    type="button"
                    disabled={modeTestBusy}
                    onClick={() => setConfirmDesactivation(true)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--red)',
                      background: 'var(--surface)',
                      color: 'var(--red)',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: modeTestBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {t('dashboard.mode_test_btn_desactiver')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={modeTestBusy}
                    onClick={() => void basculerModeTestGlobal(true)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--green)',
                      color: '#fff',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: modeTestBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {t('dashboard.mode_test_btn_activer')}
                  </button>
                )
              ) : (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    padding: '6px 10px',
                    borderRadius: 8,
                  }}
                >
                  Réservé au Fondateur (super_admin)
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
                  {t('dashboard.mode_test_confirm_texte')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    disabled={modeTestBusy}
                    onClick={() => setConfirmDesactivation(false)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 7,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t('dashboard.mode_test_confirm_annuler')}
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
                    {t('dashboard.mode_test_confirm_oui')}
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
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={16} />
                <span>2. Mode test ciblé par établissement</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: disabledSchoolIds.length > 0 ? 'var(--red-light)' : 'var(--bg)',
                    color: disabledSchoolIds.length > 0 ? 'var(--red)' : 'var(--text-secondary)',
                  }}
                >
                  {disabledSchoolIds.length} établissement(s) en mode test
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                Idéal en production pour les écoles de démonstration ou de formation : seuls les établissements activés ci-dessous contournent la 2FA, les OTP email et les SMS.
              </div>
            </div>

            <div style={{ position: 'relative', minWidth: 240 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="Rechercher une école..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '7px 10px 7px 30px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  fontSize: 12.5,
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {filteredSchools.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '12px 0' }}>
              Aucun établissement trouvé.
            </div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${ecoleEnModeTest ? 'var(--red)' : 'var(--border)'}`,
                      background: ecoleEnModeTest ? 'var(--red-light)' : 'var(--bg)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{school.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
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
                            {modeTest === false ? 'Mode test (via Global)' : 'Mode test actif'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {school.city ?? 'Ville non renseignée'} · Statut : {school.status}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void basculerModeTestEcole(school.id, school.name, ecoleEnModeTest)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: ecoleEnModeTest ? 'none' : '1px solid var(--red)',
                        background: ecoleEnModeTest ? 'var(--green)' : 'var(--surface)',
                        color: ecoleEnModeTest ? '#fff' : 'var(--red)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: busy ? 'wait' : 'pointer',
                      }}
                    >
                      {ecoleEnModeTest ? 'Réactiver les envois' : 'Mettre en mode test'}
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
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
              3. {t('dashboard.mode_test_supprimes_titre')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={filtreEcoleMessages}
                onChange={(e) => {
                  const val = e.target.value
                  setFiltreEcoleMessages(val)
                  void chargerMessagesSupprimes(val)
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
              >
                {hasGlobalSchoolView && <option value="">Tous les établissements</option>}
                {schools.map((s) => (
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
                  padding: '5px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: messagesSupprimesLoading ? 'wait' : 'pointer',
                }}
              >
                {t('dashboard.mode_test_rafraichir')}
              </button>
            </div>
          </div>

          {messagesSupprimes.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '12px 0' }}>
              {t('dashboard.mode_test_supprimes_vide')}
            </div>
          ) : (
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 10px' }}>{t('dashboard.mode_test_col_date')}</th>
                    <th style={{ padding: '8px 10px' }}>{t('dashboard.mode_test_col_canal')}</th>
                    <th style={{ padding: '8px 10px' }}>{t('dashboard.mode_test_col_type')}</th>
                    <th style={{ padding: '8px 10px' }}>Établissement</th>
                    <th style={{ padding: '8px 10px' }}>{t('dashboard.mode_test_col_destinataire')}</th>
                  </tr>
                </thead>
                <tbody>
                  {messagesSupprimes.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(m.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>{m.channel}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{m.eventType}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                        {m.schoolId ? (schoolNameById.get(m.schoolId) ?? m.schoolId) : 'Global / Non rattaché'}
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{m.recipientMasked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
