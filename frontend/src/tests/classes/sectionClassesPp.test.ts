import { describe, expect, it } from 'bun:test'
import { extractAssignedTeachers } from '@/app/admin/dashboard/_components/SectionClasses'

describe('candidats PP de SectionClasses', () => {
  it('ignore les matières sans professeur et déduplique les professeurs affectés plusieurs fois', () => {
    const teachers = extractAssignedTeachers([
      { currentTeacherId: 'teacher-1', currentTeacherName: 'Jean Mballa' },
      { currentTeacherId: 'teacher-1', currentTeacherName: 'Jean Mballa' },
      { currentTeacherId: null, currentTeacherName: null },
      { currentTeacherId: 'teacher-2', currentTeacherName: 'Alice Ngo' },
    ])

    expect(teachers).toEqual([
      { id: 'teacher-1', name: 'Jean Mballa' },
      { id: 'teacher-2', name: 'Alice Ngo' },
    ])
  })
})
