export type StaffSection =
  | 'dashboard' | 'council' | 'timetable'
  | 'grille-horaire' | 'affectations'
  | 'attendance' | 'finance' | 'cautions' | 'discipline'
  | 'library' | 'orientation' | 'departements' | 'suivi-eleves'
  | 'anonymat'
  | 'sync-offline'
  | 'mon-profil-rh' | 'apee' | 'notifications' | 'babillard' | 'messagerie' | 'moderation-messagerie'
  | 'classes' | 'eleves-affectations' | 'import-eleves'
  | 'inscriptions' | 'concours' | 'eleves-familles'
  | 'configuration' | 'rapports'

export interface SessionUser {
  userId: string
  role: string
  nomComplet: string
  firstName: string
  lastName?: string
  schoolId?: string
  staffTitle?: string
  permissions: string[]
}

export interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export const ALL_STAFF_SECTIONS: StaffSection[] = [
  'dashboard', 'council', 'timetable',
  'grille-horaire', 'affectations',
  'attendance', 'finance', 'cautions', 'discipline',
  'library', 'orientation', 'departements', 'suivi-eleves',
  'anonymat',
  'sync-offline',
  'mon-profil-rh', 'apee', 'notifications', 'babillard', 'messagerie', 'moderation-messagerie',
  'classes', 'eleves-affectations', 'import-eleves',
  'inscriptions', 'concours', 'eleves-familles',
  'configuration', 'rapports',
]

export const PERM_TO_SECTION: { perm: string; section: StaffSection }[] = [
  { perm: 'GENERATE_REPORTS',           section: 'rapports'         },
  { perm: 'MANAGE_ENROLLMENT',          section: 'rapports'         },
  { perm: 'MANAGE_ENROLLMENT',          section: 'inscriptions'     },
  { perm: 'MANAGE_ENROLLMENT',          section: 'concours'         },
  { perm: 'MANAGE_ENROLLMENT',          section: 'eleves-familles'  },
  { perm: 'MANAGE_ENROLLMENT',          section: 'import-eleves'    },
  { perm: 'MANAGE_CLASSES',             section: 'classes'          },
  { perm: 'MANAGE_STUDENT_ASSIGNMENTS', section: 'eleves-affectations' },
  { perm: 'MANAGE_TEACHING_ASSIGNMENTS',section: 'affectations'     },
  { perm: 'MANAGE_CLASS_COUNCIL',       section: 'council'          },
  { perm: 'MANAGE_CLASS_COUNCILS',      section: 'council'          },
  { perm: 'MANAGE_TIMETABLE',           section: 'grille-horaire'   },
  { perm: 'MANAGE_TIMETABLE',           section: 'affectations'     },
  { perm: 'MANAGE_TIMETABLE',           section: 'timetable'        },
  { perm: 'MANAGE_ATTENDANCE',          section: 'attendance'       },
  { perm: 'MANAGE_FINANCE',             section: 'finance'          },
  { perm: 'VALIDATE_PAYMENTS',          section: 'finance'          },
  { perm: 'MANAGE_FINANCE',             section: 'cautions'         },
  { perm: 'VALIDATE_PAYMENTS',          section: 'cautions'         },
  { perm: 'MANAGE_FINANCE',             section: 'apee'             },
  { perm: 'MANAGE_DISCIPLINE',          section: 'discipline'       },
  { perm: 'MANAGE_LIBRARY',             section: 'library'          },
  { perm: 'MANAGE_ORIENTATION',         section: 'orientation'      },
  { perm: 'SUPERVISE_DEPARTMENT_TEACHERS', section: 'departements'  },
  { perm: 'VALIDATE_GRADES',            section: 'suivi-eleves'     },
  { perm: 'MANAGE_ORIENTATION',         section: 'suivi-eleves'     },
  { perm: 'MANAGE_PEDAGOGICAL_BRIEF',   section: 'suivi-eleves'     },
  { perm: 'MANAGE_ANONYMAT',            section: 'anonymat'         },
]

export const STAFF_TITLE_TRANSLATIONS: Record<string, { fr: string; en: string }> = {
  'Secrétaire': { fr: 'Secrétaire', en: 'School Secretary' },
  'School Secretary': { fr: 'Secrétaire', en: 'School Secretary' },
  'Censeur': { fr: 'Censeur', en: 'Vice-Principal' },
  'Vice-Principal': { fr: 'Censeur', en: 'Vice-Principal' },
  'Intendant': { fr: 'Intendant', en: 'Bursar' },
  'Bursar': { fr: 'Intendant', en: 'Bursar' },
  'Surveillant Général': { fr: 'Surveillant Général', en: 'Discipline Master' },
  'Discipline Master': { fr: 'Surveillant Général', en: 'Discipline Master' },
  "Conseiller d'Orientation": { fr: "Conseiller d'Orientation", en: 'Guidance Counsellor' },
  'Guidance Counsellor': { fr: "Conseiller d'Orientation", en: 'Guidance Counsellor' },
  'Documentaliste': { fr: 'Documentaliste', en: 'Librarian' },
  'Librarian': { fr: 'Documentaliste', en: 'Librarian' },
}

export function getSectionsFromPermissions(permissions: string[]): Set<StaffSection> {
  const set = new Set<StaffSection>([
    'dashboard',
    'mon-profil-rh',
    'notifications',
    'babillard',
    'messagerie',
    'moderation-messagerie',
    'sync-offline',
  ])

  // Configuration n'est accessible que si l'utilisateur possède des permissions techniques structurelles
  const hasConfigPerms = permissions.some((p) =>
    ['MANAGE_CLASSES', 'MANAGE_TIMETABLE', 'MANAGE_TEACHING_ASSIGNMENTS'].includes(p),
  )
  if (hasConfigPerms) {
    set.add('configuration')
  }

  for (const { perm, section } of PERM_TO_SECTION) {
    if (permissions.includes(perm)) set.add(section)
  }
  return set
}

export function getStaffDisplayTitle(user: SessionUser | null, lang: 'fr' | 'en' = 'fr'): string {
  if (user?.staffTitle && user.staffTitle.trim()) {
    const raw = user.staffTitle.trim()
    const mapped = STAFF_TITLE_TRANSLATIONS[raw]
    if (mapped) {
      return lang === 'en' ? mapped.en : mapped.fr
    }
    return raw
  }
  const perms = user?.permissions ?? []
  const isEn = lang === 'en'

  if (perms.includes('MANAGE_ENROLLMENT') && !perms.includes('MANAGE_FINANCE') && !perms.includes('MANAGE_TIMETABLE')) {
    return isEn ? 'School Secretary' : 'Secrétaire'
  }
  if (perms.includes('MANAGE_FINANCE')) {
    return isEn ? 'Bursar' : 'Intendant'
  }
  if (perms.includes('MANAGE_TIMETABLE') || perms.includes('MANAGE_CLASSES')) {
    return isEn ? 'Vice-Principal' : 'Censeur'
  }
  if (perms.includes('MANAGE_DISCIPLINE')) {
    return isEn ? 'Discipline Master' : 'Surveillant Général'
  }
  if (perms.includes('MANAGE_ORIENTATION')) {
    return isEn ? 'Guidance Counsellor' : "Conseiller d'Orientation"
  }
  if (perms.includes('MANAGE_LIBRARY')) {
    return isEn ? 'Librarian' : 'Documentaliste'
  }
  if (perms.includes('SUPERVISE_DEPARTMENT_TEACHERS')) {
    return isEn ? 'HOD' : 'Animateur Pédagogique'
  }
  return isEn ? 'Staff' : 'Personnel'
}
