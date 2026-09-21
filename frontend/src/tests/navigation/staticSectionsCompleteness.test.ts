import { describe, expect, it } from 'bun:test'
import fs from 'fs'
import path from 'path'
import { PERM_TO_SECTION, ALL_STAFF_SECTIONS, type StaffSection } from '@/app/staff/dashboard/_types'

describe('Static completeness audit for Staff Sections', () => {
  const componentsDir = path.resolve(
    __dirname,
    '../../app/staff/dashboard/_components'
  )
  const pagePath = path.resolve(__dirname, '../../app/staff/dashboard/page.tsx')
  const configSectionPath = path.resolve(
    componentsDir,
    'SectionConfigurationStaff.tsx'
  )

  it('every Section*.tsx component is either mounted in page.tsx or embedded in SectionConfigurationStaff', () => {
    const files = fs.readdirSync(componentsDir)
    const sectionFiles = files.filter(
      (f) => f.startsWith('Section') && f.endsWith('.tsx')
    )

    const pageContent = fs.readFileSync(pagePath, 'utf8')
    const configContent = fs.readFileSync(configSectionPath, 'utf8')
    const financeSectionPath = path.resolve(componentsDir, 'SectionFinanceStaff.tsx')
    const financeContent = fs.readFileSync(financeSectionPath, 'utf8')

    for (const file of sectionFiles) {
      const componentName = file.replace('.tsx', '')

      const inPage = pageContent.includes(componentName)
      const inConfig = configContent.includes(componentName)
      const inFinance = financeContent.includes(componentName)

      expect(inPage || inConfig || inFinance).toBe(true)
    }
  })

  it('PERM_TO_SECTION maps critical administrative permissions to sections', () => {
    const getSectionsForPerm = (perm: string) =>
      PERM_TO_SECTION.filter((p) => p.perm === perm).map((p) => p.section)

    expect(getSectionsForPerm('MANAGE_ENROLLMENT')).toContain('inscriptions')
    expect(getSectionsForPerm('MANAGE_ENROLLMENT')).toContain('concours')
    expect(getSectionsForPerm('GENERATE_REPORTS')).toContain('rapports')
    expect(getSectionsForPerm('MANAGE_FINANCE')).toContain('finance')
    expect(getSectionsForPerm('MANAGE_ATTENDANCE')).toContain('attendance')
    expect(getSectionsForPerm('MANAGE_DISCIPLINE')).toContain('discipline')
    expect(getSectionsForPerm('MANAGE_ORIENTATION')).toContain('orientation')
    expect(getSectionsForPerm('MANAGE_LIBRARY')).toContain('library')
  })

  it('ALL_STAFF_SECTIONS contains all expected core sections', () => {
    const requiredSections: StaffSection[] = [
      'dashboard',
      'inscriptions',
      'concours',
      'rapports',
      'attendance',
      'discipline',
      'suivi-eleves',
      'timetable',
      'finance',
      'apee',
      'council',
      'anonymat',
      'eleves-affectations',
      'departements',
      'orientation',
      'library',
      'messagerie',
      'babillard',
      'configuration',
      'mon-profil-rh',
      'sync-offline',
      'notifications',
    ]

    for (const sec of requiredSections) {
      expect(ALL_STAFF_SECTIONS).toContain(sec)
    }
  })
})
