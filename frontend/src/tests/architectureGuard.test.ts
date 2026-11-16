import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

const FRONTEND_SRC = path.resolve(import.meta.dir, '..')
const SHELL_DIR = path.join(FRONTEND_SRC, 'components', 'shell')

const EXTENSION_TS = /\.(ts|tsx)$/
const EXCLUDED_DIRS = new Set(['tests', '__tests__', 'node_modules', '.next'])

function collectSourceFiles(dir: string): string[] {
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
    const rel = path.relative(FRONTEND_SRC, fullPath)
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
    const rel = path.relative(FRONTEND_SRC, fullPath).replace(/\\/g, '/')
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

describe('architectureGuard frontend (Lot 3)', () => {
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
})

