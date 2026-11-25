/**
 * Régénération complète : assignments + EDT + présences
 * Respecte TeacherSubject, hoursPerWeek, limite AP 14h
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SCHOOL_ID = '576001ff-1227-4a04-b340-e3993da24489'
const AP_MAX_SLOTS = 14 // 14 slots × 60min = 14h/semaine

// ─── helpers ─────────────────────────────────────────────────────────────────
function toMin(h) { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm }
function toStr(m) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

function computeSlots(cfg) {
  const slots = []
  let cur = toMin(cfg.heureDebut)
  const add = (n) => {
    for (let i = 0; i < n; i++) {
      slots.push({ start: toStr(cur), end: toStr(cur + cfg.dureePeriode) })
      cur += cfg.dureePeriode
    }
  }
  add(cfg.periodesAvantP1); cur += cfg.dureePetitePause
  add(cfg.periodesAvantP2); cur += cfg.dureeGrandePause
  add(cfg.periodesApresP2)
  return slots
}

// ─── ÉTAPE 1 : Chargement des données ────────────────────────────────────────
async function loadData() {
  const [academicYear, gridConfig, classes, subjects, teacherSubjects, subjectCoeffs, classOverrides, departments] = await Promise.all([
    prisma.academicYear.findFirst({ where: { schoolId: SCHOOL_ID }, orderBy: [{ isCurrent: 'desc' }, { createdAt: 'desc' }] }),
    prisma.timetableGridConfig.findFirst({ where: { schoolId: SCHOOL_ID } }),
    prisma.class.findMany({ where: { schoolId: SCHOOL_ID }, select: { id: true, name: true, level: true, serie: true, filiere: true } }),
    prisma.subject.findMany({ where: { schoolId: SCHOOL_ID }, select: { id: true, name: true, hoursPerWeek: true } }),
    prisma.teacherSubject.findMany({
      where: { teacherProfile: { user: { schoolId: SCHOOL_ID } } },
      select: { subjectId: true, teacherProfileId: true, teacherProfile: { select: { userId: true } } },
    }),
    prisma.subjectCoefficient.findMany({ where: { schoolId: SCHOOL_ID }, select: { classLevel: true, serieCode: true, subjectId: true } }),
    prisma.classSubjectOverride.findMany({ where: { schoolId: SCHOOL_ID }, select: { classId: true, subjectId: true } }),
    prisma.department.findMany({ where: { schoolId: SCHOOL_ID, headId: { not: null } }, select: { headId: true } }),
  ])
  return { academicYear, gridConfig, classes, subjects, teacherSubjects, subjectCoeffs, classOverrides, departments }
}

// ─── ÉTAPE 2 : Reconstruire les TeachingAssignments ─────────────────────────
async function regenerateAssignments({ classes, subjects, teacherSubjects, subjectCoeffs, classOverrides }) {
  console.log('\n=== ÉTAPE 2 : TeachingAssignments ===')

  // Map subjectId → [userId] qualifiés
  const qualifiedTeachers = new Map()
  for (const ts of teacherSubjects) {
    if (!qualifiedTeachers.has(ts.subjectId)) qualifiedTeachers.set(ts.subjectId, [])
    qualifiedTeachers.get(ts.subjectId).push(ts.teacherProfile.userId)
  }

  // Map subjectId → hoursPerWeek
  const subjectHours = new Map(subjects.map(s => [s.id, s.hoursPerWeek || 2]))

  // Map (level||serie) → Set<subjectId>
  const levelSerieSubjects = new Map()
  for (const c of subjectCoeffs) {
    const key = `${c.classLevel}||${c.serieCode ?? '__NULL__'}`
    if (!levelSerieSubjects.has(key)) levelSerieSubjects.set(key, new Set())
    levelSerieSubjects.get(key).add(c.subjectId)
  }

  // Map classId → Set<subjectId> (overrides)
  const overrideByClass = new Map()
  for (const o of classOverrides) {
    if (!overrideByClass.has(o.classId)) overrideByClass.set(o.classId, new Set())
    overrideByClass.get(o.classId).add(o.subjectId)
  }

  // Charge par enseignant (nb de classes) — pour load-balancing
  const teacherLoad = new Map()

  const toCreate = []
  let fallbackCount = 0

  // Cycle 1 (6e,5e,4e,3e) sans série → FR_GENERAL
  const CYCLE1 = new Set(['6e','5e','4e','3e'])
  const effectiveSerie = (cls) => {
    if (cls.serie && cls.serie !== 'null') return cls.serie
    if (cls.filiere) return cls.filiere
    if (CYCLE1.has(cls.level)) return 'FR_GENERAL'
    return null
  }

  for (const cls of classes) {
    if (!cls.level) continue
    const serie = effectiveSerie(cls)
    const key = `${cls.level}||${serie ?? '__NULL__'}`
    const subjectIds = new Set([
      ...(levelSerieSubjects.get(key) ?? new Set()),
      ...(overrideByClass.get(cls.id) ?? new Set()),
    ])
    // Retirer les doublons overrides/coefficients
    const overrides = overrideByClass.get(cls.id) ?? new Set()
    const finalSubjects = new Set()
    for (const subId of levelSerieSubjects.get(key) ?? new Set()) {
      if (!overrides.has(subId)) finalSubjects.add(subId)
    }
    for (const subId of overrides) finalSubjects.add(subId)

    for (const subjectId of finalSubjects) {
      const qualified = qualifiedTeachers.get(subjectId) || []

      let teacherId
      if (qualified.length > 0) {
        // Choisir le prof qualifié avec le moins de classes
        teacherId = qualified.reduce((best, tid) => {
          return (teacherLoad.get(tid) ?? 0) < (teacherLoad.get(best) ?? 0) ? tid : best
        })
      } else {
        // Fallback : n'importe quel enseignant de l'école (ne devrait pas arriver)
        fallbackCount++
        teacherId = null
        continue // skip — on ne crée pas d'affectation sans enseignant qualifié
      }

      teacherLoad.set(teacherId, (teacherLoad.get(teacherId) ?? 0) + 1)
      toCreate.push({ classId: cls.id, subjectId, teacherId, schoolId: SCHOOL_ID })
    }
  }

  await prisma.teachingAssignment.deleteMany({ where: { schoolId: SCHOOL_ID } })
  await prisma.teachingAssignment.createMany({ data: toCreate, skipDuplicates: true })
  console.log(`✅ ${toCreate.length} affectations créées (${fallbackCount} matières sans enseignant qualifié ignorées)`)

  // Rapport charge
  const loads = [...teacherLoad.entries()].sort((a, b) => b[1] - a[1])
  console.log(`Top 5 profs les plus chargés (nb classes) :`)
  for (const [tid, load] of loads.slice(0, 5)) {
    const u = await prisma.user.findUnique({ where: { id: tid }, select: { firstName: true, lastName: true } })
    console.log(`  ${u.firstName} ${u.lastName}: ${load} classes`)
  }

  return toCreate
}

// ─── ÉTAPE 3 : Générer les EDT ───────────────────────────────────────────────
async function regenerateTimetables({ academicYear, gridConfig, classes, subjects, departments }, assignments) {
  console.log('\n=== ÉTAPE 3 : EDT ===')

  const SLOTS_PER_DAY = gridConfig ? computeSlots(gridConfig) : [
    { start: '07:30', end: '08:30' }, { start: '08:30', end: '09:30' },
    { start: '09:30', end: '10:30' }, { start: '10:45', end: '11:45' },
    { start: '12:45', end: '13:45' }, { start: '13:45', end: '14:45' },
  ]
  const S = SLOTS_PER_DAY.length
  const DAYS = [1, 2, 3, 4, 5] // Lundi–Vendredi

  // AP teachers
  const apTeachers = new Set(departments.map(d => d.headId).filter(Boolean))

  // Map subjectId → hoursPerWeek
  const subjectHours = new Map(subjects.map(s => [s.id, Math.max(1, s.hoursPerWeek || 2)]))

  // Suivi global : teacherId → Set<"day-slotIdx">
  const teacherBusy = new Map()
  // Suivi volume AP : teacherId → nb slots
  const apSlots = new Map()

  // Grouper assignments par classe
  const byClass = new Map()
  for (const a of assignments) {
    if (!byClass.has(a.classId)) byClass.set(a.classId, [])
    byClass.get(a.classId).push(a)
  }

  let timetableCount = 0, slotCount = 0, conflictCount = 0

  for (const cls of classes) {
    const classAssignments = byClass.get(cls.id) || []
    if (classAssignments.length === 0) continue

    const timetable = await prisma.timetable.upsert({
      where: { schoolId_classId_academicYearId: { schoolId: SCHOOL_ID, classId: cls.id, academicYearId: academicYear.id } },
      update: { status: 'PUBLISHED', generatedByAI: true },
      create: { schoolId: SCHOOL_ID, classId: cls.id, academicYearId: academicYear.id, status: 'PUBLISHED', generatedByAI: true },
    })
    await prisma.timetableSlot.deleteMany({ where: { timetableId: timetable.id } })
    timetableCount++

    // Construire le plan de la semaine : [(subjectId, teacherId)×hoursPerWeek, ...]
    const plan = []
    for (const a of classAssignments) {
      const h = subjectHours.get(a.subjectId) || 2
      for (let i = 0; i < h; i++) plan.push({ subjectId: a.subjectId, teacherId: a.teacherId })
    }
    // Mélanger pour répartir sur la semaine
    plan.sort(() => Math.random() - 0.5)

    const slotsToCreate = []
    let planIdx = 0

    for (const day of DAYS) {
      for (let s = 0; s < S; s++) {
        if (planIdx >= plan.length) break // plus de matières à placer
        const slotKey = `${day}-${s}`

        // Chercher une matière dont l'enseignant est libre à ce créneau et non saturé (AP)
        let found = false
        for (let attempt = 0; attempt < plan.length; attempt++) {
          const candidate = plan[(planIdx + attempt) % plan.length]
          const busy = teacherBusy.get(candidate.teacherId) ?? new Set()
          const isAP = apTeachers.has(candidate.teacherId)
          const apCount = apSlots.get(candidate.teacherId) ?? 0

          if (!busy.has(slotKey) && (!isAP || apCount < AP_MAX_SLOTS)) {
            // Prendre ce candidat
            slotsToCreate.push({
              timetableId: timetable.id,
              subjectId: candidate.subjectId,
              teacherId: candidate.teacherId,
              dayOfWeek: day,
              startTime: SLOTS_PER_DAY[s].start,
              endTime: SLOTS_PER_DAY[s].end,
              kind: 'CLASS',
            })
            if (!teacherBusy.has(candidate.teacherId)) teacherBusy.set(candidate.teacherId, new Set())
            teacherBusy.get(candidate.teacherId).add(slotKey)
            if (isAP) apSlots.set(candidate.teacherId, apCount + 1)

            // Retirer du plan (une fois placé)
            plan.splice((planIdx + attempt) % plan.length, 1)
            found = true
            break
          }
        }

        if (!found && plan.length > 0) {
          // Conflit inévitable — placer quand même sans teacher
          const candidate = plan[planIdx % plan.length]
          slotsToCreate.push({
            timetableId: timetable.id,
            subjectId: candidate.subjectId,
            teacherId: null, // conflit : laisser vide
            dayOfWeek: day,
            startTime: SLOTS_PER_DAY[s].start,
            endTime: SLOTS_PER_DAY[s].end,
            kind: 'CLASS',
          })
          plan.splice(planIdx % plan.length, 1)
          conflictCount++
        }
      }
      if (plan.length === 0) break
    }

    await prisma.timetableSlot.createMany({ data: slotsToCreate })
    slotCount += slotsToCreate.length
  }

  console.log(`✅ ${timetableCount} EDT générés, ${slotCount} créneaux, ${conflictCount} conflits résiduels`)
}

// ─── ÉTAPE 4 : Présences ─────────────────────────────────────────────────────
async function regenerateAttendance() {
  console.log('\n=== ÉTAPE 4 : Présences (10 derniers jours ouvrés) ===')

  const students = await prisma.studentProfile.findMany({
    where: { user: { schoolId: SCHOOL_ID }, classId: { not: null } },
    select: { userId: true, classId: true },
  })

  if (students.length === 0) { console.log('  ⚠️  Aucun élève'); return }

  // Supprimer les présences des 15 derniers jours
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 15)
  await prisma.attendance.deleteMany({ where: { schoolId: SCHOOL_ID, date: { gte: cutoff } } })

  // Récupérer les créneaux EDT pour lier les présences
  const slots = await prisma.timetableSlot.findMany({
    where: { timetable: { schoolId: SCHOOL_ID }, teacherId: { not: null }, subjectId: { not: null } },
    select: { dayOfWeek: true, startTime: true, teacherId: true, subjectId: true, timetable: { select: { classId: true } } },
  })
  // Map classId+dayOfWeek → [{ teacherId, subjectId, startTime }]
  const slotsByClassDay = new Map()
  for (const sl of slots) {
    const k = `${sl.timetable.classId}:${sl.dayOfWeek}`
    if (!slotsByClassDay.has(k)) slotsByClassDay.set(k, [])
    slotsByClassDay.get(k).push({ teacherId: sl.teacherId, subjectId: sl.subjectId, startTime: sl.startTime })
  }

  const records = []
  for (let daysAgo = 1; daysAgo <= 10; daysAgo++) {
    const date = new Date(); date.setDate(date.getDate() - daysAgo); date.setHours(0, 0, 0, 0)
    const dow = date.getDay() // 0=dim, 1=lun … 5=sam
    if (dow === 0 || dow === 6) continue

    for (const sp of students) {
      const k = `${sp.classId}:${dow}`
      const daySlots = slotsByClassDay.get(k) || []
      if (daySlots.length === 0) {
        // Pas de cours ce jour → 1 enregistrement MORNING générique
        const r = Math.random()
        records.push({ schoolId: SCHOOL_ID, studentId: sp.userId, classId: sp.classId, date: new Date(date), status: r < 0.88 ? 'PRESENT' : r < 0.96 ? 'ABSENT' : 'LATE', period: 'MORNING' })
      } else {
        // Un enregistrement par créneau de cours
        for (const sl of daySlots) {
          const r = Math.random()
          records.push({
            schoolId: SCHOOL_ID, studentId: sp.userId, classId: sp.classId,
            date: new Date(date), status: r < 0.88 ? 'PRESENT' : r < 0.96 ? 'ABSENT' : 'LATE',
            period: 'MORNING', teacherId: sl.teacherId, subjectId: sl.subjectId,
          })
        }
      }
    }
  }

  const BATCH = 500
  for (let i = 0; i < records.length; i += BATCH) {
    await prisma.attendance.createMany({ data: records.slice(i, i + BATCH), skipDuplicates: true })
  }

  const rate = Math.round(records.filter(r => r.status === 'PRESENT').length / records.length * 1000) / 10
  console.log(`✅ ${records.length} présences créées (taux: ${rate}%)`)
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏫 Lycée de Nkolanga — Régénération complète')
  const data = await loadData()

  if (!data.academicYear) { console.error('❌ Aucune année scolaire'); process.exit(1) }
  if (!data.gridConfig)   { console.warn('⚠️  Pas de config grille — utilisation des valeurs par défaut') }

  const assignments = await regenerateAssignments(data)
  await regenerateTimetables(data, assignments)
  await regenerateAttendance()

  // ─── Vérification rapide ────────────────────────────────────────────────────
  console.log('\n=== Vérification finale ===')
  const [totalSlots, slotsWithTeacher, slotsWithoutTeacher, totalAttendance] = await Promise.all([
    prisma.timetableSlot.count({ where: { timetable: { schoolId: SCHOOL_ID } } }),
    prisma.timetableSlot.count({ where: { timetable: { schoolId: SCHOOL_ID }, teacherId: { not: null } } }),
    prisma.timetableSlot.count({ where: { timetable: { schoolId: SCHOOL_ID }, teacherId: null, subjectId: { not: null } } }),
    prisma.attendance.count({ where: { schoolId: SCHOOL_ID } }),
  ])
  console.log(`Créneaux EDT total: ${totalSlots}`)
  console.log(`  Avec enseignant: ${slotsWithTeacher} (${Math.round(slotsWithTeacher/totalSlots*100)}%)`)
  console.log(`  Sans enseignant (matières insuffisantes): ${slotsWithoutTeacher}`)
  console.log(`Présences: ${totalAttendance}`)

  await prisma.$disconnect()
  console.log('\n✅ Régénération terminée.')
}

main().catch(e => { console.error(e); process.exit(1) })
