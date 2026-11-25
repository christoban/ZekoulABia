/**
 * MODULE : Studio Photo Élèves — Traitement & Détourage Fond Blanc
 * Conçu pour les établissements scolaires du Cameroun (cartes d'identité, fiches MINESEC, bulletins).
 * 
 * Fonctionnalités :
 * 1. Isolation adaptative d'arrière-plan & remplacement par fond blanc studio (#FFFFFF).
 * 2. Protection des carnations de peau (mélanine / phototypes africains) et des cheveux texturés (afro / tresses).
 * 3. Cadrage officiel en médaillon ovale ou fond studio intégral.
 * 4. Compression et optimisation au ratio portrait identité officiel 3:4.
 */

export type PhotoStudioMode = 'WHITE_STUDIO' | 'OVAL_MEDALLION' | 'ORIGINAL'

export interface ProcessPhotoOptions {
  mode: PhotoStudioMode
  sensitivity?: number // 10 à 90, défaut 45
}

export const PHOTO_SECRETARY_TIP = 
  "Si l'élève porte un uniforme blanc, faites-le poser devant une porte en bois ou un mur sombre/coloré. L'algorithme isolera alors les épaules et le visage avec une netteté maximale pour poser le fond blanc officiel."

/**
 * Recadre une source (vidéo webcam ou image) au format portrait identité 3:4 (480x640)
 */
export function cropToPortraitIdentity(
  source: HTMLVideoElement | HTMLImageElement,
  mirror = false
): string | null {
  const isVideo = source instanceof HTMLVideoElement
  const sw = isVideo ? (source.videoWidth || 640) : (source.width || 640)
  const sh = isVideo ? (source.videoHeight || 480) : (source.height || 480)

  const targetRatio = 3 / 4
  let cropW = Math.round(sh * targetRatio)
  let cropH = sh
  if (cropW > sw) {
    cropW = sw
    cropH = Math.round(sw / targetRatio)
  }

  const startX = Math.round((sw - cropW) / 2)
  const startY = Math.round((sh - cropH) / 2)

  const canvas = document.createElement('canvas')
  const finalW = 480
  const finalH = 640
  canvas.width = finalW
  canvas.height = finalH

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (mirror) {
    ctx.translate(finalW, 0)
    ctx.scale(-1, 1)
  }

  ctx.drawImage(source, startX, startY, cropW, cropH, 0, 0, finalW, finalH)
  return canvas.toDataURL('image/jpeg', 0.9)
}

/**
 * Traite une image capturée (base64) pour appliquer le mode de fond choisi
 */
export async function processStudentPhoto(
  sourceDataUrl: string,
  options: ProcessPhotoOptions
): Promise<string> {
  const { mode, sensitivity = 45 } = options

  if (mode === 'ORIGINAL') {
    return sourceDataUrl
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const width = img.width || 480
        const height = img.height || 640

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        if (!ctx) {
          resolve(sourceDataUrl)
          return
        }

        // Dessiner l'image originale
        ctx.drawImage(img, 0, 0, width, height)

        if (mode === 'OVAL_MEDALLION') {
          const result = renderOvalMedallion(ctx, img, width, height)
          resolve(result)
          return
        }

        if (mode === 'WHITE_STUDIO') {
          const result = renderWhiteStudio(ctx, width, height, sensitivity)
          resolve(result)
          return
        }

        resolve(sourceDataUrl)
      } catch (err: unknown) {
        console.error('[PhotoStudio] Échec traitement image:', err)
        resolve(sourceDataUrl)
      }
    }
    img.onerror = () => reject(new Error('Impossible de charger l\'image pour traitement'))
    img.src = sourceDataUrl
  })
}

/**
 * Mode Médaillon Ovale Officiel :
 * Découpe l'élève dans un ovale parfait sur fond blanc pur avec bordure douce
 */
function renderOvalMedallion(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number
): string {
  const outCanvas = document.createElement('canvas')
  outCanvas.width = w
  outCanvas.height = h
  const outCtx = outCanvas.getContext('2d')
  if (!outCtx) return img.src

  // 1. Fond blanc pur
  outCtx.fillStyle = '#FFFFFF'
  outCtx.fillRect(0, 0, w, h)

  // 2. Masque ovale centré sur le buste et visage
  outCtx.save()
  outCtx.beginPath()
  const centerX = w / 2
  const centerY = h * 0.48
  const radiusX = w * 0.44
  const radiusY = h * 0.46
  outCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2)
  outCtx.clip()

  // Dessiner l'image dans l'ovale
  outCtx.drawImage(img, 0, 0, w, h)
  outCtx.restore()

  // 3. Filet discret de finition
  outCtx.beginPath()
  outCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2)
  outCtx.lineWidth = 2
  outCtx.strokeStyle = 'rgba(230, 230, 230, 0.8)'
  outCtx.stroke()

  return outCanvas.toDataURL('image/jpeg', 0.92)
}

