import { describe, it, expect, beforeEach } from 'bun:test'
import { FinanceController } from '@infrastructure/http/controllers/FinanceController'
import { InMemorySchoolRepository } from '../../../../helpers/repositories/InMemorySchoolRepository.ts'
import { School } from '@domain/entities/School'

function creerEcole(id: string, adminGereFinances = true): School {
  return School.reconstituer({
    id,
    name: 'Lycée Test',
    subdomain: `lycee-${id}`,
    subsystem: 'FRANCOPHONE',
    educationType: 'GENERAL',
    ownership: 'PUBLIC',
    status: 'ACTIVE',
    plan: 'STANDARD',
    saturdaySchedule: false,
    adminGereFinances,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}

function mockRes() {
  let statusCode = 200
  let jsonBody: any = null
  const res: any = {
    status: (code: number) => {
      statusCode = code
      return res
    },
    json: (body: any) => {
      jsonBody = body
      return res
    },
    getStatusCode: () => statusCode,
    getJson: () => jsonBody,
  }
  return res
}

describe('FinanceController — Contrôle des permissions financières', () => {
  let schoolRepo: InMemorySchoolRepository
  let controller: FinanceController
  let creerPlanAppele: boolean
  let genererFactureAppele: boolean

  beforeEach(() => {
    schoolRepo = new InMemorySchoolRepository()
    creerPlanAppele = false
    genererFactureAppele = false

    const mockCreerPlan = {
      execute: async () => {
        creerPlanAppele = true
        return { planId: 'p1', name: 'Plan Test', amount: 10000 }
      },
    } as any

    const mockGenererFacture = {
      execute: async () => {
        genererFactureAppele = true
        return { invoiceId: 'inv1' }
      },
    } as any

    const mockAudit = { journaliser: () => {} } as any
    const mockNotif = { envoyerAuRole: async () => {} } as any
    const mockUserRepo = { findById: async () => null, findByRole: async () => [] } as any

    controller = new FinanceController(
      mockCreerPlan,
      mockGenererFacture,
      {} as any, // genererFacturesEnMasse
      {} as any, // initierPaiement
      {} as any, // traiterWebhook
      {} as any, // rembourserCaution
      {} as any, // enregistrerDepense
      {} as any, // enregistrerPaiementCash
      {} as any, // copierPlansFraisAnneePrecedente
      {} as any, // changerStatutPlanFrais
      {} as any, // paiementRepository
      schoolRepo,
      mockUserRepo,
      mockAudit,
      mockNotif,
    )
  })

  it('autorise un membre du personnel STAFF possédant la permission MANAGE_FINANCE', async () => {
    const school = creerEcole('school-1', false)
    schoolRepo.ajouter(school)

    const req: any = {
      user: {
        userId: 'staff-1',
        schoolId: school.id,
        role: 'STAFF',
        permissions: ['MANAGE_FINANCE'],
      },
      body: { name: 'Frais', amount: 5000, feeType: 'TUITION' },
    }
    const res = mockRes()
    const next = (err: any) => { throw err }

    await controller.creerPlan(req, res, next)

    expect(res.getStatusCode()).toBe(201)
    expect(creerPlanAppele).toBe(true)
  })

  it('bloque avec 403 un membre du personnel STAFF sans permission MANAGE_FINANCE', async () => {
    const school = creerEcole('school-2', true)
    schoolRepo.ajouter(school)

    const req: any = {
      user: {
        userId: 'staff-2',
        schoolId: school.id,
        role: 'STAFF',
        permissions: ['MANAGE_COURSES'],
      },
      body: { name: 'Frais', amount: 5000, feeType: 'TUITION' },
    }
    const res = mockRes()
    const next = (err: any) => { throw err }

    await controller.creerPlan(req, res, next)

    expect(res.getStatusCode()).toBe(403)
    expect(res.getJson()?.message).toBe('Permission MANAGE_FINANCE requise')
    expect(creerPlanAppele).toBe(false)
  })

  it('autorise un ADMIN quand adminGereFinances est activé', async () => {
    const school = creerEcole('school-3', true)
    schoolRepo.ajouter(school)

    const req: any = {
      user: {
        userId: 'admin-1',
        schoolId: school.id,
        role: 'ADMIN',
        permissions: [],
      },
      body: { name: 'Frais', amount: 5000, feeType: 'TUITION' },
    }
    const res = mockRes()
    const next = (err: any) => { throw err }

    await controller.creerPlan(req, res, next)

    expect(res.getStatusCode()).toBe(201)
    expect(creerPlanAppele).toBe(true)
  })

  it('bloque avec 403 un ADMIN quand adminGereFinances est désactivé (délégation comptable)', async () => {
    const school = creerEcole('school-4', false)
    schoolRepo.ajouter(school)

    const req: any = {
      user: {
        userId: 'admin-1',
        schoolId: school.id,
        role: 'ADMIN',
        permissions: [],
      },
      body: { name: 'Frais', amount: 5000, feeType: 'TUITION' },
    }
    const res = mockRes()
    const next = (err: any) => { throw err }

    await controller.creerPlan(req, res, next)

    expect(res.getStatusCode()).toBe(403)
    expect(res.getJson()?.message).toContain('déléguée au comptable/intendant')
    expect(creerPlanAppele).toBe(false)
  })

  it('bloque avec 403 un ADMIN sur la création de facture si adminGereFinances est désactivé', async () => {
    const school = creerEcole('school-5', false)
    schoolRepo.ajouter(school)

    const req: any = {
      user: {
        userId: 'admin-1',
        schoolId: school.id,
        role: 'ADMIN',
        permissions: [],
      },
      body: { studentId: 'student-1', feePlanId: 'plan-1' },
    }
    const res = mockRes()
    const next = (err: any) => { throw err }

    await controller.creerFacture(req, res, next)

    expect(res.getStatusCode()).toBe(403)
    expect(res.getJson()?.message).toContain('déléguée au comptable/intendant')
    expect(genererFactureAppele).toBe(false)
  })
})
