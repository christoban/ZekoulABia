'use client'

import React, { useState } from 'react'
import EnrollmentKanbanFilters, { type KanbanFiltrePuce } from './EnrollmentKanbanFilters'
import EnrollmentKanbanColumn, { KANBAN_COLONNES } from './EnrollmentKanbanColumn'

export interface KanbanDossier {
  id: string
  nomProvisoire: string
  status: string
  sourceType: string
  recipientType: string
  classId: string | null
  classe: { name: string } | null
  contactEmail: string | null
  contactTelephone: string | null
  completenessScore?: number | null
  validableSousReserve?: boolean
  returnedComment?: string | null
  numeroInterne?: string | null
  createdStudentId?: string | null
  createdAt: string
  submittedData?: {
    nom?: string
    prenom?: string
    gender?: string
  } | null
}

interface Props {
  dossiers: KanbanDossier[]
  onSelectDossier: (dossier: KanbanDossier) => void
  onDownloadPdf?: (id: string) => void
  onNouveauDossier?: () => void
}

export default function EnrollmentKanbanBoard({
  dossiers,
  onSelectDossier,
  onDownloadPdf,
  onNouveauDossier,
}: Props) {
  const [recherche, setRecherche] = useState('')
  const [filtreClasse, setFiltreClasse] = useState('ALL')
  const [filtrePuce, setFiltrePuce] = useState<KanbanFiltrePuce>('TOUS')

  const countConcours = dossiers.filter((d) => d.sourceType === 'CONCOURS').length
  const countRefuses = dossiers.filter((d) => d.status === 'REJECTED').length
  const countExpires = dossiers.filter((d) => d.status === 'EXPIRED').length

  const classesDisponibles = Array.from(
    new Set(dossiers.map((d) => d.classe?.name).filter((name): name is string => Boolean(name))),
  )

  const dossiersFiltres = dossiers.filter((d) => {
    const matchTerm =
      recherche === '' ||
      d.nomProvisoire.toLowerCase().includes(recherche.toLowerCase()) ||
      (d.numeroInterne && d.numeroInterne.toLowerCase().includes(recherche.toLowerCase()))
    const matchClasse = filtreClasse === 'ALL' || d.classe?.name === filtreClasse

    let matchPuce = true
    if (filtrePuce === 'CONCOURS') matchPuce = d.sourceType === 'CONCOURS'
    else if (filtrePuce === 'REJECTED') matchPuce = d.status === 'REJECTED'
    else if (filtrePuce === 'EXPIRED') matchPuce = d.status === 'EXPIRED'

    return matchTerm && matchClasse && matchPuce
  })

  // Tri pour les brouillons : dossiers concours en premier
  const trierDossiers = (list: KanbanDossier[]) => {
    return [...list].sort((a, b) => {
      if (a.sourceType === 'CONCOURS' && b.sourceType !== 'CONCOURS') return -1
      if (b.sourceType === 'CONCOURS' && a.sourceType !== 'CONCOURS') return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Barre de filtre & recherche */}
      <EnrollmentKanbanFilters
        recherche={recherche}
        onRechercheChange={setRecherche}
        filtreClasse={filtreClasse}
        onFiltreClasseChange={setFiltreClasse}
        classesDisponibles={classesDisponibles}
        filtrePuce={filtrePuce}
        onFiltrePuceChange={setFiltrePuce}
        totalCount={dossiers.length}
        countConcours={countConcours}
        countRefuses={countRefuses}
        countExpires={countExpires}
      />

      {/* Grille Kanban à 5 colonnes strictes (min 260px) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(240px, 1fr))',
          gap: 14,
          overflowX: 'auto',
          paddingBottom: 12,
        }}
      >
        {KANBAN_COLONNES.map((col) => {
          const dossiersColonne = trierDossiers(
            dossiersFiltres.filter((d) => col.statuts.includes(d.status)),
          )

          return (
            <EnrollmentKanbanColumn
              key={col.id}
              col={col}
              dossiers={dossiersColonne}
              onSelectDossier={onSelectDossier}
              onDownloadPdf={onDownloadPdf}
              onNouveauDossier={onNouveauDossier}
            />
          )
        })}
      </div>
    </div>
  )
}
