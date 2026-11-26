import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  lireReponsePedagogie,
  lireStatutMaterialisation,
} from '@/features/pedagogie/pedagogieHttpHelpers'

const FRONTEND_SRC = path.resolve(import.meta.dir, '../..')

function makeResponse(status: number, body: string, contentType = 'application/json'): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': contentType },
  })
}

describe('pedagogieHttpHelpers — résilience 403 et déploiement asynchrone (404 status)', () => {
  describe('lireStatutMaterialisation (GET /materialisation/status)', () => {
    it('retourne enabled=true quand le backend répond 200 avec enabled: true', async () => {
      const res = makeResponse(200, JSON.stringify({ success: true, data: { enabled: true } }))
      expect(await lireStatutMaterialisation(res)).toEqual({ enabled: true, unavailable: false })
    })

    it('retourne enabled=false quand le flag est éteint', async () => {
      const res = makeResponse(200, JSON.stringify({ success: true, data: { enabled: false } }))
      expect(await lireStatutMaterialisation(res)).toEqual({ enabled: false, unavailable: false })
    })

    it('gère un 404 HTML Express (frontend déployé avant backend) sans crash ni SyntaxError', async () => {
      const html404 = makeResponse(
        404,
        '<!DOCTYPE html><html><body><pre>Cannot GET /api/v2/pedagogie/materialisation/status</pre></body></html>',
        'text/html; charset=utf-8',
      )
      expect(await lireStatutMaterialisation(html404)).toEqual({ enabled: false, unavailable: true })
    })

    it('gère un 404 JSON sans crash et retourne enabled=false', async () => {
      const json404 = makeResponse(404, JSON.stringify({ message: 'Not Found' }))
      expect(await lireStatutMaterialisation(json404)).toEqual({ enabled: false, unavailable: true })
    })

    it('gère un 500 ou un corps corrompu sans lever d exception', async () => {
      const err500 = makeResponse(500, 'Internal Server Error', 'text/plain')
      expect(await lireStatutMaterialisation(err500)).toEqual({ enabled: false, unavailable: false })

      const badJson200 = makeResponse(200, '<html>unexpected</html>', 'text/html')
      expect(await lireStatutMaterialisation(badJson200)).toEqual({ enabled: false, unavailable: false })
    })
  })

  describe('lireReponsePedagogie (GET /has-programme et GET /progression)', () => {
    const FALLBACK_ERR = 'Erreur de chargement'
    const FALLBACK_403 = 'Accès refusé par défaut'

    it('renvoie ok=true et data sur réponse 200 success=true', async () => {
      const res = makeResponse(
        200,
        JSON.stringify({ success: true, data: { hasProgramme: true, chapitres: [] } }),
      )
      expect(
        await lireReponsePedagogie<{ hasProgramme: boolean; chapitres: unknown[] }>(
          res,
          FALLBACK_ERR,
          FALLBACK_403,
        ),
      ).toEqual({
        ok: true,
        data: { hasProgramme: true, chapitres: [] },
      })
    })

    it('signale forbidden=true avec le message métier du backend sur 403 JSON', async () => {
      const msg = "Accès refusé : vous n'êtes pas affecté à cette classe/matière ni autorisé à consulter ce programme."
      const res = makeResponse(403, JSON.stringify({ success: false, message: msg }))
      expect(await lireReponsePedagogie(res, FALLBACK_ERR, FALLBACK_403)).toEqual({
        ok: false,
        forbidden: true,
        status: 403,
        message: msg,
      })
    })

    it('extrait le champ error renvoyé par le middleware requireRole sur 403', async () => {
      const res = makeResponse(403, JSON.stringify({ error: 'Accès refusé' }))
      expect(await lireReponsePedagogie(res, FALLBACK_ERR, FALLBACK_403)).toEqual({
        ok: false,
        forbidden: true,
        status: 403,
        message: 'Accès refusé',
      })
    })

    it('ne plante pas sur un 403 HTML (reverse proxy) et retourne le message fallback 403', async () => {
      const res = makeResponse(403, '<html><body>403 Forbidden</body></html>', 'text/html')
      expect(await lireReponsePedagogie(res, FALLBACK_ERR, FALLBACK_403)).toEqual({
        ok: false,
        forbidden: true,
        status: 403,
        message: FALLBACK_403,
      })
    })

    it('retourne forbidden=false et fallbackError sur 500 non-JSON', async () => {
      const res = makeResponse(500, 'upstream error', 'text/plain')
      expect(await lireReponsePedagogie(res, FALLBACK_ERR, FALLBACK_403)).toEqual({
        ok: false,
        forbidden: false,
        status: 500,
        message: FALLBACK_ERR,
      })
    })
  })

  describe('non-régression des appelants frontend', () => {
    it('tous les appelants de /materialisation/status utilisent lireStatutMaterialisation', () => {
      const files = [
        'app/teacher/dashboard/_components/cahier/useCahierData.ts',
        'features/pedagogie/PedagogieView.tsx',
        'app/teacher/dashboard/_components/departementAP/DeptProgrammeModulesList.tsx',
        'app/teacher/dashboard/_components/departementAP/DeptProgressionTab.tsx',
      ]
      for (const rel of files) {
        const src = fs.readFileSync(path.join(FRONTEND_SRC, rel), 'utf8')
        expect(src).toContain('lireStatutMaterialisation')
      }
    })

    it('tous les appelants de /has-programme et /progression gèrent explicitement les refus 403', () => {
      const files = [
        'app/teacher/dashboard/_components/cahier/useCahierData.ts',
        'app/teacher/dashboard/_components/cahier/CahierProgrammeTab.tsx',
        'features/pedagogie/PedagogieView.tsx',
        'app/teacher/dashboard/_components/departementAP/DeptProgrammeModulesList.tsx',
      ]
      for (const rel of files) {
        const src = fs.readFileSync(path.join(FRONTEND_SRC, rel), 'utf8')
        expect(src).toContain('lireReponsePedagogie')
      }
    })
  })
})

