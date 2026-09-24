import { describe, expect, it } from 'bun:test'
import { toRoomPayload } from '@/app/staff/dashboard/_components/SectionRoomsStaff'
import { getSectionsFromPermissions } from '@/app/staff/dashboard/_types'

describe('Staff rooms configuration', () => {
  it('maps the backend room form to the existing room API payload', () => {
    expect(toRoomPayload({
      name: '  Labo 1  ',
      type: 'LABORATORY',
      status: 'ACTIVE',
      capacity: '30',
      equipment: 'Tables, Projecteur',
    })).toEqual({
      name: 'Labo 1',
      type: 'LABORATORY',
      capacity: 30,
      equipment: ['Tables', 'Projecteur'],
    })
  })

  it('rejects an empty name or non-positive capacity', () => {
    expect(() => toRoomPayload({ name: '', type: 'NORMAL', status: 'ACTIVE', capacity: '30', equipment: '' })).toThrow()
    expect(() => toRoomPayload({ name: 'Salle 1', type: 'NORMAL', status: 'ACTIVE', capacity: '0', equipment: '' })).toThrow()
  })

  it('exposes the configuration room tab through MANAGE_CLASSES', () => {
    expect(getSectionsFromPermissions(['MANAGE_CLASSES'])).toContain('classes')
  })
})
