'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight, Edit3, Trash2, Check, X, AlertCircle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { lireReponsePedagogie, lireStatutMaterialisation } from '@/features/pedagogie/pedagogieHttpHelpers'
import { deptInputStyle, type Chapitre, type EditingChapitreState } from './types'

interface ModuleEtatInfo {
  moduleOrdre: number
  actif: boolean
}

interface Props {
  programmeId: string
  classId: string | null
  subjectId: string
  chapitres: Chapitre[]
  editingChap: EditingChapitreState | null
  savingEditChap: boolean
  onStartEditChap: (chap: EditingChapitreState) => void
  onChangeEditingChap: (updater: (prev: EditingChapitreState | null) => EditingChapitreState | null) => void
  onUpdateChapitre: () => void
  onCancelEditChap: () => void
  onDeleteChapitre: (chapitreId: string, titre: string) => void
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function DeptProgrammeModulesList({
  programmeId,
  classId,
  subjectId,
  chapitres,
  editingChap,
  savingEditChap,
  onStartEditChap,
  onChangeEditingChap,
  onUpdateChapitre,
  onCancelEditChap,
  onDeleteChapitre,
  onShowToast,
}: Props) {
  const [featureEnabled, setFeatureEnabled] = useState(false)
  const [moduleEtats, setModuleEtats] = useState<Record<number, boolean>>({})
  const [progressionError, setProgressionError] = useState<string | null>(null)
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({})
  const [busyModule, setBusyModule] = useState<number | null>(null)

  const groupes = useMemo(() => {
    const map = new Map<number, { ordre: number; titre: string; items: Chapitre[] }>()
    for (const ch of chapitres) {
      const mOrdre = ch.moduleOrdre ?? 0
      const cur = map.get(mOrdre) ?? {
        ordre: mOrdre,
        titre: ch.moduleTitre ?? (mOrdre > 0 ? `Module ${mOrdre}` : 'Autres chapitres'),
        items: [],
      }
      cur.items.push(ch)
      map.set(mOrdre, cur)
    }
    return [...map.values()].sort((a, b) => a.ordre - b.ordre)
  }, [chapitres])

  const loadModuleEtats = useCallback(async () => {
    setProgressionError(null)
    try {
      const stRes = await fetchApi('/api/v2/pedagogie/materialisation/status', { credentials: 'include' })
      const { enabled } = await lireStatutMaterialisation(stRes)
      setFeatureEnabled(enabled)
    } catch {
      setFeatureEnabled(false)
    }

    if (!classId) return
    try {
      const prRes = await fetchApi(
        `/api/v2/pedagogie/progression?classId=${classId}&subjectId=${subjectId}`,
        { credentials: 'include' },
      )
      const parsed = await lireReponsePedagogie<{ modules?: ModuleEtatInfo[] }>(
        prRes,
        'Erreur lors du chargement de la progression des modules',
        "Accès refusé : vous n'êtes pas autorisé à consulter l'avancement de cette matière.",
      )
      if (parsed.ok && Array.isArray(parsed.data?.modules)) {
        const map: Record<number, boolean> = {}
        for (const m of parsed.data.modules) {
          map[m.moduleOrdre] = m.actif
        }
        setModuleEtats(map)
      } else if (!parsed.ok && parsed.forbidden) {
        setModuleEtats({})
        setProgressionError(parsed.message)
      }
    } catch { /* ignore */ }
  }, [classId, subjectId])

  useEffect(() => {
    void loadModuleEtats()
  }, [loadModuleEtats])

  useEffect(() => {
    if (groupes.length > 0 && Object.keys(expandedModules).length === 0) {
      setExpandedModules({ [groupes[0].ordre]: true })
    }
  }, [groupes, expandedModules])

  const handleToggleModule = async (moduleOrdre: number, nextActif: boolean) => {
    setBusyModule(moduleOrdre)
    try {
      const res = await fetchApi(
        `/api/v2/pedagogie/programmes/${programmeId}/modules/${moduleOrdre}/statut`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actif: nextActif }),
        },
      )
      const json = await res.json()
      if (res.ok && json.success) {
        setModuleEtats((prev) => ({ ...prev, [moduleOrdre]: nextActif }))
        onShowToast?.(
          nextActif
            ? 'Module réactivé pour ce programme'
            : 'Module désactivé (exclu du taux de progression, conservé et réactivable)',
          'success',
        )
      } else {
        onShowToast?.(json.message ?? 'Impossible de modifier ce module', 'error')
      }
    } catch {
      onShowToast?.('Erreur réseau', 'error')
    } finally {
      setBusyModule(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {progressionError && (
        <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--red)', background: 'var(--red-light)', color: 'var(--red)', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          <span>{progressionError}</span>
        </div>
      )}
      {groupes.map((grp) => {
        const actif = moduleEtats[grp.ordre] !== false
        const isOpen = Boolean(expandedModules[grp.ordre])
        const canToggle = featureEnabled && grp.ordre > 0

        return (
          <div
            key={grp.ordre}
            style={{
              borderRadius: 10,
              border: `1px solid ${actif ? 'var(--border)' : 'var(--border2)'}`,
              background: actif ? 'var(--surface)' : 'var(--bg2)',
              opacity: actif ? 1 : 0.72,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setExpandedModules((prev) => ({ ...prev, [grp.ordre]: !prev[grp.ordre] }))}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 7, background: 'none',
                  border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--text)', fontFamily: 'inherit',
                }}
              >
                <span style={{ color: 'var(--text3)', display: 'flex' }}>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                {grp.ordre > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: 'var(--bg2)', color: 'var(--text2)' }}>
                    M{grp.ordre}
                  </span>
                )}
                <span style={{ fontSize: 12.5, fontWeight: 800 }}>{grp.titre}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>({grp.items.length} leçons)</span>
                {!actif && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: 'var(--amber-light)', color: 'var(--amber)' }}>
                    Désactivé
                  </span>
                )}
              </button>

              {canToggle && (
                <button
                  type="button"
                  disabled={busyModule === grp.ordre}
                  onClick={() => handleToggleModule(grp.ordre, !actif)}
                  style={{
                    padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                    border: `1px solid ${actif ? 'var(--border)' : 'var(--sidebar)'}`,
                    background: actif ? 'var(--bg)' : 'var(--sidebar)',
                    color: actif ? 'var(--text2)' : 'white',
                  }}
                >
                  {actif ? 'Désactiver' : 'Réactiver'}
                </button>
              )}
            </div>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '6px 10px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {grp.items.map((chap) => {
                  const isEditingThis = editingChap?.id === chap.id
                  const retiree = Boolean(chap.retireDuReferentielLe)
                  return (
                    <div key={chap.id} style={{ padding: '6px 8px', borderRadius: 7, background: retiree ? 'var(--bg2)' : 'var(--bg)', opacity: retiree ? 0.72 : 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                      {isEditingThis ? (
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            className="sm:col-span-2"
                            value={editingChap.titre}
                            onChange={(e) => onChangeEditingChap((prev) => (prev ? { ...prev, titre: e.target.value } : null))}
                            style={deptInputStyle}
                          />
                          <input
                            type="number"
                            min={1}
                            placeholder="Heures"
                            value={editingChap.volumeHeuresPrevu ?? ''}
                            onChange={(e) =>
                              onChangeEditingChap((prev) =>
                                prev ? { ...prev, volumeHeuresPrevu: e.target.value === '' ? null : parseInt(e.target.value, 10) || 1 } : null,
                              )
                            }
                            style={deptInputStyle}
                          />
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={onUpdateChapitre} disabled={savingEditChap} style={{ padding: 5, borderRadius: 6, background: 'var(--green-light)', color: 'var(--green)', border: 'none', cursor: 'pointer' }}>
                              <Check size={13} />
                            </button>
                            <button type="button" onClick={onCancelEditChap} style={{ padding: 5, borderRadius: 6, background: 'var(--bg2)', color: 'var(--text2)', border: 'none', cursor: 'pointer' }}>
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: retiree ? 'var(--text3)' : 'var(--text)', wordBreak: 'break-word' }}>
                              {chap.numeroAffiche ? <strong style={{ marginRight: 5 }}>{chap.numeroAffiche}</strong> : null}
                              {chap.titre}
                            </span>
                            {retiree && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'var(--border)', color: 'var(--text2)' }}>
                                Retirée du référentiel
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {chap.volumeHeuresPrevu !== null && chap.volumeHeuresPrevu !== undefined && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{chap.volumeHeuresPrevu}h</span>
                            )}
                            <button
                              type="button"
                              onClick={() => onStartEditChap({ id: chap.id, titre: chap.titre, volumeHeuresPrevu: chap.volumeHeuresPrevu, sequenceCibleFin: chap.sequenceCibleFin })}
                              style={{ padding: 4, borderRadius: 5, background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer' }}
                              title="Modifier"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteChapitre(chap.id, chap.titre)}
                              style={{ padding: 4, borderRadius: 5, background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}
                              title="Supprimer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
