'use client'
import { MoreHorizontal, Eye, Pencil, Ban, Trash2, RotateCw, Mail, Undo2, CheckCircle2 } from 'lucide-react'
import { reactivateSchool, reexamineSchool, resendInvite, cancelApproval } from '../../_api'
import type { SchoolRow, ConfirmActionTarget } from '../../_types'

interface Props {
  school: SchoolRow
  isOpen: boolean
  variant: 'mobile' | 'desktop'
  onToggle: () => void
  onClose: () => void
  onViewDetails: (id: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onSuspend: (id: string, name: string, subdomain: string) => void
  onDelete: (id: string, name: string) => void
  onRefresh: () => void
  onConfirmAction: (target: ConfirmActionTarget) => void
}

export default function SchoolActionsDropdown({
  school, isOpen, variant, onToggle, onClose, onViewDetails, onToast, onSuspend, onDelete, onRefresh, onConfirmAction,
}: Props) {
  const isMobile = variant === 'mobile'

  const triggerStyle: React.CSSProperties = isMobile
    ? {
        background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8,
        padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--text2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 36, minWidth: 36,
      }
    : {
        background: 'none', border: '1px solid var(--border2)', borderRadius: 6,
        padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--text2)',
        transition: 'all 0.12s', display: 'flex', alignItems: 'center',
      }

  const menuStyle: React.CSSProperties = {
    position: 'absolute', right: 0, top: 'calc(100% + 4px)',
    background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8,
    boxShadow: isMobile ? '0 5px 16px rgba(0,0,0,0.15)' : '0 5px 16px rgba(0,0,0,0.1)',
    minWidth: isMobile ? 200 : 190, zIndex: 100, overflow: 'hidden',
  }

  const divider = <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

  return (
    <div style={{ position: 'relative', ...(isMobile ? { marginLeft: 'auto' } : {}) }}>
      <button onClick={onToggle} style={triggerStyle}>
        <MoreHorizontal size={isMobile ? 15 : 13} />
      </button>
      {isOpen && (
        <div style={menuStyle}>
          {!isMobile && (
            <DropdownItem onClick={() => { onViewDetails(school.id); onClose() }}>
              <Eye size={13} /> Voir les détails
            </DropdownItem>
          )}

          {/* Écoles ACTIVES */}
          {school.status === 'active' && (
            <>
              <DropdownItem onClick={() => { onToast('Fonctionnalité à venir', 'info'); onClose() }}><Pencil size={13} /> Modifier les infos</DropdownItem>
              {divider}
              <DropdownItem onClick={() => { onSuspend(school.id, school.name, school.subdomain); onClose() }} danger><Ban size={13} /> Suspendre</DropdownItem>
              {divider}
              <DropdownItem onClick={() => { onDelete(school.id, school.name); onClose() }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
            </>
          )}

          {/* Écoles SUSPENDUES */}
          {school.status === 'suspended' && (
            <>
              {!isMobile && divider}
              <DropdownItem onClick={() => {
                onClose()
                onConfirmAction({
                  title: 'Réactiver l\'établissement',
                  description: `Réactiver «${school.name}» — tous les utilisateurs retrouveront l'accès.`,
                  icon: CheckCircle2,
                  successMsg: `${school.name} a été réactivée`,
                  execute: async (auth) => {
                    await reactivateSchool(school.id, auth)
                    onRefresh()
                  },
                })
              }} color="var(--primary)"><CheckCircle2 size={13} /> Réactiver</DropdownItem>
              {divider}
              <DropdownItem onClick={() => { onDelete(school.id, school.name); onClose() }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
            </>
          )}

          {/* Écoles REJETÉES */}
          {school.status === 'rejected' && (
            <>
              {!isMobile && divider}
              <DropdownItem onClick={() => {
                onClose()
                onConfirmAction({
                  title: 'Réexaminer la demande',
                  description: `Remettre «${school.name}» en file d'attente pour approbation.`,
                  icon: RotateCw,
                  successMsg: `La demande de ${school.name} est remise en examen`,
                  execute: async (auth) => {
                    await reexamineSchool(school.id, auth)
                    onRefresh()
                  },
                })
              }} color="#1d4ed8"><RotateCw size={13} /> Réexaminer la demande</DropdownItem>
              {divider}
              <DropdownItem onClick={() => { onDelete(school.id, school.name); onClose() }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
            </>
          )}

          {/* Écoles en INVITATION (draft) */}
          {school.status === 'draft' && (
            <>
              {!isMobile && divider}
              <DropdownItem onClick={() => {
                onClose()
                onConfirmAction({
                  title: 'Renvoyer l\'invitation',
                  description: `Envoyer un nouveau lien d'invitation à «${school.name}».`,
                  icon: Mail,
                  successMsg: 'Invitation renvoyée avec succès',
                  execute: async (auth) => {
                    await resendInvite(school.id, auth)
                  },
                })
              }} color="var(--primary)"><Mail size={13} /> Renvoyer l'invitation</DropdownItem>
              {divider}
              <DropdownItem onClick={() => { onDelete(school.id, school.name); onClose() }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
            </>
          )}

          {/* Écoles À APPROUVER (pending) */}
          {school.status === 'pending' && (
            <>
              {!isMobile && divider}
              <DropdownItem onClick={() => { onDelete(school.id, school.name); onClose() }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
            </>
          )}

          {/* Écoles APPROUVÉES */}
          {school.status === 'approved' && (
            <>
              {!isMobile && divider}
              <DropdownItem onClick={() => {
                onClose()
                onConfirmAction({
                  title: "Annuler l'approbation",
                  description: `Remettre «${school.name}» en attente d'approbation. L'admin ne pourra plus se connecter tant que l'école n'est pas ré-approuvée.`,
                  icon: Undo2,
                  successMsg: `L'approbation de ${school.name} a été annulée`,
                  execute: async (auth) => {
                    await cancelApproval(school.id, auth)
                    onRefresh()
                  },
                })
              }} color="#92400e"><Undo2 size={13} /> Annuler l'approbation</DropdownItem>
              {divider}
              <DropdownItem onClick={() => { onDelete(school.id, school.name); onClose() }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function DropdownItem({ children, onClick, danger, color }: { children: React.ReactNode; onClick: () => void; danger?: boolean; color?: string }) {
  return (
    <div onClick={onClick} style={{
      padding: '9px 12px', fontSize: 13, fontWeight: 600,
      color: danger ? 'var(--red)' : color ?? 'var(--text2)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      transition: 'background 0.1s'
    }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = danger ? 'var(--red-light)' : 'var(--bg2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
      {children}
    </div>
  )
}
