import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

const FRONTEND_SRC = path.resolve(import.meta.dir, '..')
const SHELL_DIR = path.join(FRONTEND_SRC, 'components', 'shell')
const UI_DIR = path.join(FRONTEND_SRC, 'components', 'ui')

const EXTENSION_TS = /\.(ts|tsx)$/
const EXCLUDED_DIRS = new Set(['tests', '__tests__', 'node_modules', '.next'])

/**
 * Plafond dur pour tout nouveau fichier dans frontend/src/ (AGENTS.md §4.1).
 * Les fichiers historiques ci-dessous ont un plafond gelé (effet cliquet / ratchet) :
 * leur taille peut baisser mais jamais dépasser cette limite sans découpage préalable.
 */
const NEW_FILE_MAX_LINES = 500

const LEGACY_OVERSIZED_MAX_LINES: Record<string, number> = {
  'app/onboarding/[token]/page.tsx': 2730,
  'app/admin/dashboard/_components/SectionUsers.tsx': 1918,
  'app/admin/dashboard/_components/SectionSubjects.tsx': 1874,
  'app/staff/dashboard/_components/SectionOrientation.tsx': 1741,
  'app/admin/dashboard/_components/SectionSettings.tsx': 1699,
  'app/admin/dashboard/_components/SectionClasses.tsx': 1460,
  'app/login/page.tsx': 1393,
  'app/parent/dashboard/_components/SectionParentPayments.tsx': 1338,
  'app/admin/configuration/ConversationalOnboarding.tsx': 1280,
  'app/master/dashboard/_components/SectionReferentielsHub.tsx': 1170,
  'components/LandingPage.tsx': 1155,
  'app/master/dashboard/_components/SectionLogs.tsx': 1047,
  'app/staff/dashboard/_components/SectionTimetableStaff.tsx': 1000,
  'app/master/dashboard/_components/SectionTeam.tsx': 998,
  'app/admin/dashboard/_components/SectionRH.tsx': 989,
  'features/messagerie/FilConversation.tsx': 973,
  'app/staff/dashboard/_components/concours/ModalAjoutCandidats4Sources.tsx': 962,
  'app/teacher/dashboard/_components/SectionDepartementAP.tsx': 948,
  'app/admin/dashboard/_components/SectionAcademicYear.tsx': 913,
  'app/teacher/dashboard/_components/SectionTeacherGrades.tsx': 889,
  'features/babillard/components/BabillardPublishModal.tsx': 875,
  'features/babillard/components/BabillardBoard.tsx': 849,
  'app/staff/dashboard/_components/SectionLibrary.tsx': 830,
  'app/admin/dashboard/_components/SectionFinance.tsx': 830,
  'app/admin/dashboard/_components/academicEvents/ModalNouvelEvenement.tsx': 828,
  'app/staff/dashboard/_components/SectionDiscipline.tsx': 822,
  'app/staff/dashboard/_components/SectionFinanceStaff.tsx': 817,
  'app/staff/dashboard/_components/SectionStaffDashboard.tsx': 806,
  'app/admin/dashboard/page.tsx': 805,
  'app/teacher/dashboard/_components/SectionTeacherTimetable.tsx': 775,
  'app/teacher/dashboard/_components/SectionCahierDeTexte.tsx': 733,
  'app/master/dashboard/_components/ReferentielEditModal.tsx': 726,
  'app/staff/dashboard/_components/SectionRapportsStaff.tsx': 724,
  'app/parent/dashboard/_components/SectionParentGrades.tsx': 724,
  'app/admin/dashboard/_components/concours/ConcoursCepBatchModal.tsx': 718,
  'app/master/dashboard/_components/MasterTopbar.tsx': 707,
  'app/master/dashboard/_components/MasterModals.tsx': 689,
  'app/staff/dashboard/_components/SectionTimetableStaffActions.tsx': 672,
  'app/staff/dashboard/_components/SectionElevesFamillesStaff.tsx': 660,
  'app/master/dashboard/_components/SectionModeTest.tsx': 659,
  'app/admin/dashboard/_components/SectionEleveOnboarding.tsx': 659,
  'app/teacher/dashboard/_components/TeacherPresenceCheckIn.tsx': 658,
  'app/master/dashboard/_api.ts': 658,
  'app/staff/dashboard/page.tsx': 641,
  'app/staff/dashboard/_components/SectionAnonymatStaff.tsx': 641,
  'app/master/login/page.tsx': 623,
  'app/admin/dashboard/_components/SectionPedagogie.tsx': 618,
  'features/babillard/renderers/AnnonceDetailRenderer.tsx': 615,
  'components/enrollment/EnrollmentStepperForm.tsx': 615,
  'app/admin/dashboard/_components/SectionMinesecStatistics.tsx': 611,
  'app/teacher/dashboard/page.tsx': 607,
  'app/admin/dashboard/_components/SectionAdminAcademicEvents.tsx': 594,
  'components/enrollment/ValidationDrawer.tsx': 559,
  'app/parent/dashboard/_components/SectionParentTimetable.tsx': 554,
  'app/master/dashboard/_components/SectionSchools.tsx': 542,
  'app/admin/dashboard/_components/SectionTimetable.tsx': 537,
  'app/admin/dashboard/_components/concours/ConcoursEmargementModal.tsx': 537,
  'app/student/dashboard/_components/SectionStudentOrientation.tsx': 532,
  'app/teacher/dashboard/_components/SectionAppreciationsPP.tsx': 531,
  'app/group/login/page.tsx': 512,
  'app/admin/dashboard/_components/SectionCommunications.tsx': 511,
  'components/enrollment/EnrollmentKanbanBoard.tsx': 502,
}

