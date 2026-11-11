import { describe, expect, it } from 'bun:test'
import fs from 'fs'
import path from 'path'
import frCommon from '@/locales/fr/common.json'
import enCommon from '@/locales/en/common.json'

describe('Chantier E — Placement Mode test dans le dashboard Master & Bandeau global', () => {
  const srcRoot = path.resolve(__dirname, '../..')

  it('monte SectionModeTest dans le dashboard Master et utilise le client _api.ts', () => {
    const masterPage = fs.readFileSync(path.join(srcRoot, 'app/master/dashboard/page.tsx'), 'utf8')
    const masterApi = fs.readFileSync(path.join(srcRoot, 'app/master/dashboard/_api.ts'), 'utf8')
    const sectionModeTest = fs.readFileSync(
      path.join(srcRoot, 'app/master/dashboard/_components/SectionModeTest.tsx'),
      'utf8',
    )

    expect(masterPage).toContain('SectionModeTest')
    expect(masterPage).toContain("section === 'mode-test'")
    expect(masterApi).toContain('/api/v2/master/platform-settings')
    expect(masterApi).toContain('/api/v2/master/platform-settings/messages-supprimes')
    expect(sectionModeTest).toContain('fetchPlatformSettings')
    expect(sectionModeTest).toContain('updatePlatformSettings')
    expect(sectionModeTest).toContain('fetchSuppressedOutboundMessages')
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

  it('applique le contrôle d’accès super_admin / platform_admin dans SectionModeTest', () => {
    const sectionModeTest = fs.readFileSync(
      path.join(srcRoot, 'app/master/dashboard/_components/SectionModeTest.tsx'),
      'utf8',
    )

    expect(sectionModeTest).toContain("user?.role === 'super_admin' || user?.role === 'platform_admin'")
    expect(sectionModeTest).toContain("const isSuperAdmin = user?.role === 'super_admin'")
    expect(sectionModeTest).toContain('Lecture seule (super_admin requis)')
  })

  it('utilise uniquement l’endpoint public en lecture seule dans ModeTestBanner et le monte sur Master et les dashboards écoles', () => {
    const banner = fs.readFileSync(path.join(srcRoot, 'components/ModeTestBanner.tsx'), 'utf8')

    expect(banner).toContain('/api/v2/platform-settings/public')
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

