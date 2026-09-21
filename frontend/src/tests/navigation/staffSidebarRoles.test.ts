import { describe, expect, it } from 'bun:test'
import { getSectionsFromPermissions, getStaffDisplayTitle, type SessionUser } from '@/app/staff/dashboard/_types'

describe('Staff Sidebar Roles & Permissions (Secretary, Censeur, Intendant)', () => {
  it('secretaire: has direct access to inscriptions & concours without configuration', () => {
    const perms = ['MANAGE_ENROLLMENT', 'GENERATE_REPORTS']
    const sections = getSectionsFromPermissions(perms)

    // Doit contenir les admissions & concours
    expect(sections).toContain('inscriptions')
    expect(sections).toContain('concours')

    // Doit contenir les rapports
    expect(sections).toContain('rapports')

    // Accès standard staff
    expect(sections).toContain('dashboard')
    expect(sections).toContain('mon-profil-rh')
    expect(sections).toContain('notifications')
    expect(sections).toContain('sync-offline')
    expect(sections).toContain('messagerie')
    expect(sections).toContain('babillard')

    // Ne doit PAS contenir la configuration de structure scolaire
    expect(sections).not.toContain('configuration')
    expect(sections).not.toContain('classes')
    expect(sections).not.toContain('timetable')
    expect(sections).not.toContain('grille-horaire')
    expect(sections).not.toContain('affectations')
    expect(sections).not.toContain('cautions')
  })

  it('censeur: has access to configuration, timetable, classes, councils', () => {
    const perms = [
      'MANAGE_CLASSES',
      'MANAGE_STUDENT_ASSIGNMENTS',
      'MANAGE_TEACHING_ASSIGNMENTS',
      'MANAGE_TIMETABLE',
      'VALIDATE_GRADES',
      'MANAGE_CLASS_COUNCILS',
    ]
    const sections = getSectionsFromPermissions(perms)

    expect(sections).toContain('configuration')
    expect(sections).toContain('classes')
    expect(sections).toContain('timetable')
    expect(sections).toContain('council')
    expect(sections).toContain('eleves-affectations')
    expect(sections).not.toContain('inscriptions')
  })

  it('intendant / bursar: has access to finance and apee', () => {
    const perms = ['MANAGE_FINANCE', 'VALIDATE_PAYMENTS']
    const sections = getSectionsFromPermissions(perms)

    expect(sections).toContain('finance')
    expect(sections).toContain('apee')
    expect(sections).not.toContain('inscriptions')
    expect(sections).not.toContain('configuration')
  })

  it('getStaffDisplayTitle: resolves specific titles for secretary in FR and EN', () => {
    const userSecretaire: SessionUser = {
      userId: 'u1',
      firstName: 'Sophie',
      lastName: 'Kamga',
      nomComplet: 'Sophie Kamga',
      role: 'STAFF',
      staffTitle: 'Secrétaire',
      schoolId: 's1',
      permissions: ['MANAGE_ENROLLMENT'],
    }

    expect(getStaffDisplayTitle(userSecretaire, 'fr')).toBe('Secrétaire')
    expect(getStaffDisplayTitle(userSecretaire, 'en')).toBe('School Secretary')

    const userBursar: SessionUser = {
      userId: 'u2',
      firstName: 'Paul',
      lastName: 'Bursar',
      nomComplet: 'Paul Bursar',
      role: 'STAFF',
      staffTitle: 'Bursar',
      schoolId: 's1',
      permissions: ['MANAGE_FINANCE'],
    }

    expect(getStaffDisplayTitle(userBursar, 'fr')).toBe('Intendant')
    expect(getStaffDisplayTitle(userBursar, 'en')).toBe('Bursar')
  })
})