function normalizeRel(fullPath: string): string {
  return path.relative(FRONTEND_SRC, fullPath).replace(/\\/g, '/')
}

function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath))
    } else if (entry.isFile() && EXTENSION_TS.test(entry.name)) {
      results.push(fullPath)
    }
  }
  return results.sort()
}

function stripBlockCommentsPreserveLines(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
}

function stripStringsAndLineComment(line: string): string {
  return line
    .replace(/(['"`])(?:\\.|(?!\1)[^\n\\])*\1/g, '""')
    .replace(/\/\/.*$/, '')
}

function findUnjustifiedAny(files: string[]): string[] {
  const violations: string[] = []
  for (const fullPath of files) {
    const rel = normalizeRel(fullPath)
    const raw = stripBlockCommentsPreserveLines(fs.readFileSync(fullPath, 'utf8'))
    const lines = raw.split(/\r?\n/)
    lines.forEach((line, idx) => {
      if (/\/\/\s*hex-allow-any:\s*\S+/.test(line)) return
      const code = stripStringsAndLineComment(line)
      if (!/^\s*(?:\/\/|\/\*|\*|\*\/)/.test(line) && /\bany\b/.test(code)) {
        violations.push(`${rel}:${idx + 1} -> ${line.trim()}`)
      }
    })
  }
  return violations
}

function findNativeDialogs(files: string[]): string[] {
  const violations: string[] = []
  const nativeCallPattern = /(?:^|[^\w.])(?:window\.)?(?:alert|confirm)\s*\(/
  for (const fullPath of files) {
    const rel = normalizeRel(fullPath)
    if (rel === 'components/shell/ConfirmDialog.tsx') continue
    const raw = stripBlockCommentsPreserveLines(fs.readFileSync(fullPath, 'utf8'))
    const lines = raw.split(/\r?\n/)
    lines.forEach((line, idx) => {
      if (rel.endsWith('AssistantWidget.tsx') && /async\s+function\s+confirm\b|\bconfirm\(it\.pendingActionId/.test(line)) {
        return
      }
      const code = stripStringsAndLineComment(line)
      if (nativeCallPattern.test(code)) {
        violations.push(`${rel}:${idx + 1} -> ${line.trim()}`)
      }
    })
  }
  return violations
}

function findForbiddenImports(files: string[], patterns: RegExp[]): string[] {
  const violations: string[] = []
  for (const fullPath of files) {
    const rel = normalizeRel(fullPath)
    const raw = stripBlockCommentsPreserveLines(fs.readFileSync(fullPath, 'utf8'))
    const lines = raw.split(/\r?\n/)
    lines.forEach((line, idx) => {
      if (/^\s*\/\//.test(line)) return
      if (patterns.some((re) => re.test(line))) {
        violations.push(`${rel}:${idx + 1} -> ${line.trim()}`)
      }
    })
  }
  return violations
}

describe('architectureGuard frontend (Gouvernance Lot 3+)', () => {
  const sourceFiles = collectSourceFiles(FRONTEND_SRC)

  it('interdit tout usage non justifie du type any dans frontend/src', () => {
    const violations = findUnjustifiedAny(sourceFiles)
    expect(violations).toEqual([])
  })

  it('interdit les boites de dialogue natives window.alert/alert/window.confirm/confirm', () => {
    const violations = findNativeDialogs(sourceFiles)
    expect(violations).toEqual([])
  })

  it('plafonne chaque composant shell a 500 lignes maximum', () => {
    const shellFiles = fs
      .readdirSync(SHELL_DIR)
      .filter((name) => name.endsWith('.tsx'))
      .sort()
    expect(shellFiles.length).toBeGreaterThan(0)
    const oversized: string[] = []
    for (const fileName of shellFiles) {
      const content = fs.readFileSync(path.join(SHELL_DIR, fileName), 'utf8')
      const lineCount = content.split(/\r?\n/).length
      if (lineCount > 500) {
        oversized.push(`${fileName}: ${lineCount} lignes`)
      }
    }
    expect(oversized).toEqual([])
  })

  it('isole components/shell/ et components/ui/ (aucun import vers app/ ou features/)', () => {
    const shellAndUiFiles = [
      ...collectSourceFiles(SHELL_DIR),
      ...collectSourceFiles(UI_DIR),
    ]
    expect(shellAndUiFiles.length).toBeGreaterThan(0)
    const violations = findForbiddenImports(shellAndUiFiles, [
      /from\s+['"]@\/app\//,
      /from\s+['"]@\/features\//,
      /from\s+['"][.]{2}\/(?:[.]{2}\/)*(?:app|features)\//,
    ])
    expect(violations).toEqual([])
  })

  it('oblige toutes les coques de role (*Toast/*BottomNav/*Topbar/*Sidebar) a importer @/components/shell/', () => {
    const appDir = path.join(FRONTEND_SRC, 'app')
    const roleShellFiles = collectSourceFiles(appDir).filter((fullPath) => {
      const rel = normalizeRel(fullPath)
      if (!/^app\/[^/]+\/dashboard\/_components\/.+\.tsx$/.test(rel)) return false
      if (rel === 'app/master/dashboard/_components/MasterTopbar.tsx') return false
      return /(?:Toast|BottomNav|Topbar|Sidebar)\.tsx$/.test(rel)
    })
    expect(roleShellFiles.length).toBe(22)

    const missingShellImport: string[] = []
    for (const fullPath of roleShellFiles) {
      const content = fs.readFileSync(fullPath, 'utf8')
      if (!/@\/components\/shell\//.test(content)) {
        missingShellImport.push(normalizeRel(fullPath))
      }
    }
    expect(missingShellImport).toEqual([])
  })

  it('verrouille la non-regression DRY des 8 domaines Admin/Staff factorises dans features/', () => {
    const thinWrappers = [
      { rel: 'app/admin/dashboard/_components/SectionGrilleHoraire.tsx', domain: '@/features/timetable/' },
      { rel: 'app/staff/dashboard/_components/SectionGrilleHoraire.tsx', domain: '@/features/timetable/' },
      { rel: 'app/admin/dashboard/_components/SectionAdminAttendance.tsx', domain: '@/features/attendance/' },
      { rel: 'app/staff/dashboard/_components/SectionAttendanceStaff.tsx', domain: '@/features/attendance/' },
      { rel: 'app/admin/dashboard/_components/SectionAffectations.tsx', domain: '@/features/affectations/' },
      { rel: 'app/staff/dashboard/_components/SectionAffectations.tsx', domain: '@/features/affectations/' },
    ]
    const sharedBaseSections = [
      { rel: 'app/admin/dashboard/_components/SectionAdminCouncil.tsx', domain: '@/features/council/' },
      { rel: 'app/staff/dashboard/_components/SectionCouncil.tsx', domain: '@/features/council/' },
      { rel: 'app/admin/dashboard/_components/SectionAdminEntranceExams.tsx', domain: '@/features/concours/' },
      { rel: 'app/staff/dashboard/_components/SectionConcoursStaff.tsx', domain: '@/features/concours/' },
      { rel: 'app/admin/dashboard/_components/SectionFinance.tsx', domain: '@/features/finance/' },
      { rel: 'app/staff/dashboard/_components/SectionFinanceStaff.tsx', domain: '@/features/finance/' },
      { rel: 'app/admin/dashboard/_components/SectionTimetable.tsx', domain: '@/features/timetable/' },
      { rel: 'app/staff/dashboard/_components/SectionTimetableStaff.tsx', domain: '@/features/timetable/' },
      { rel: 'app/admin/dashboard/_components/SectionClasses.tsx', domain: '@/features/classes/' },
      { rel: 'app/staff/dashboard/_components/SectionClassesStaff.tsx', domain: '@/features/classes/' },
    ]

    const errors: string[] = []
    for (const { rel, domain } of thinWrappers) {
      const content = fs.readFileSync(path.join(FRONTEND_SRC, rel), 'utf8')
      const lines = content.split(/\r?\n/).length
      if (!content.includes(domain)) errors.push(`${rel}: doit importer ${domain}`)
      if (lines > 30) errors.push(`${rel}: wrapper doit rester <= 30 lignes (actuel: ${lines})`)
    }
    for (const { rel, domain } of sharedBaseSections) {
      const content = fs.readFileSync(path.join(FRONTEND_SRC, rel), 'utf8')
      if (!content.includes(domain)) errors.push(`${rel}: doit importer ${domain}`)
    }
    expect(errors).toEqual([])
  })

  it('applique l effet cliquet (ratchet) de 500 lignes sur tout frontend/src/', () => {
    const violations: string[] = []
    for (const fullPath of sourceFiles) {
      const rel = normalizeRel(fullPath)
      const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/).length
      const maxAllowed = LEGACY_OVERSIZED_MAX_LINES[rel] ?? NEW_FILE_MAX_LINES
      if (lines > maxAllowed) {
        violations.push(`${rel}: ${lines} lignes > plafond autorise ${maxAllowed}`)
      }
    }
    expect(violations).toEqual([])
  })
})