/**
 * Mode Fond Blanc Studio :
 * Segmentation intelligente de l'arrière-plan par échantillonnage du périmètre
 * avec protection stricte des carnations de peau et cheveux crépus/sombres.
 */
function renderWhiteStudio(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sensitivity: number
): string {
  const imgData = ctx.getImageData(0, 0, w, h)
  const data = imgData.data

  // 1. Échantillonner les couleurs du décor sur le périmètre extérieur
  // Coins supérieurs et bord supérieur (100% certains d'être l'arrière-plan)
  let bgR = 0, bgG = 0, bgB = 0
  let sampleCount = 0

  // Échantillons : bord supérieur (y = 0..h*0.08) et coins latéraux (x < w*0.12 ou x > w*0.88)
  for (let y = 0; y < Math.round(h * 0.12); y += 3) {
    for (let x = 0; x < w; x += 4) {
      const idx = (y * w + x) * 4
      bgR += data[idx] ?? 0
      bgG += data[idx + 1] ?? 0
      bgB += data[idx + 2] ?? 0
      sampleCount++
    }
  }

  // Coins latéraux supérieurs
  for (let y = Math.round(h * 0.12); y < Math.round(h * 0.4); y += 4) {
    for (let x = 0; x < Math.round(w * 0.1); x += 3) {
      const idx = (y * w + x) * 4
      bgR += data[idx] ?? 0
      bgG += data[idx + 1] ?? 0
      bgB += data[idx + 2] ?? 0
      sampleCount++
    }
    for (let x = Math.round(w * 0.9); x < w; x += 3) {
      const idx = (y * w + x) * 4
      bgR += data[idx] ?? 0
      bgG += data[idx + 1] ?? 0
      bgB += data[idx + 2] ?? 0
      sampleCount++
    }
  }

  if (sampleCount === 0) sampleCount = 1
  const avgBgR = bgR / sampleCount
  const avgBgG = bgG / sampleCount
  const avgBgB = bgB / sampleCount

  // Seuil de tolérance calculé à partir du curseur (20 à 90)
  const threshold = (sensitivity / 50) * 48
  const featherBand = 18

  // 2. Traitement pixel par pixel avec protection de la personne
  for (let y = 0; y < h; y++) {
    const normY = y / h
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const r = data[idx] ?? 0
      const g = data[idx + 1] ?? 0
      const b = data[idx + 2] ?? 0

      const normX = x / w
      const distFromCenterX = Math.abs(normX - 0.5)

      // ZONE CENTRALE DU SUJET (Visage, cou, buste)
      const isCenterZone = distFromCenterX < 0.38 && normY > 0.12 && normY < 0.96

      // DÉTECTION PEAU / CARNATION (Mélanine africaine, tons chauds R > G >= B)
      const isSkinTone = (r > 38 && g > 24 && b > 12) &&
                         (r >= g - 5) &&
                         (r + g + b > 90) &&
                         (Math.abs(r - g) > 4)

      // DÉTECTION CHEVEUX SOMBRES / TEXTURÉS (Afro, tresses, mèches)
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b
      const isDarkHair = luminance < 65 && normY > 0.08 && normY < 0.45 && distFromCenterX < 0.38

      // Si le pixel correspond à la peau ou aux cheveux dans la zone centrale -> 100% protégé
      if (isCenterZone && (isSkinTone || isDarkHair)) {
        continue
      }

      // Distance euclidienne avec la couleur moyenne du fond
      const diffR = r - avgBgR
      const diffG = g - avgBgG
      const diffB = b - avgBgB
      const colorDist = Math.sqrt(diffR * diffR + diffG * diffG + diffB * diffB)

      // Modulation par la position spatiale : plus on est au bord extérieur, plus la probabilité de fond est forte
      const edgeFactor = Math.min(1.4, Math.max(0.6, distFromCenterX * 2.2 + (normY < 0.2 ? 0.4 : 0)))
      const effectiveDist = colorDist / edgeFactor

      if (effectiveDist < threshold - featherBand) {
        // 100% arrière-plan -> remplacer par blanc pur #FFFFFF
        data[idx] = 255
        data[idx + 1] = 255
        data[idx + 2] = 255
      } else if (effectiveDist < threshold + featherBand) {
        // Zone de transition douce (anti-aliasing)
        const alpha = (effectiveDist - (threshold - featherBand)) / (featherBand * 2)
        // Fond blanc pur = 255
        data[idx] = Math.round(r * alpha + 255 * (1 - alpha))
        data[idx + 1] = Math.round(g * alpha + 255 * (1 - alpha))
        data[idx + 2] = Math.round(b * alpha + 255 * (1 - alpha))
      }
    }
  }

  ctx.putImageData(imgData, 0, 0)
  return ctx.canvas.toDataURL('image/jpeg', 0.92)
}
