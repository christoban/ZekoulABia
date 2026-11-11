import { describe, expect, it } from 'bun:test'
import fs from 'fs'
import path from 'path'
import frCommon from '@/locales/fr/common.json'
import enCommon from '@/locales/en/common.json'

describe('Chantier E — Mode test Global + Par Établissement (exclusif super_admin) & Bandeau global', () => {
  const srcRoot = path.resolve(__dirname, '../..')

  it('monte SectionModeTest dans le dashboard Master uniquement pour super_admin et utilise _api.ts', () => {
    const masterPage = fs.readFileSync(path.join(srcRoot, 'app/master/dashboard/page.tsx'), 'utf8')
    const masterApi = fs.readFileSync(path.join(srcRoot, 'app/master/dashboard/_api.ts'), 'utf8')
    const sectionModeTest = fs.readFileSync(
      path.join(srcRoot, 'app/master/dashboard/_components/SectionModeTest.tsx'),
      'utf8',
    )

    expect(masterPage).toContain('SectionModeTest')
    expect(masterPage).toContain("user?.role === 'super_admin'")
    expect(masterPage).toContain("section === 'mode-test'")
    expect(masterApi).toContain('/api/v2/master/platform-settings')
    expect(masterApi).toContain('/api/v2/master/platform-settings/messages-supprimes')
    expect(sectionModeTest).toContain('fetchPlatformSettings')
    expect(sectionModeTest).toContain('updatePlatformSettings')
    expect(sectionModeTest).toContain('fetchSuppressedOutboundMessages')
    expect(sectionModeTest).toContain('basculerModeTestEcole')
  })

  it('retire totalement le bloc Mode test et les appels Master de SectionDashboard (Admin école)', () => {
    const adminSectionDashboard = fs.readFileSync(
      path.join(srcRoot, 'app/admin/dashboard/_components/SectionDashboard.tsx'),
      'utf8',
    )

    expect(adminSectionDashboard).not.toContain('/api/v2/master/platform-settings')
    expect(adminSectionDashboard).not.toContain('messages-supprimes')
    expect(adminSectionDashboard).not.toContain('outboundMessagingEnabled')
  })

  it('verrouille le coupe-circuit global au seul super_admin, ouvre le mode test par école aux opérateurs autorisés, et réserve SectionTeam au super_admin', () => {
    const topbar = fs.readFileSync(
      path.join(srcRoot, 'app/master/dashboard/_components/MasterTopbar.tsx'),
      'utf8',
    )
    const bottomNav = fs.readFileSync(
      path.join(srcRoot, 'app/master/dashboard/_components/MasterBottomNav.tsx'),
      'utf8',
    )
    const sectionModeTest = fs.readFileSync(
      path.join(srcRoot, 'app/master/dashboard/_components/SectionModeTest.tsx'),
      'utf8',
    )
    const sectionTeam = fs.readFileSync(
      path.join(srcRoot, 'app/master/dashboard/_components/SectionTeam.tsx'),
      'utf8',
    )

    expect(topbar).toContain("if (id === 'team') return role === 'super_admin'")
    expect(bottomNav).toContain("if (item.id === 'team') return userRole === 'super_admin'")
    expect(sectionModeTest).toContain("const isSuperAdmin = user?.role === 'super_admin'")
    expect(sectionModeTest).toContain('Réservé au Fondateur (super_admin)')
    expect(sectionTeam).toContain('fetchMasterTeam')
    expect(sectionTeam).toContain('createMasterTeamMember')
    expect(sectionTeam).toContain('Propriétaire (Fondateur)')
  })

  it('utilise uniquement l’endpoint public (scopé par schoolId) dans ModeTestBanner et le monte sur Master et les dashboards écoles', () => {
    const banner = fs.readFileSync(path.join(srcRoot, 'components/ModeTestBanner.tsx'), 'utf8')

    expect(banner).toContain('/api/v2/platform-settings/public')
    expect(banner).toContain('schoolId=')
    expect(banner).not.toContain('/api/v2/master/platform-settings')

    const dashboards = [
      'app/master/dashboard/page.tsx',
      'app/admin/dashboard/page.tsx',
      'app/teacher/dashboard/page.tsx',
      'app/staff/dashboard/page.tsx',
      'app/parent/dashboard/page.tsx',
      'app/student/dashboard/page.tsx',
    ]

    for (const rel of dashboards) {
      const content = fs.readFileSync(path.join(srcRoot, rel), 'utf8')
      expect(content).toContain('ModeTestBanner')
    }

    expect(typeof frCommon.login.mode_test_bandeau_msg).toBe('string')
    expect(frCommon.login.mode_test_bandeau_msg.length).toBeGreaterThan(0)
    expect(typeof enCommon.login.mode_test_bandeau_msg).toBe('string')
    expect((enCommon.login.mode_test_bandeau_msg as string).length).toBeGreaterThan(0)
  })
})
