export type StaffSection =
  | 'dashboard' | 'council' | 'grades' | 'timetable'
  | 'grille-horaire' | 'affectations'
  | 'attendance' | 'finance' | 'cautions' | 'discipline'
  | 'library' | 'orientation' | 'departements' | 'suivi-eleves'
  | 'anonymat'
  | 'sync-offline'
  | 'mon-profil-rh' | 'apee' | 'notifications' | 'babillard' | 'messagerie' | 'moderation-messagerie'
  | 'classes' | 'eleves-affectations'

export interface SessionUser {
  userId: string
  role: string
  nomComplet: string
  firstName: string
  permissions: string[]
}

export interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export const PERM_TO_SECTION: { perm: string; section: StaffSection }[] = [
  { perm: 'MANAGE_CLASSES',             section: 'classes'          },
  { perm: 'MANAGE_STUDENT_ASSIGNMENTS', section: 'eleves-affectations' },
  { perm: 'MANAGE_TEACHING_ASSIGNMENTS',section: 'affectations'     },
  { perm: 'MANAGE_CLASS_COUNCIL',       section: 'council'          },
  { perm: 'VALIDATE_GRADES',            section: 'grades'           },
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
  // Suivi élève signalé (Partie B) — Censeur en lecture seule, Conseiller pédagogique (deux
  // permissions possibles selon le template, jamais la même titulature partout, voir
  // StaffPermissionRules.ts) une fois un cas escaladé vers lui.
  { perm: 'VALIDATE_GRADES',            section: 'suivi-eleves'     },
  { perm: 'MANAGE_ORIENTATION',         section: 'suivi-eleves'     },
  { perm: 'MANAGE_PEDAGOGICAL_BRIEF',   section: 'suivi-eleves'     },
  { perm: 'MANAGE_ANONYMAT',            section: 'anonymat'         },
]

export function getSectionsFromPermissions(permissions: string[]): Set<StaffSection> {
  const set = new Set<StaffSection>(['dashboard', 'mon-profil-rh', 'notifications', 'babillard', 'messagerie', 'moderation-messagerie'])
  for (const { perm, section } of PERM_TO_SECTION) {
    if (permissions.includes(perm)) set.add(section)
  }
  return set
}
