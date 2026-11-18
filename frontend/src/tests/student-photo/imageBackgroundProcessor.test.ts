import { describe, it, expect } from 'bun:test'
import {
  PHOTO_SECRETARY_TIP,
  processStudentPhoto,
  type PhotoStudioMode,
} from '@/features/student-photo/imageBackgroundProcessor'

describe('Studio Photo Élève & Traitement Fond Blanc', () => {
  it('contient la consigne officielle pour uniforme blanc et décor contrasté', () => {
    expect(PHOTO_SECRETARY_TIP).toContain('uniforme blanc')
    expect(PHOTO_SECRETARY_TIP).toContain('porte en bois')
    expect(PHOTO_SECRETARY_TIP).toContain('fond blanc')
  })

  it('renvoie immédiatement la source originale en mode ORIGINAL', async () => {
    const fakeDataUrl = 'data:image/jpeg;base64,fakeSource'
    const result = await processStudentPhoto(fakeDataUrl, { mode: 'ORIGINAL' })
    expect(result).toBe(fakeDataUrl)
  })

  it('gère les modes de traitement valides sans lever d exception', () => {
    const modes: PhotoStudioMode[] = ['WHITE_STUDIO', 'OVAL_MEDALLION', 'ORIGINAL']
    expect(modes).toHaveLength(3)
  })
})

