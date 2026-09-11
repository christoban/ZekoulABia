'use client'
import { useState, useCallback } from 'react'
import { Trash2, RotateCcw, User, School, BookOpen, Clock } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ElementCorbeille {
  id: string
  type: 'utilisateur' | 'classe' | 'matiere'
  nom: string
  role?: string
  email?: string | null
  niveau?: string | null
  code?: string | null
  deletedAt: string
  deletedByNom: string | null
  purgeLe: string
}

interface CorbeilleData {
  utilisateurs: ElementCorbeille[]
  classes: ElementCorbeille[]
  matieres: ElementCorbeille[]
}

const ICONE_TYPE = { utilisateur: User, classe: School, matiere: BookOpen } as const

export default function SectionCorbeille({ onToast }: Props) {
  const t = useT('admin')
  const [restaurationEnCours, setRestaurationEnCours] = useState<string | null>(null)

  const fetchFn = useCallback(async (): Promise<CorbeilleData> => {
    const res = await fetchApi('/api/v2/corbeille', { credentials: 'include' })
    const d = await res.json()
    if (!res.ok) throw new Error(d.message || t('common.error'))
    return d.data
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading, error, refetch } = useCachedFetch<CorbeilleData>('admin:corbeille', fetchFn)

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  const elements: ElementCorbeille[] = [
    ...(data?.utilisateurs ?? []),
    ...(data?.classes ?? []),
    ...(data?.matieres ?? []),
  ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())

  const restaurer = async (el: ElementCorbeille) => {
    setRestaurationEnCours(el.id)
    try {
      const res = await fetchApi(`/api/v2/corbeille/${el.type}/${el.id}/restore`, { method: 'POST', credentials: 'include' })
      const d = await res.json()
      if (!res.ok || !d.success) throw new Error(d.message || t('corbeille.erreur_restauration'))
      onToast(t('corbeille.restaure').replace('{nom}', el.nom), 'success')
      refetch()
    } catch (e: any) {
      onToast(e.message || t('corbeille.erreur_restauration'), 'error')
    } finally {
      setRestaurationEnCours(null)
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 13 }}>
        <div>
          <div className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
            {t('corbeille.titre')}
          </div>
          <div className="text-[13px] md:text-[13px]" style={{ color: 'var(--text3)', marginTop: 3 }}>{t('corbeille.sous_titre')}</div>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 25 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-corbeille-spin 0.7s linear infinite' }} />
          <style>{`@keyframes edu-corbeille-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && error !== 'OFFLINE_NO_CACHE' && (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{t('common.error')}</div>
          <button onClick={refetch} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('corbeille.retry')}
          </button>
        </div>
      )}

      {!loading && !error && elements.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1.5px solid var(--border)', padding: 20, textAlign: 'center', maxWidth: 460 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Trash2 size={16} color="var(--text3)" /></div>
          <div className="text-[13px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            {t('corbeille.vide_titre')}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text3)' }}>{t('corbeille.vide_sous_titre')}</div>
        </div>
      )}

      {!loading && !error && elements.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>
                  {[t('corbeille.col_element'), t('corbeille.col_supprime_par'), t('corbeille.col_purge_le'), ''].map(h => (
                    <th key={h} style={{ padding: '11px 12px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {elements.map((el, i) => {
                  const Icone = ICONE_TYPE[el.type]
                  return (
                    <tr key={`${el.type}-${el.id}`} style={{ borderBottom: i < elements.length - 1 ? '1px solid var(--bg2)' : 'none' }}>
                      <td style={{ padding: '13px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Icone size={16} color="var(--text3)" />
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 12 }}>{el.nom}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                              {t(`corbeille.type_${el.type}`)}{el.role ? ` · ${el.role}` : ''}{el.email ? ` · ${el.email}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 12px', fontSize: 13, color: 'var(--text2)' }}>{el.deletedByNom ?? '—'}</td>
                      <td style={{ padding: '13px 12px', fontSize: 13, color: 'var(--text2)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Clock size={13} color="var(--text3)" />
                          {new Date(el.purgeLe).toLocaleDateString()}
                        </div>
                      </td>
                      <td style={{ padding: '13px 12px', textAlign: 'right' }}>
                        <button
                          onClick={() => restaurer(el)}
                          disabled={restaurationEnCours === el.id}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 8,
                            fontSize: 12.5, fontWeight: 700, border: 'none', background: 'var(--green)', color: 'white',
                            cursor: restaurationEnCours === el.id ? 'wait' : 'pointer', opacity: restaurationEnCours === el.id ? 0.7 : 1,
                            fontFamily: 'inherit',
                          }}
                        >
                          <RotateCcw size={13} /> {t('corbeille.btn_restaurer')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
