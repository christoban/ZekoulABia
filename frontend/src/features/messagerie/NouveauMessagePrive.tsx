'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Search, Send, User } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import type { ContactUser } from './types'

interface Props {
  onCreated: (conversationId: string) => void
  onCancel: () => void
}

/** Couleur déterministe basée sur l'id */
function avatarColor(id: string): string {
  const colors = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #3b82f6, #06b6d4)',
    'linear-gradient(135deg, #10b981, #34d399)',
    'linear-gradient(135deg, #f59e0b, #f97316)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'linear-gradient(135deg, #14b8a6, #3b82f6)',
    'linear-gradient(135deg, #f97316, #ef4444)',
  ]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function NouveauMessagePrive({ onCreated, onCancel }: Props) {
  const t = useT('common')
  const [contacts, setContacts] = useState<ContactUser[]>([])
  const [loading, setLoading] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [destinataire, setDestinataire] = useState<ContactUser | null>(null)
  const [contenu, setContenu] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let monte = true
    fetchApi('/api/v2/messagerie/contacts')
      .then((r) => r.json())
      .then((d) => { if (monte && d.success) setContacts(d.data ?? []) })
      .catch(() => {})
      .finally(() => { if (monte) setLoading(false) })
    return () => { monte = false }
  }, [])

  const filtres = contacts.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(recherche.toLowerCase()))

  const handleEnvoyer = async () => {
    if (!destinataire || !contenu.trim() || envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      const response = await fetchApi('/api/v2/messagerie/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinataireId: destinataire.id, content: contenu.trim(), clientMessageId: crypto.randomUUID() }),
      })
      const payload = await response.json()
      if (payload.success) {
        onCreated(payload.data.conversationId)
      } else {
        setErreur(payload.message ?? (t('messagerie.generic_error') ?? 'Une erreur est survenue.'))
      }
    } catch {
      setErreur(t('messagerie.generic_error') ?? 'Une erreur est survenue.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* En-tête */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <button type="button" onClick={onCancel} style={{
          border: 'none', background: 'transparent', color: 'var(--text2)',
          cursor: 'pointer', display: 'inline-flex', padding: 4, borderRadius: 8,
        }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white',
        }}>
          <Send size={16} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
            {t('messagerie.new_message') ?? 'Nouveau message'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {destinataire
              ? `${t('messagerie.to') ?? 'À'} ${destinataire.firstName} ${destinataire.lastName}`
              : (t('messagerie.select_recipient') ?? 'Sélectionnez un destinataire')}
          </div>
        </div>
      </div>

      {!destinataire ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Barre de recherche contacts */}
          <div style={{ padding: '12px 12px 8px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input
                value={recherche}
                onChange={(event) => setRecherche(event.target.value)}
                placeholder={t('messagerie.search_contact') ?? 'Rechercher un contact...'}
                style={{
                  width: '100%', padding: '9px 12px 9px 34px', borderRadius: 12,
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: 13, fontWeight: 500,
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* Liste des contacts */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px' }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                <div className="animate-pulse" style={{ width: 32, height: 32, margin: '0 auto 12px', borderRadius: '50%', background: 'var(--border)' }} />
                {t('messagerie.loading') ?? 'Chargement...'}
              </div>
            ) : filtres.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                <User size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <div style={{ fontSize: 13 }}>
                  {recherche ? 'Aucun résultat' : (t('messagerie.no_contact') ?? 'Aucun contact disponible.')}
                </div>
              </div>
            ) : filtres.map((contact) => {
              const initiales = `${contact.firstName?.[0] ?? ''}${contact.lastName?.[0] ?? ''}`.toUpperCase()
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => setDestinataire(contact)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', textAlign: 'left',
                    padding: '10px 10px', borderRadius: 14, border: 'none',
                    background: 'transparent', cursor: 'pointer', marginBottom: 2,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg2, rgba(0,0,0,0.04))' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 14, flexShrink: 0,
                    background: avatarColor(contact.id),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 800, fontSize: 14, letterSpacing: 0.5,
                  }}>
                    {initiales}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>
                      {contact.firstName} {contact.lastName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>
                      {t(`messagerie.role_options.${contact.role.toLowerCase()}`) ?? contact.role}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Destinataire sélectionné */}
          <div style={{ padding: '10px 12px', flexShrink: 0 }}>
            <div style={{
              padding: '10px 14px', borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.06))',
              border: '1px solid rgba(16,185,129,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                  background: avatarColor(destinataire.id),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 800, fontSize: 13,
                }}>
                  {`${destinataire.firstName?.[0] ?? ''}${destinataire.lastName?.[0] ?? ''}`.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>
                    {destinataire.firstName} {destinataire.lastName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {t(`messagerie.role_options.${destinataire.role.toLowerCase()}`) ?? destinataire.role}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setDestinataire(null)} style={{
                border: 'none', background: 'rgba(16,185,129,0.15)',
                color: '#059669', fontWeight: 700, cursor: 'pointer',
                padding: '5px 12px', borderRadius: 8, fontSize: 12,
              }}>
                {t('messagerie.change_contact') ?? 'Changer'}
              </button>
            </div>
          </div>

          {/* Zone de rédaction */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', padding: '0 12px',
            minHeight: 0,
          }}>
            {erreur && (
              <div style={{
                marginBottom: 10, padding: '8px 12px', borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--red, #ef4444)', fontSize: 12.5, fontWeight: 600,
              }}>
                {erreur}
              </div>
            )}

            <textarea
              value={contenu}
              onChange={(event) => setContenu(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && contenu.trim()) { event.preventDefault(); handleEnvoyer() } }}
              placeholder={t('messagerie.write_message') ?? 'Écrire votre message...'}
              rows={5}
              style={{
                width: '100%', flex: 1, minHeight: 80, padding: '12px 14px',
                borderRadius: 16, border: '1.5px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)',
                resize: 'none', fontSize: 13.5, lineHeight: 1.5,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {/* Bouton envoyer — collé en bas */}
          <div style={{
            padding: '10px 12px', flexShrink: 0,
            display: 'flex', justifyContent: 'flex-end',
          }}>
            <button
              type="button"
              onClick={handleEnvoyer}
              disabled={!contenu.trim() || envoi}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 14, border: 'none',
                background: contenu.trim() && !envoi
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'var(--bg2)',
                color: contenu.trim() && !envoi ? 'white' : 'var(--text3)',
                fontWeight: 700, fontSize: 13.5,
                cursor: contenu.trim() && !envoi ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
            >
              <Send size={15} />
              {envoi ? (t('messagerie.sending') ?? 'Envoi...') : (t('messagerie.send') ?? 'Envoyer')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
