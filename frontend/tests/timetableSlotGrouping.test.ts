import { describe, expect, it } from 'bun:test'
import { groupTimetableSlots, groupTimetableSlotsForDisplay, groupTimetableSlotsForStudent, timetableCellKey } from '../src/lib/timetableSlotGrouping'

describe('Regroupement des créneaux EDT', () => {
  it('conserve les groupes Arabe et Chinois dans la même cellule 3e C', () => {
    const slots = [
      { id: 'chinois', dayOfWeek: 0, startTime: '14:15', endTime: '15:15', subject: 'Chinois' },
      { id: 'arabe', dayOfWeek: 0, startTime: '14:15', endTime: '15:15', subject: 'Arabe' },
    ]

    const grouped = groupTimetableSlots(slots)

    const values = grouped.get('0-14:15-15:15') ?? []
    expect(timetableCellKey(slots[0]!)).toBe('0-14:15-15:15')
    expect(values.length).toBe(2)
     expect(values.map(slot => slot.subject)).toEqual(['Chinois', 'Arabe'])
   })

  it('garde le groupe de l’élève et rend les autres cellules non assignées', () => {
    const slots = [
      { id: 'arabe', dayOfWeek: 0, startTime: '14:15', endTime: '15:15', subject: 'Arabe', groupId: 'groupe-arabe' },
      { id: 'chinois', dayOfWeek: 0, startTime: '14:15', endTime: '15:15', subject: 'Chinois', groupId: 'groupe-chinois' },
      { id: 'sport', dayOfWeek: 0, startTime: '15:15', endTime: '16:15', subject: 'Sport', groupId: 'groupe-sport' },
    ]

    const values = groupTimetableSlotsForStudent(slots, ['groupe-arabe'])
    const firstCell = values.get('0-14:15-15:15') ?? []
    const secondCell = values.get('0-15:15-16:15') ?? []

    expect(firstCell.map(slot => 'subject' in slot ? slot.subject : 'unassigned')).toEqual(['Arabe'])
     expect(secondCell.length).toBe(1)
    expect('unassigned' in secondCell[0]!).toBe(true)
  })

  it('ne remplace pas un groupe assigné par un placeholder', () => {
    const slots = [{ dayOfWeek: 0, startTime: '14:15', endTime: '15:15', subject: 'Arabe', groupId: 'groupe-arabe' }]
    const values = groupTimetableSlotsForStudent(slots, ['groupe-arabe']).get('0-14:15-15:15') ?? []

    expect(values.some(slot => 'unassigned' in slot)).toBe(false)
  })

  it('affiche un seul Temps libre pour plusieurs lignes FREE de la même cellule', () => {
    const slots = [
      { id: 'free-1', dayOfWeek: 1, startTime: '14:15', endTime: '15:15', kind: 'FREE', groupId: null },
      { id: 'free-2', dayOfWeek: 1, startTime: '14:15', endTime: '15:15', kind: 'FREE', groupId: null },
    ]
    const values = groupTimetableSlotsForDisplay(slots).get('1-14:15-15:15') ?? []

    expect(values.length).toBe(1)
    expect(values[0]?.id).toBe('free-1')
  })

  it('conserve les deux groupes et masque un FREE redondant quand une séance existe', () => {
    const slots = [
      { id: 'arabe', dayOfWeek: 0, startTime: '14:15', endTime: '15:15', kind: 'CLASS', groupId: 'groupe-arabe' },
      { id: 'chinois', dayOfWeek: 0, startTime: '14:15', endTime: '15:15', kind: 'CLASS', groupId: 'groupe-chinois' },
      { id: 'free', dayOfWeek: 0, startTime: '14:15', endTime: '15:15', kind: 'FREE', groupId: null },
    ]
    const values = groupTimetableSlotsForDisplay(slots).get('0-14:15-15:15') ?? []

    expect(values.map(slot => slot.id)).toEqual(['arabe', 'chinois'])
  })
})
